import { Command } from "commander";
import inquirer from "inquirer";
import {
  postWithToken,
  postWithTokenDownload,
  getAllFiles,
  getFileHash,
  handleErrorMessage,
  getFileLastModified,
  loadSyncMeta,
  saveSyncMeta,
  updateSyncMeta,
} from "../app/utils.js";
import { readdir, stat, readFile, writeFile, mkdir } from "fs/promises";
import { join, basename, dirname } from "path";

const syncCommand = new Command("sync")
  .argument("[tenant]", "Tenant name to sync")
  .description("Watch tenant for changes and upload them")
  .action(async (tenant) => {
    // Check if tenant are not provided
    if (!tenant) {
      // Prompt for missing arguments
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "tenant",
          message: "Enter the tenant name:",
          when: () => !tenant, // Prompt if tenant is not provided
        },
      ]);

      // Use provided arguments or answers from prompts
      tenant = tenant || answers.tenant;
    }

    // Define the directory to watch and the API endpoint to upload to
    const watchDirectory = `./projects/${tenant}/`;

    try {
      // Check if the directory exists
      await access(watchDirectory);
    } catch (error) {
      // If it doesn't exist, create it
      await mkdir(watchDirectory, { recursive: true });
    }

    const getManifestFiles = await manifestFile(tenant);

    const watchDirectoryFilesData = await getAllFiles(watchDirectory);

    const ignoredExtensions = [
      ".gitkeep",
      ".ignore",
      ".gitignore",
      ".temp",
      ".bak",
      ".sync.json",
    ]; // Add your desired extensions here

    const watchDirectoryFiles = watchDirectoryFilesData.filter((file) => {
      const extension = file.substr(file.lastIndexOf("."));
      return !ignoredExtensions.includes(extension);
    });

    const watchDirectoryFilesNormalized = watchDirectoryFiles.map((file) => {
      return file.replace(/\\/g, "/").replace(/\/+/g, "/");
    });

    const justUploaded = new Set();
    const syncMeta = await loadSyncMeta(tenant);

    const getDownloadManifestFiles = await manifestFile(tenant);

    //DOWNLOAD
    if (
      getDownloadManifestFiles &&
      getDownloadManifestFiles["file_manifest"].length > 0
    ) {
      // Iterate over each file in the manifest
      for (const manifestFile of getDownloadManifestFiles["file_manifest"]) {
        const location = `projects/${tenant}/` + manifestFile["location"];
        const normalizedLocation = location
          .replace(/\\/g, "/")
          .replace(/\/+/g, "/");

        // if (justUploaded.has(normalizedLocation)) {
        //   console.log(`🟡 Skipping ${normalizedLocation} — just uploaded.`);
        //   continue;
        // }

        const remoteHash = manifestFile["hash"];
        const remoteModified = manifestFile["last_modified"]; // seconds

        const localHash = await getFileHash(normalizedLocation);
        const localModified = await getFileLastModified(normalizedLocation); // seconds

        let shouldDownload = false;

        if (localHash === null) {
          // Local file missing
          shouldDownload = true;
        } else if (localHash !== remoteHash) {
          if (remoteModified > localModified) {
            // Remote is newer → download
            shouldDownload = true;
          } else if (localModified > remoteModified) {
            // Local is newer but remote wins
            console.warn(
              `⚠️ Conflict on ${normalizedLocation}. Remote version wins — local will be overwritten.`
            );

            try {
              const localContent = await readFile(normalizedLocation);
              const backupPath = normalizedLocation + ".local.bak";
              await writeFile(backupPath, localContent);
              console.log(`📦 Backed up local file to ${backupPath}`);
            } catch {
              console.warn(
                `⚠️ Could not backup ${normalizedLocation} — file may not exist.`
              );
            }

            shouldDownload = true;
          } else {
            // Same timestamp but different content → conflict (likely clock skew)
            console.warn(
              `⚠️ Same timestamp, different hash on ${normalizedLocation}. Downloading remote version.`
            );
            shouldDownload = true;
          }
        }

        if (shouldDownload) {
          const response = await downloadFile({
            directory: normalizedLocation,
          });

          const fileData = Buffer.from(response.content, "base64");

          // Save the file if needed
          await mkdir(dirname(normalizedLocation), { recursive: true });
          await writeFile(normalizedLocation, fileData);

          const updatedLocalModified = await getFileLastModified(
            normalizedLocation
          );

          // updateSyncMeta(
          //   syncMeta,
          //   manifestFile["location"],
          //   localHash,
          //   updatedLocalModified,
          //   remoteModified
          // ); // same for remote

          console.log(`Downloaded: ${normalizedLocation}`);
        }
      }
    }

    //UPLOAD
    for (const watchDirectoryFile of watchDirectoryFilesNormalized) {
      const manifestLocation = watchDirectoryFile.replace(
        `projects/${tenant}/`,
        ""
      );

      const localHash = await getFileHash(watchDirectoryFile);
      const localModified = await getFileLastModified(watchDirectoryFile); // in seconds

      const manifestEntry = getManifestFiles["file_manifest"].find(
        (file) => file["location"] === manifestLocation
      );

      let shouldUpload = false;

      if (!manifestEntry) {
        shouldUpload = true; // new local file → upload
      } else {
        const remoteHash = manifestEntry["hash"];
        const remoteModified = manifestEntry["last_modified"];

        if (localHash !== remoteHash && remoteModified <= localModified) {
          // Only upload if remote is not newer
          shouldUpload = true;
        }
      }

      if (shouldUpload) {
        try {
          const fileContent = await readFile(watchDirectoryFile);
          const fileContentBase64 = Buffer.from(fileContent).toString("base64");

          await uploadFile({
            file_name: basename(watchDirectoryFile),
            file_path: watchDirectoryFile,
            content: fileContentBase64,
            directory: dirname(watchDirectoryFile),
            action_type: "update",
            last_modified: localModified.toString(), // Send as seconds
          });

          // justUploaded.add(watchDirectoryFile);

          console.log(`Upload: ${watchDirectoryFile}`);
        } catch (error) {
          handleErrorMessage(error);
        }
      }
    }

    // await saveSyncMeta(tenant, syncMeta);

    async function uploadFile(payload) {
      try {
        const response = await postWithToken(`v1/watch/${tenant}`, payload);
        // console.log(
        //   `Uploaded ${payload.file_path} successfully for ${project}`
        // );
      } catch (error) {
        handleErrorMessage(error);
      }
    }

    async function downloadFile(payload) {
      try {
        const response = await postWithTokenDownload(
          `v1/download/${tenant}`,
          payload
        );

        const responseFile = JSON.parse(new TextDecoder().decode(response));

        if (responseFile.data && responseFile.status === "success") {
          return responseFile.data;
        } else {
          console.error(`${response.message}`);
        }
      } catch (error) {
        handleErrorMessage(error);
      }
    }

    async function manifestFile(tenant) {
      try {
        const response = await postWithToken(`v1/manifest/${tenant}`);

        if (response.data && response.status === "success") {
          return response.data;
        } else {
          console.error(`${response.message}`);
        }
      } catch (error) {
        handleErrorMessage(error);
      }
    }

    console.log(`Syncing directory: ${watchDirectory} for ${tenant} tenant.`);
  });

export default syncCommand;
