import { parseOptions } from "./commands/command_options";
import { LocalError } from "./constants";
import { Resolver } from "./utils";

export interface CommandDefinition {
    name: string;
    short?: string;
    defaultArgs?: Resolver<string[]>;
    alt?: string[];
    handler: CommandHandler;
    options?: CommandOptionDefinition[];
}

export interface CommandOption {
    name: string;
    type: CommandOptionType;
    values: string[];
    definition?: CommandOptionDefinition;
}

export interface CommandOptionDefinition {
    autoInclude?: boolean;
    alt?: string[];
    defaultValues?: Resolver<string[]>;
    effect?: (options: CommandOptions) => any;
    flag?: string;
    help?: string;
    name: string;
    parse?: (values: string[]) => string[] | PromiseLike<string[]>;
    required?: boolean;
    short?: string;
}

export type CommandHandler = (options: CommandOptions, args: string[]) => any;
export type CommandOptions = Record<string, CommandOption>;
export type CommandOptionType = "short" | "long";

const commandDefinitions: CommandDefinition[] = [];
const commandOptionDefinitions: CommandOptionDefinition[] = [];

export function addValueToOption(option: CommandOption, ...values: string[]) {
    option.values.push(...values);
}

export function findCommand(name: string) {
    const commandDefinition = commandDefinitions.find(
        (desc) => desc.name === name || desc.short === name
    );
    if (!commandDefinition) {
        throw new LocalError(`unknown command: "${name}"`);
    }
    return {
        ...commandDefinition,
        options: [
            ...(commandDefinition.options || []),
            ...commandOptionDefinitions.filter((option) => option.autoInclude),
        ],
    };
}

export function findCommandOption(
    commandDefinition: CommandDefinition,
    { name, type }: CommandOption
) {
    const commandOption = commandDefinition.options?.find((option) => {
        if (type === "short") {
            return option.short === name;
        } else {
            return option.name === name || option.alt?.includes(name);
        }
    });
    if (!commandOption) {
        throw new LocalError(`unknown option: "${name}" with command "${commandDefinition.name}"`);
    }
    return commandOption;
}

export function registerCommand(
    definition: Omit<CommandDefinition, "options"> & {
        options?: Parameters<typeof parseOptions>;
    }
) {
    commandDefinitions.push({
        ...definition,
        options: parseOptions(...(definition.options || [])),
    });
}
