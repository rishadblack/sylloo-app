// commands/download.js
import "dotenv/config";
import { Command } from "commander";
import {
  postWithToken,
  getAllFiles,
  postWithTokenDownload,
  handleErrorMessage,
} from "../app/utils.js";
import inquirer from "inquirer";
import { writeFile, mkdir } from "fs/promises";
import { join, basename, dirname } from "path";

const passCommand = new Command("command")
  .argument("[tenant]", "Tenant name to sync")
  .argument("<commandName...>", "Command name to pass")
  .description("Pass command to server")
  .action(async (tenant, commandName) => {
    // Check if tenant or module are not provided
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

    const fullCommand = commandName.join(" "); // Combine all extra arguments into a single string

    try {
      const response = await runCommand({
        command: fullCommand,
      });

      // Check if the request was successful and save the JSON data to a file
      if (response) {
        if (fullCommand.includes("make")) {
          // Define the directory to watch and the API endpoint to upload to
          const watchDirectory = `./projects/${tenant}`; // Change this to your desired directory

          const getManifestFiles = await manifestFile(tenant);

          const watchDirectoryFilesData = await getAllFiles(watchDirectory);

          const ignoredExtensions = [".gitkeep", ".ignore", ".temp"]; // Add your desired extensions here

          const watchDirectoryFiles = watchDirectoryFilesData.filter((file) => {
            const extension = file.substr(file.lastIndexOf("."));
            return !ignoredExtensions.includes(extension);
          });

          const watchDirectoryFilesNormalized = watchDirectoryFiles.map(
            (file) => {
              return file.replace(/\\/g, "/").replace(/\/+/g, "/");
            }
          );

          // Check if getManifestFiles contains data
          if (getManifestFiles["file_manifest"].length > 0) {
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

                // Ensure that the directory structure leading up to the file exists
                await mkdir(dirname(location), { recursive: true });

                // Write the file to the local filesystem
                await writeFile(location, fileData);
              }
            }
          }
        }
        console.log(response.output);
      } else {
        console.error("Error running command.");
      }
    } catch (error) {
      handleErrorMessage(error);
    }

    async function runCommand(payload) {
      try {
        const response = await postWithToken(`v1/command/${tenant}`, payload);

        if (response.data && response.status === "success") {
          return response.data;
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
  });

// Export passCommand as the default export
export default passCommand;
