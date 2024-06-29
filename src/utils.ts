import { readdir, stat } from "fs/promises";
import { join } from "path";
import { CommandOptions } from "./command";
import {
    ADDON_PACKS,
    ADDON_PATHS,
    BIN_PATH,
    LocalError,
    MANIFEST_FILE_NAME,
    R_VALID_MODULE_NAME,
} from "./constants";
import { logger } from "./logger";
import { execProcess, spawnProcess } from "./process";

export type Resolver<T> = T | (() => T | PromiseLike<T>);

const getPathModules = async (path: string) => {
    const pathModules: Set<string> = new Set();
    const items = await readdir(path);
    await Promise.all(
        items.map(async (item) => {
            if (!R_VALID_MODULE_NAME.test(item)) {
                return; // invalid module name
            }
            const fullItemPath = join(path, item);
            const itemStat = await stat(fullItemPath);
            if (!itemStat.isDirectory()) {
                return; // not a directory
            }
            const itemContent = await readdir(fullItemPath);
            if (!itemContent.includes(MANIFEST_FILE_NAME)) {
                return; // no manifest
            }
            pathModules.add(item);
        })
    );
    return [...pathModules].sort();
};

const getValidAddons = async () => {
    let values = Object.values(registeredModules);
    if (!values.length) {
        await Promise.all(
            Object.values(ADDON_PATHS).map(async (path) => {
                registeredModules[path] = await getPathModules(path);
            })
        );
        values = Object.values(registeredModules);
    }
    return values.flat();
};

const R_BRANCH_DATABASE = /^(\d+\.\d|saas-\d+\.\d|master)/;

const registeredModules: Record<string, string[]> = {};

export async function create(options: CommandOptions, args: string[]) {
    // Drop
    await drop(options, args);
    if (options.start) {
        // Autostart
        await start(options, args);
    } else {
        // Create
        await spawnProcess(["createdb", ...options.database.values], { ignoreFail: true });
    }
}

export async function drop(options: CommandOptions, args: string[]) {
    await spawnProcess(["dropdb", "-f", ...options.database.values], { ignoreFail: true });
}

export async function parseAddons(addonsValue: string[]) {
    const addons: string[] = [];
    const invalidAddons = [];
    const validAddons = await getValidAddons();
    for (const addon of addonsValue.flatMap((v) => v.trim().split(/\s*,\s*/g))) {
        if (addon === "all") {
            return validAddons.filter(
                (addon) => !addon.startsWith("l10n_") || addon.startsWith("l10n_be")
            );
        }
        const addedModules = addon in ADDON_PACKS ? ADDON_PACKS[addon] : [addon];
        for (const addon of addedModules) {
            if (validAddons.includes(addon)) {
                addons.push(addon);
            } else {
                invalidAddons.push(addon);
            }
        }
    }
    if (invalidAddons.length) {
        logger.info(registeredModules);
        throw new LocalError(
            `Invalid addons: ${invalidAddons.map((addon) => JSON.stringify(addon)).join(", ")}`
        );
    }
    return addons;
}

export function resolve<T>(value: Resolver<T>): T | Promise<T> {
    return typeof value === "function" ? (value as () => T | Promise<T>)() : value;
}

export function start(options: CommandOptions, args: string[]) {
    return spawnProcess(["python3", BIN_PATH, ...args]);
}

export async function getDefaultDbName() {
    const branch = await execProcess("cd ~/odoo && git rev-parse --abbrev-ref HEAD");
    return [branch.match(R_BRANCH_DATABASE)?.[1] || "dev"];
}
