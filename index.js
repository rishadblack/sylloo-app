#!/usr/bin/env node
import { program } from "commander";
import passCommand from "./commands/pass-command.js";
import watchCommand from "./commands/watch.js";
import syncCommand from "./commands/sync.js";
import loginCommand from "./commands/login.js";
import logoutCommand from "./commands/logout.js";

program.version("1.0.0").description("My CLI Tool");

// Register your commands
program.addCommand(loginCommand);
program.addCommand(passCommand);
program.addCommand(syncCommand);
program.addCommand(watchCommand);
program.addCommand(logoutCommand);

program.parse(process.argv);
