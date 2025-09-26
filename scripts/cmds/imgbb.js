import fs from "fs";
import path from "path";
import utils from "../../utils/utils.js";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import os from "os";

export default {
    config: {
        name: "imgbb",
        cooldown: 10,
        aliase: ["img", "imgbb"],
        description: "Upload an image to imgbb and get a link.",
        category: "media",
        usage: `${global.client.config.PREFIX}imgbb <image file path>`
    },

    async onRun({ sock, event, args }) {
        const chatId = event.key.remoteJid;
        const quoted = event.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        let buffer, ext = "jpg";
        if (quoted && quoted.imageMessage) {
            buffer = await downloadMediaMessage({ message: { imageMessage: quoted.imageMessage } }, "buffer");
            ext = "jpg";
        } else if (quoted && quoted.videoMessage) {
            buffer = await downloadMediaMessage({ message: { videoMessage: quoted.videoMessage } }, "buffer");
            ext = "mp4";
        } else if (quoted && quoted.stickerMessage && quoted.stickerMessage.isAnimated === false) {
            buffer = await downloadMediaMessage({ message: { stickerMessage: quoted.stickerMessage } }, "buffer");
            ext = "webp";
        } else {
            return await sock.sendMessage(
                chatId,
                { text: "Please reply to an image, video, or sticker message to upload to imgbb." },
                { quoted: event }
            );
        }

        // Save buffer to temp file
        const tmpFileName = `imgbb_upload_${Date.now()}.${ext}`;
        const tmpFilePath = path.join(os.tmpdir(), tmpFileName);
        fs.writeFileSync(tmpFilePath, buffer);

        try {
            const result = await utils.uploadToImgbb(tmpFilePath);
            console
            if (result && result.url) {
                await sock.sendMessage(
                    chatId,
                    { text: `Image uploaded successfully!\nURL: ${result.url}` },
                    { quoted: event }
                );
            } else {
                await sock.sendMessage(
                    chatId,
                    { text: `Failed to upload image. Please try again later.` },
                    { quoted: event }
                );
            }
        } catch (error) {
            await sock.sendMessage(
                chatId,
                { text: `Error uploading image: ${error.message}` },
                { quoted: event }
            );
        } finally {
            fs.unlinkSync(tmpFilePath);
        }
    }
};
