import { Command } from "commander";
import inquirer from "inquirer";
import {
  postWithToken,
  postWithTokenDownload,
  getAllFiles,
  getFileHash,
  handleErrorMessage,
} from "../app/utils.js";
import { readdir, stat, readFile, writeFile, mkdir } from "fs/promises";
import { join, basename, dirname } from "path";

const syncCommand = new Command("sync")
  .argument("[tenant]", "Tenant name to sync")
  .argument("[syncType]", "Tenant name to sync type (push/pull)")
  .description("Watch tenant for changes and upload them")
  .action(async (tenant, syncType) => {
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

    if (!syncType) {
      // Prompt for missing arguments
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "syncType",
          message: "Enter the sync type name:",
          when: () => !syncType, // Prompt if tenant is not provided
        },
      ]);

      // Use provided arguments or answers from prompts
      syncType = syncType || answers.syncType;
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

    const ignoredExtensions = [".gitkeep", ".ignore", ".gitignore", ".temp"]; // Add your desired extensions here

    const watchDirectoryFiles = watchDirectoryFilesData.filter((file) => {
      const extension = file.substr(file.lastIndexOf("."));
      return !ignoredExtensions.includes(extension);
    });

    const watchDirectoryFilesNormalized = watchDirectoryFiles.map((file) => {
      return file.replace(/\\/g, "/").replace(/\/+/g, "/");
    });

    if (syncType === "pull") {
      // Check if getManifestFiles contains data
      if (getManifestFiles && getManifestFiles["file_manifest"].length > 0) {
        // Iterate over each file in the manifest
        for (const manifestFile of getManifestFiles["file_manifest"]) {
          const location = `projects/${tenant}/` + manifestFile["location"];
          const normalizedLocation = location
            .replace(/\\/g, "/")
            .replace(/\/+/g, "/");

          // Check if the file's location exists in the watch directory
          if (!watchDirectoryFilesNormalized.includes(normalizedLocation)) {
            const response = await downloadFile({
              directory: normalizedLocation, // Include directory name in the payload
            });
            const fileData = Buffer.from(response.content, "base64");

            // // Ensure that the directory structure leading up to the file exists
            await mkdir(dirname(normalizedLocation), { recursive: true });

            // // Write the file to the local filesystem
            await writeFile(normalizedLocation, fileData);
            console.log(`Sync File ${normalizedLocation} has been downloaded.`);
          }
        }
      }
    }

    if (syncType === "push") {
      // Iterate over each file in the watch directory
      for (const watchDirectoryFile of watchDirectoryFilesNormalized) {
        // Construct the manifest location from the watch directory file path
        const manifestLocation = watchDirectoryFile.replace(
          `projects/${tenant}/`,
          ""
        );
        const fileHash = await getFileHash(watchDirectoryFile);

        // Find the corresponding entry in the manifest file
        const manifestEntry = getManifestFiles["file_manifest"].find(
          (file) => file["location"] === manifestLocation
        );

        // Check if the file's location exists in the manifest
        if (
          !manifestEntry ||
          (manifestEntry && manifestEntry["hash"] !== fileHash)
        ) {
          try {
            const fileContent = await readFile(watchDirectoryFile);
            const fileName = basename(watchDirectoryFile);
            const fileDir = dirname(watchDirectoryFile);
            const fileContentBase64 =
              Buffer.from(fileContent).toString("base64");

            await uploadFile({
              file_name: fileName,
              file_path: watchDirectoryFile,
              content: fileContentBase64,
              directory: fileDir, // Include directory name in the payload
              action_type: "update",
              last_modified: (await stat(watchDirectoryFile)).mtime,
            });
            console.log(`Sync File ${manifestLocation} has been updated.`);
          } catch (error) {
            handleErrorMessage(error);
          }
        }
      }
    }

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
