import { readdir, readFile, stat, writeFile } from "fs/promises";
import { join, sep } from "path";
import { Command } from "./command";
import { LocalError } from "./constants";
import { logger } from "./logger";
import { $ } from "./process";

async function editMemorySources(sourceFilePath: string) {
    logger.info("Opening source file for editing");
    try {
        await $`code ${sourceFilePath}`;
        return;
    } catch {}
    try {
        await $`codium ${sourceFilePath}`;
        return;
    } catch {}
    try {
        await $`nano ${sourceFilePath}`;
        return;
    } catch {}
}

async function fetchSources(
    sources: Record<string, string>,
    logsDir: string,
    allowMobile: boolean,
    data: Record<string, [label: string, used: number][]> = {}
) {
    await Promise.all(
        Object.entries(sources).map(async ([label, url]) => {
            let content;
            if (R_URL.test(url)) {
                // Fetch source from URL
                logger.debug(`Fetching memory logs from URL:`, url);
                const dest = join(logsDir, normalizeFileName(label));
                await $`wget -O ${dest} ${url}`;
                content = await readFile(dest, "utf-8");
            } else {
                const pathStat = await stat(url);
                if (pathStat.isDirectory()) {
                    // Fetch source from folder
                    logger.debug(`Reading memory logs from folder:`, url);
                    const fileNames = await readdir(url);
                    const labeledFileNames: Record<string, string> = Object.fromEntries(
                        fileNames.map((fname) => [fname, join(url, fname)])
                    );
                    return fetchSources(labeledFileNames, logsDir, allowMobile, data);
                } else {
                    // Fetch source from file
                    logger.debug(`Reading memory logs from file:`, url);
                    content = await readFile(url, "utf-8");
                }
            }

            // Prepare source content
            const formattedContent = content
                .replaceAll(/(^.*?\[MEMINFO\] @.*$\n)|(^.*$\n)/gm, "$1")
                .replaceAll(/[,"]/gm, "")
                .replaceAll(R_MEMINFO, "$<label>,$<used>,$<suite>");

            // Map & filter rows
            const rows: [string, number][] = [];
            for (const line of formattedContent.split("\n")) {
                let [label, used, suite] = line.split(",");
                if (!label) {
                    continue;
                }
                const isMobile = suite === MOBILE_SUITE;
                if (isMobile) {
                    if (!allowMobile) {
                        continue;
                    }
                    label = `${label} (mobile)`;
                }
                rows.push([label, Number(used)]);
            }
            if (rows.length) {
                logger.debug("Got", rows.length, "memory reading from source:", url);
            } else {
                logger.warn(`Memory log source "${url}" is empty`);
            }
            data[label] = rows;
        })
    );
    return data;
}

function normalizeFileName(fname: string) {
    return fname
        .trim()
        .toLowerCase()
        .replaceAll(R_ESCAPED_FILE_NAME_SEPARATOR, "_")
        .replaceAll(R_NON_ALPHANUM, "")
        .slice(0, 255);
}

/**
 * Get source paths from a source file
 * @param sourceFilePath
 */
async function parseSourceFile(sourceFilePath: string) {
    const sourceContent = await readFile(sourceFilePath, "utf-8");
    const sources: Record<string, string> = {};
    for (const line of sourceContent.split("\n")) {
        const buildSpec = line.trim();
        if (!buildSpec || R_SOURCE_COMMENT.test(buildSpec)) {
            continue;
        }
        let [label, ...urlParts] = buildSpec.split(R_LABEL_SEPARATOR);
        let url: string;
        if (urlParts.length) {
            url = urlParts.join("=");
        } else {
            url = label;
            label = "";
        }
        if (!label) {
            const buildNameMatch = url.match(R_BUILD_NAME);
            if (buildNameMatch) {
                label = buildNameMatch[1];
            } else {
                const urlSep = url.includes(sep) ? sep : "/";
                label = url.split(urlSep).at(-1) || "";
            }
        }
        label ||= `Build url #${Object.keys(sources).length + 1}`;
        sources[unquote(label)] = url;
    }
    return sources;
}

function unquote(string: string) {
    return R_DOUBLE_QUOTES.test(string) || R_SINGLE_QUOTES.test(string)
        ? string.slice(1, -1)
        : string;
}

const MOBILE_SUITE = ".MobileWebSuite";

const R_BUILD_NAME = /build\/(.*)\/logs/g;
const R_DOUBLE_QUOTES = /^".*"$/;
const R_ESCAPED_FILE_NAME_SEPARATOR = /[\s.\/:;#@-]+/g;
const R_LABEL_SEPARATOR = /\s*=\s*/;
const R_MEMINFO =
    /.*(?<suite>\.(Mobile)?WebSuite).*: \[MEMINFO\] (?<label>.+) \(after GC\) - used: (?<used>\d+) - total: (?<total>\d+) - limit: (?<limit>\d+)( - tests: (?<tests>\d+))?.*/gm;
const R_NON_ALPHANUM = /\W/g;
const R_SINGLE_QUOTES = /^'.*'$/;
const R_SOURCE_COMMENT = /^[#;]/;
const R_URL = /^https?:\/\//;

export async function parseMemoryLogs({ options }: Command, args: string[]) {
    const sourceFilePath = join(__dirname, "..", ...options.sources.values);
    if (options.edit) {
        return editMemorySources(sourceFilePath);
    }

    if (!options.open) {
        const logsDir = join(__dirname, "..", ...options["logs-dir"].values);
        const outputDir = join(__dirname, "..", ...options["output-dir"].values);

        // generate label if not provided
        const sources = await parseSourceFile(sourceFilePath);
        const sourceCount = Object.keys(sources).length;
        if (!sourceCount) {
            throw new LocalError(`Failed to parse: no sources specified in ${sourceFilePath}`);
        }

        logger.info("Parsing memory data from", sourceCount, "sources");
        const data = await fetchSources(sources, logsDir, !!options.mobile);

        // generate csv and json file
        const csv: Record<string, string[]> = {};
        if (options.csv) {
            csv["Suite"] = Object.keys(data);
        }
        const jsonData: Record<string, Record<string, number>> = {};
        for (const [label, rows] of Object.entries(data)) {
            for (const row of rows) {
                const [suite, used] = row;
                jsonData[suite] ||= {};
                jsonData[suite][label] = used;
                if (options.csv) {
                    csv[suite] ||= [];
                    csv[suite].push(String(used));
                }
            }
        }

        const jsonDataList = Object.entries(jsonData).map(([suite, data]) => ({ suite, ...data }));
        const stringifiedData = JSON.stringify(jsonDataList, null, 4);
        const jsDest = join(outputDir, "data.js");
        const jsContent = /* js */ `((win) => { win.LOG_DATA = ${stringifiedData}; })(window.top);`;
        logger.debug("Writing JS data to:", jsDest);
        const promises = [writeFile(jsDest, jsContent, "utf-8")];
        if (options.csv) {
            const csvDest = join(outputDir, "data.csv");
            logger.info("Writing CSV data to:", csvDest);
            const strCsv = Object.entries(csv)
                .map(([firstCol, columns]) => [firstCol, ...columns].join(","))
                .join("\n");
            promises.push(writeFile(csvDest, strCsv, "utf-8"));
        }
        logger.debug("Writing output files to folder:", outputDir);
        await Promise.all(promises);
    }

    if (options.browser || options.open) {
        logger.info("Opening graph view in browser");
        await $`open ${join(__dirname, "..", "memory_data", "index.html")}`;
    }
}
