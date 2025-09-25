import { spawn } from "child_process";
import log from "./utils/log.js";
import { dirname } from "path";
import { fileURLToPath } from "url";
import autoRestart from "./utils/autoRestart.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function start() {
    autoRestart()
    const bot = spawn("node", ["fox.js"], {
        cwd: __dirname,
        stdio: "inherit"
    });

    bot.on("close", code => {
        if (code === 2) {
            log.info("Bot is restarting.");
            start();
        }
    });

    bot.on("error", err => {
        log.error(`Error starting bot: ${err.message}`);
    });
}

start();
