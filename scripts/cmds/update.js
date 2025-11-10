import axios from "axios";
import fs from "fs-extra";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import AdmZip from "adm-zip";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');


const CORE_PATHS = [
    'scripts',
    'utils',
    'handler',
    'cache',
    'fox.js',
    'index.js',
    'package.json'
];

export default {
    config: {
        name: "update",
        aliase: ["upd", "upgrade"],
        version: "1.0",
        author: "lance",
        countDown: 20,
        role: 1,
        description: "Update bot files",
        category: "admin",
        guide: "{p}update"
    },

    async onRun({ sock, event, args }) {
        const chatId = event.key.remoteJid;

        try {
            const confirmMsg = await sock.sendMessage(chatId, {
                text: "⚠️ This will update all files and even delete files make sure to back them up before updating\n\nConfig.json will be preserved.\n\nReact with 👍 to continue or 👎 to cancel."
            });

            global.client.reactions.set(confirmMsg.key.id, {
                commandName: this.config.name,
                action: "update",
                chatId: chatId,
                id: confirmMsg.key.id
            });

        } catch (error) {
            console.error("Update error:", error);
            await sock.sendMessage(chatId, {
                text: `❌ Update failed: ${error.message}`
            });
        }
    },

    async onReaction({ sock, emoji, threadID, data }) {
        if (data.commandName !== this.config.name || data.action !== "update") return;

        let configBackup = null;
        let tempDir = null;
        let zipPath = null;

        try {
            if (emoji === '👍') {
                await sock.sendMessage(threadID, { text: "🔄 Starting update process..." });

                const configPath = path.join(rootDir, "config.json");
                configBackup = await fs.readFile(configPath, 'utf8');
                await sock.sendMessage(threadID, { text: "📦 Backing up config.json..." });

                tempDir = path.join(rootDir, "temp_update");
                await fs.ensureDir(tempDir);

                await sock.sendMessage(threadID, { text: "⬇️ Downloading latest version..." });
                
                const zipUrl = "https://github.com/lance-ui/Laughingfox/archive/refs/heads/main.zip"
                
                const response = await axios({
                    method: 'GET',
                    url: zipUrl,
                    responseType: 'stream'
                });

                zipPath = path.join(tempDir, "update.zip");
                const writer = fs.createWriteStream(zipPath);
                
                await new Promise((resolve, reject) => {
                    response.data.pipe(writer);
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });

                await sock.sendMessage(threadID, { text: "📂 Extracting files..." });

                const zip = new AdmZip(zipPath);
                zip.extractAllTo(tempDir, true);

                const extractedDir = (await fs.readdir(tempDir)).find(
                    f => fs.statSync(path.join(tempDir, f)).isDirectory()
                );

                if (!extractedDir) {
                    throw new Error("Could not find extracted directory");
                }

                const sourceDir = path.join(tempDir, extractedDir);

                await sock.sendMessage(threadID, { text: "🔄 Updating core files..." });
                
                for (const corePath of CORE_PATHS) {
                    const sourcePath = path.join(sourceDir, corePath);
                    const targetPath = path.join(rootDir, corePath);
                    
                    if (await fs.pathExists(sourcePath)) {
                        if (await fs.pathExists(targetPath)) {
                            await fs.remove(targetPath);
                        }
                        await fs.copy(sourcePath, targetPath);
                    }
                }

                await sock.sendMessage(threadID, { text: "🔄 Restoring config.json..." });
                await fs.writeFile(configPath, configBackup);

                if (zipPath && await fs.pathExists(zipPath)) {
                    await fs.unlink(zipPath);
                }
                if (tempDir && await fs.pathExists(tempDir)) {
                    await fs.remove(tempDir);
                }

                await sock.sendMessage(threadID, {
                    text: "✅ Update completed successfully!\n\n" +
                          "Updated files/folders:\n" +
                          CORE_PATHS.join('\n') +
                          "\n\nPlease restart the bot to apply changes."
                });

            } else if (emoji === '👎') {
                await sock.sendMessage(threadID, { text: "❌ Update cancelled." });
            }

        } catch (error) {
            console.error("Update error:", error);
            await sock.sendMessage(threadID, {
                text: `❌ Update failed: ${error.message}`
            });

            if (configBackup) {
                try {
                    const configPath = path.join(rootDir, "config.json");
                    await fs.writeFile(configPath, configBackup);
                    await sock.sendMessage(threadID, {
                        text: "🔄 Config.json has been restored to prevent data loss."
                    });
                } catch (err) {
                    console.error("Config restoration error:", err);
                }
            }
        } finally {
            if (zipPath && await fs.pathExists(zipPath)) {
                await fs.unlink(zipPath);
            }
            if (tempDir && await fs.pathExists(tempDir)) {
                await fs.remove(tempDir);
            }
            global.client.reactions.delete(data.id);
        }
    }
};
