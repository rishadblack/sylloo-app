import { readdir, stat, readFile, writeFile, access, mkdir } from "fs/promises";
import md5File from "md5-file";
import axios from "axios";
import { join, basename, dirname } from "path";
import https from "https";

// Function to read a JSON file and extract the specified property
async function setSession(data) {
  try {
    // Read the contents of the file
    await writeFile("session-lock.json", JSON.stringify(data, null, 2));
  } catch (error) {
    handleErrorMessage(error);
  }
}

// Function to read a JSON file and extract the specified property
async function getUser() {
  try {
    // Read the contents of the file
    const fileContent = await readFile("session-lock.json", "utf-8");

    // Parse the JSON content into an object
    const jsonData = JSON.parse(fileContent);

    // Extract the specified property
    return jsonData["user"];
  } catch (error) {
    handleErrorMessage(error);
  }
}

// Function to read a JSON file and extract the name property
async function getBearerToken() {
  try {
    // Read the contents of the file
    const fileContent = await readFile("session-lock.json", "utf-8");

    // Parse the JSON content into an object
    const jsonData = JSON.parse(fileContent);

    // Extract the specified property
    return jsonData["authorization"]["token"];
  } catch (error) {
    handleErrorMessage(error);
  }
}

async function postWithToken(url, data = {}) {
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false, // Disable SSL verification
  });

  try {
    const response = await axios.post(
      `${process.env.BASE_URL}/developer/api/${url}`,
      data,
      {
        headers: {
          Authorization: `Bearer ${await getBearerToken()}`,
        },
        httpsAgent,
      }
    );

    return response.data;
  } catch (error) {
    handleErrorMessage(error);
  }
}

async function postWithTokenDownload(url, data = {}) {
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false, // Disable SSL verification
  });

  try {
    const response = await axios.post(
      `${process.env.BASE_URL}/developer/api/${url}`,
      data,
      {
        headers: {
          Authorization: `Bearer ${await getBearerToken()}`,
        },
        httpsAgent,
        responseType: "arraybuffer",
      }
    );

    return response.data;
  } catch (error) {
    const responseData = JSON.parse(
      new TextDecoder().decode(error.response.data)
    );

    if (responseData.status === "error") {
      handleErrorMessage(responseData.message);
    } else {
      handleErrorMessage(error);
    }
  }
}

function filterFilesByExtension(files, extensions) {
  return files.filter((file) => {
    const fileExtension = file.split(".").pop(); // Get the file extension
    return !extensions.includes(fileExtension); // Check if the extension is not in the list
  });
}

// Recursive function to get all files in a directory and its subdirectories
async function getAllFiles(directory, ignoreFolders = [".git"]) {
  let files = [];

  // Read the contents of the directory
  const entries = await readdir(directory);

  // Iterate over the entries in the directory
  for (const entry of entries) {
    // Get the full path of the entry
    const fullPath = join(directory, entry);

    // Get the stats of the entry
    const stats = await stat(fullPath);

    // Check if the entry is a directory
    if (stats.isDirectory()) {
      // Check if the directory should be ignored
      if (ignoreFolders.includes(entry)) {
        continue; // Skip this directory
      }

      // Recursively get files in the subdirectory
      const subDirectoryFiles = await getAllFiles(fullPath, ignoreFolders);
      files = files.concat(subDirectoryFiles);
    } else {
      // If the entry is a file, add it to the list of files
      files.push(fullPath);
    }
  }

  return files;
}

async function getFileHash(filePath) {
  try {
    // Calculate and return the MD5 hash
    const fileHash = await md5File(filePath);
    return fileHash;
  } catch (error) {
    // If file does not exist, return null
    return null;
  }
}

function handleErrorMessage(error) {
  if (
    error.response &&
    error.response.data &&
    error.response.data.status === "error"
  ) {
    console.error(error.response.data.errors);
    console.error(error.response.data.message);
    process.exit(1);
  } else if (error.message) {
    console.log(error);
    console.error("Error:", error.message);
    throw error.message;
  } else if (error) {
    console.error(error);
    process.exit(1);
  } else {
    console.error("Unknown error occurred.");
    throw error;
  }
}

// Export the functions
export {
  setSession,
  getUser,
  getBearerToken,
  postWithToken,
  filterFilesByExtension,
  postWithTokenDownload,
  getAllFiles,
  getFileHash,
  handleErrorMessage,
};
