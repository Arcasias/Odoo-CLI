import { registerCommand } from "../command";
import { start } from "../utils";

registerCommand({
    name: "shell",
    short: "sh",
    options: [
        "*",
        {
            port: { defaultValues: ["8070"] },
        },
    ],
    defaultArgs: ["shell"],
    handler: start,
});
