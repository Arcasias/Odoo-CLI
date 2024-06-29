import {
    addValueToOption,
    CommandOption,
    CommandOptionDefinition,
    CommandOptions,
    findCommand,
    findCommandOption,
} from "./command";
import { LocalError, R_FULL_MATCH, R_SHORT_MATCH } from "./constants";
import { logger } from "./logger";

import "./commands/index";
import { resolve } from "./utils";
import { execProcess, listenOnCloseEvents } from "./process";

const main = async () => {
    const registerOption = async (option: CommandOption, definition: CommandOptionDefinition) => {
        commandOptions[definition.name] = option;
        commandOptions[definition.name].definition = definition;

        // Add remaining command arguments as addon names
        if (definition.name === "addons") {
            addValueToOption(option, ...remaining);
        }

        // Parse values (if needed)
        if (definition.parse) {
            option.values = await resolve(definition.parse(option.values));
        }

        // Register option effect (if any
        if (definition.effect) {
            effects.push(definition.effect);
        }
    };

    listenOnCloseEvents();

    const processArgs = process.argv.slice(2).flatMap((arg) => arg.toLowerCase().split("="));
    const [options, remaining] = parseArguments(processArgs);
    const cmdName = remaining.shift() || "start";

    // Get command
    const command = findCommand(cmdName);
    const commandOptions: CommandOptions = {};
    const effects: ((options: CommandOptions) => any)[] = [];

    // Validate options
    for (const option of options) {
        await registerOption(option, findCommandOption(command, option));
    }

    // Auto-complete default options & check missing required options
    for (const definition of command.options) {
        const { defaultValues, name, required } = definition;
        if (name in commandOptions) {
            continue;
        }
        if (defaultValues) {
            // Option has a default value
            await registerOption(
                { name, type: "long", values: await resolve(defaultValues) },
                definition
            );
        } else if (required) {
            // Option is required
            throw new LocalError(`missing required option: ${name}`);
        }
    }

    // Apply option effects
    for (const effect of effects) {
        await effect(commandOptions);
    }

    // Aggregate option values
    const args: string[] = (await resolve(command.defaultArgs)) || [];
    for (const option of Object.values(commandOptions)) {
        if (option.definition?.flag) {
            args.push(option.definition.flag, option.values.join(","));
        }
    }

    if (commandOptions.port) {
        await stopProcessesOnPorts(commandOptions.port.values);
    }

    // Run command
    await command.handler(commandOptions, args);
};

const parseArguments = (args: string[]): [CommandOption[], string[]] => {
    const options: CommandOption[] = [];
    const remaining: string[] = [];
    for (const arg of args) {
        let match;
        if ((match = arg.match(R_SHORT_MATCH))) {
            options.push({ name: match[1], type: "short", values: [] });
        } else if ((match = arg.match(R_FULL_MATCH))) {
            options.push({ name: match[1], type: "long", values: [] });
        } else {
            if (options.length) {
                addValueToOption(options.at(-1)!, arg);
            } else {
                remaining.push(arg);
            }
        }
    }
    return [options, remaining];
};

const stopProcessesOnPorts = async (ports: string[]) => {
    const strPorts = [...ports].sort().join(",");
    try {
        await execProcess(`lsof -ti :${strPorts} | xargs kill -9`);
        logger.info(`terminated existing processes listening on port(s): ${strPorts}`);
    } catch {
        // Command failed: (probably) due to no pIds found
    }
};

try {
    await main();
} catch (err) {
    if (err instanceof LocalError) {
        // Errors caught by this script
        logger.error(err.message);
    } else {
        throw err;
    }
}
