import { Command } from "commander";
import { exec } from "child_process";
import inquirer from "inquirer";
import { postWithToken, handleErrorMessage } from "../app/utils.js";
import chokidar from "chokidar";
import { readFile, stat } from "fs/promises";
import { basename, dirname } from "path"; // Import dirname function to get the directory name

const watchCommand = new Command("watch")
  .argument("[tenant]", "Tenant name to sync")
  .description(
    "Watch tenants for changes and upload them for a specific tenant"
  )
  .action(async (tenant) => {
    // Check if project or module are not provided
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

    const watchDirectory = `./projects/${tenant}/`; // Set the directory based on the project name

    exec(`sylloo-app sync ${tenant}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`Command stderr: ${stderr}`);
        return;
      }
      console.log(stdout);
      // Start the watcher after the sync command has finished
      startWatcher();
    });

    function startWatcher() {
      const watcher = chokidar.watch(watchDirectory, {
        ignoreInitial: true,
        ignored: /(^|[/\\])\../, // Ignore dotfiles
      });

      watcher.on("ready", () => {
        console.log(`Watching directory for ${tenant}: ${watchDirectory}`);
      });

      watcher.on("add", async (filePath) => {
        await handleFileEvent(filePath, "create");
        console.log(`Watch File ${filePath} has been added.`);
      });

      watcher.on("change", async (filePath) => {
        await handleFileEvent(filePath, "update");
        console.log(`Watch File ${filePath} has been changed.`);
      });

      watcher.on("unlink", async (filePath) => {
        await handleDirectoryEvent(filePath, "delete");
        console.log(`Watch File ${filePath} has been removed.`);
      });

      watcher.on("addDir", async (dirPath) => {
        await handleDirectoryEvent(dirPath, "create-dir");
        console.log(`Watch Directory ${dirPath} has been created.`);
      });

      watcher.on("unlinkDir", async (dirPath) => {
        await handleDirectoryEvent(dirPath, "delete-dir");
        console.log(`Watch Directory ${dirPath} has been removed.`);
      });
    }

    async function handleFileEvent(filePath, actionType) {
      try {
        const fileContent = await readFile(filePath);
        const fileName = basename(filePath);
        const fileDir = dirname(filePath);
        const fileContentBase64 = Buffer.from(fileContent).toString("base64");

        await uploadFile({
          file_name: fileName,
          file_path: filePath,
          content: fileContentBase64,
          directory: fileDir, // Include directory name in the payload
          action_type: actionType,
          last_modified: (await stat(filePath)).mtime,
        });
      } catch (error) {
        handleErrorMessage(error);
      }
    }

    async function handleDirectoryEvent(dirPath, actionType) {
      try {
        await uploadFile({
          file_name: "", // Empty file name for directories
          file_path: "",
          content: "", // Empty content for directories
          directory: dirPath, // Empty directory name for directories
          action_type: actionType,
          last_modified: "",
        });

        console.log(`Handled directory event (${actionType}): ${dirPath}`);
      } catch (error) {
        handleErrorMessage(error);
      }
    }

    async function uploadFile(payload) {
      try {
        const response = await postWithToken(`v1/watch/${tenant}`, payload);
      } catch (error) {
        handleErrorMessage(error);
      }
    }
  });

export default watchCommand;
