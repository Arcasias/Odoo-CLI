import { exec, spawn } from "child_process";
import { LocalError } from "./constants";
import { logger } from "./logger";

export interface SpawnOptions {
    ignoreFail: boolean;
}

const killChildren = () => {
    while (children.length) {
        children.pop()!.kill();
    }
};

const onExit = (code: number) => {
    killChildren();

    if (code) {
        logger.info(`process terminated with code`, code);
    } else {
        logger.info(`process ended`);
    }
};

const children: ReturnType<typeof spawn>[] = [];

export async function execProcess(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error || stderr) {
                reject(error || stderr);
            }
            resolve(stdout.trim());
        });
    });
}

export function listenOnCloseEvents() {
    process.on("exit", onExit);

    process.on("SIGINT", process.exit); // CTRL+C
    process.on("SIGQUIT", process.exit); // Keyboard quit
    process.on("SIGTERM", process.exit); // `kill` command

    process.on("SIGUSR1", process.exit);
    process.on("SIGUSR2", process.exit);
}

export function spawnProcess(args: string[], options?: SpawnOptions) {
    logger.info(...args);
    const { ignoreFail } = options || {};
    const command = args.shift() || "";
    const child = spawn(command, args, { stdio: ignoreFail ? "ignore" : "inherit" });
    child.stdout?.on("data", console.log);
    if (!ignoreFail) {
        child.stderr?.on("data", console.error);
    }
    children.push(child);
    return new Promise((resolve, reject) => {
        child.on("exit", (code) => {
            if (code && !ignoreFail) {
                throw new LocalError(`${JSON.stringify(command)} process exited with code ${code}`);
            }
            resolve(code);
        });
    });
}
