import { Command } from "../command";
import { parseMemoryLogs } from "../memory_processing";

Command.register({
    name: "memory",
    alt: ["mem"],
    options: [
        {
            browser: {
                standalone: true,
            },
            csv: {
                standalone: true,
            },
            edit: {
                short: "e",
                standalone: true,
            },
            ["logs-dir"]: {
                defaultValues: ["memory_data", "logs"],
            },
            mobile: {
                short: "m",
                standalone: true,
            },
            open: {
                short: "o",
                standalone: true,
            },
            ["output-dir"]: {
                defaultValues: ["memory_data", "output"],
            },
            sources: {
                defaultValues: ["memory_data", "runbot_builds.ini"],
            },
        },
    ],
    handler: parseMemoryLogs,
});
