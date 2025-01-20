import { promises as fs } from "fs";

// Define paths for .env.example and .env
const envExamplePath = "./.env.example";
const envPath = "./.env";

async function copyEnvFile() {
  try {
    // Read the contents of .env.example
    const envExampleContent = await fs.readFile(envExamplePath, "utf8");

    // Write the contents of .env.example to .env
    await fs.writeFile(envPath, envExampleContent);

    console.log(".env file created successfully.");
  } catch (error) {
    console.error("Error copying .env file:", error);
  }
}

// Call the function to copy .env file
copyEnvFile();
