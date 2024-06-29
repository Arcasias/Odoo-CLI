import { registerCommand } from "../command";
import { create } from "../utils";

registerCommand({
    name: "create",
    options: ["*", "start"],
    handler: create,
});
