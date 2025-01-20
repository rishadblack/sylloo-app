import "dotenv/config"; // Load environment variables from .env file
import { Command } from "commander";
import axios from "axios";
import { setSession, handleErrorMessage } from "../app/utils.js";
import inquirer from "inquirer";

const loginCommand = new Command("login")
  .description("Log in and store authentication token")
  .action(async (action) => {
    try {
      // Prompt for email and password
      const credentials = await inquirer.prompt([
        {
          type: "input",
          name: "email",
          message: "Enter your email:",
        },
        {
          type: "password",
          name: "password",
          message: "Enter your password:",
        },
      ]);

      // Make a POST request to the login endpoint
      const response = await axios.post(
        `${process.env.BASE_URL}/developer/api/v1/user/login`,
        {
          email: credentials.email,
          password: credentials.password,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      // Check if the login was successful and store the token
      if (
        response.data &&
        response.data.status === "success" &&
        response.data.data.authorization.token
      ) {
        await setSession(response.data.data);
        console.log(
          `Hello ${response.data.data.user.name}, you are now logged in.`
        );
      } else {
        console.error("Login failed. Invalid response from the server.");
      }
    } catch (error) {
      handleErrorMessage(error);
    }
  });

export default loginCommand;
