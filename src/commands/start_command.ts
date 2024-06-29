import { registerCommand } from "../command";
import { start } from "../utils";

registerCommand({
    name: "start",
    options: ["*"],
    handler: start,
});
