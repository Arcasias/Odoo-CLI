import { registerCommand } from "../command";
import { start } from "../utils";

registerCommand({
    name: "test",
    options: [
        "*",
        {
            tags: {
                alt: ["tag", "test-tags", "test-tag"],
                flag: "--test-tags",
            },
        },
    ],
    defaultArgs: ["--log-level", "test", "--stop-after-init", "--test-enable"],
    handler: start,
});
