// commands/logout.js
import "dotenv/config";
import { Command } from "commander";
import { postWithToken, handleErrorMessage } from "../app/utils.js";

const logoutCommand = new Command("logout")
  .description("Download a JSON file from the API")
  .action(async () => {
    try {
      const response = await postWithToken("v1/user/logout");

      // Check if the request was successful and save the JSON data to a file
      if (response && response.status === "success") {
        console.log("Logged out successfully.");
      } else {
        console.error("Logout failed. Invalid response from the server.");
      }
    } catch (error) {
      handleErrorMessage(error);
    }
  });

// Export logoutCommand as the default export
export default logoutCommand;
