import { registerCommand } from "../command";
import { drop } from "../utils";

registerCommand({
    name: "drop",
    options: [
        "debug",
        {
            database: {
                defaultValues: undefined,
                required: true,
            },
        },
    ],
    handler: drop,
});
