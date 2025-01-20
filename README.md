# Sylloo CLI Tool

## Description

Sylloo is a command-line interface (CLI) tool designed for various operations such as session management, syncing data, and user authentication. This tool provides a simple way to interact with your application from the terminal.

## Features

- User login and logout functionality
- Pass commands for executing specific operations
- Syncing data
- Web session management
- File watching for real-time updates

## Installation

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed on your machine (version 12 or higher is recommended).

### Local Installation

To install the CLI tool locally, navigate to your project directory and run:

```bash
npm install
```

Global Installation

To make the CLI tool available globally, run:

```bash

npm install -g .
```

## Setup

Upon installation, the setup.js script will automatically create a .env file based on the .env.example template. Ensure that the .env.example file is present in the project root before running the setup.
Customizing the Environment

You can customize your environment settings by modifying the .env file after it is created.

### Usage

Once installed, you can use the following commands:

### Login

```bash

sylloo login
```

Log in to your application.

### Logout

```bash

sylloo logout
```

Log out of your application.

### Pass Command

```bash

sylloo command
```

Execute a specific pass command.

### Sync

```bash

sylloo sync
```

Synchronize data.

### Web Session

```bash

sylloo session
```

Manage web sessions.

### Watch

```bash

sylloo watch
```

Watch for file changes and react accordingly.

### License

This project is licensed under the ISC License - see the LICENSE file for details.

### Author

S M Rishad

### Acknowledgements

    Commander.js for command-line interface management.
    dotenv for managing environment variables.
    Axios for making HTTP requests.

sql

### Notes:

- Replace `<repository-url>` with the actual URL of your GitHub repository.
- You can add any additional sections that you find relevant, such as "Troubleshooting" or "Contributing Guidelines."
- If you have specific instructions for using each command, you can elaborate further in the "Usage" section.

Feel free to customize this template according to your preferences and the specifics of your CLI tool! If you need any additional sections or modifications, let me know!
