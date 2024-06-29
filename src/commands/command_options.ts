import type { CommandOptionDefinition, CommandOptions } from "../command";
import { ADDON_PATHS, setDebug } from "../constants";
import { getDefaultDbName, parseAddons } from "../utils";

const addonsPathOption: CommandOptionDefinition = {
    name: "addons-path",
    alt: ["path", "paths"],
    flag: "--addons-path",
    defaultValues: Object.values(ADDON_PATHS),
};

const addonsOption: CommandOptionDefinition = {
    name: "addons",
    short: "i",
    alt: ["addon", "module", "modules"],
    flag: "--init",
    parse: parseAddons,
};

const communityOption: CommandOptionDefinition = {
    name: "community",
    alt: ["com"],
    effect(options: CommandOptions) {
        const pathOption = options["addons-path"];
        if (pathOption) {
            pathOption.values = [ADDON_PATHS.community];
        }
    },
};

const databaseOption: CommandOptionDefinition = {
    name: "database",
    short: "d",
    flag: "--database",
    defaultValues: getDefaultDbName,
};

const debugOption: CommandOptionDefinition = {
    autoInclude: true,
    name: "debug",
    effect: () => setDebug(true),
};

const devOption: CommandOptionDefinition = {
    name: "dev",
    flag: "--dev",
    defaultValues: ["all"],
};

const portOption: CommandOptionDefinition = {
    name: "port",
    short: "p",
    flag: "--http-port",
    defaultValues: ["8069"],
};

const templateOption: CommandOptionDefinition = {
    name: "template",
    short: "t",
    flag: "--db_template",
};

const updateOption: CommandOptionDefinition = {
    name: "update",
    short: "u",
    flag: "--update",
    parse: parseAddons,
};

const userOption: CommandOptionDefinition = {
    name: "user",
    short: "r",
    flag: "--db_user",
};

const ALL_OPTIONS = Object.fromEntries(
    [
        addonsPathOption,
        addonsOption,
        communityOption,
        databaseOption,
        debugOption,
        devOption,
        portOption,
        templateOption,
        updateOption,
        userOption,
    ].map((option) => [option.name, option])
);

export const parseOptions = (
    ...specs: (
        | string
        | Record<string, Partial<CommandOptionDefinition> | null>
        | [string, Partial<CommandOptionDefinition> | null]
    )[]
) => {
    const result: Record<string, CommandOptionDefinition> = {};
    while (specs.length) {
        const spec = specs.shift()!;
        const specObject = typeof spec === "string" ? ([spec, null] as [string, null]) : spec;
        if (!Array.isArray(specObject)) {
            specs.unshift(...Object.entries(specObject));
            continue;
        }
        if (specObject[0] === "*") {
            specs.unshift(...Object.keys(ALL_OPTIONS));
            continue;
        }
        const [name, override] = specObject;
        result[name] = {
            ...(result[name] ?? ALL_OPTIONS[name]),
            ...override,
            name,
        };
    }
    return Object.values(result);
};
