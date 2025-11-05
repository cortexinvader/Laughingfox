import fs from "fs";
import path from "path";
import utils from "../../utils/utils.js";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import os from "os";
import axios from "axios";

export default {
    config: {
        name: "imgbb",
        cooldown: 10,
        aliase: ["img", "imgbb"],
        description: "Upload an image to imgbb and get a link (supports image URL or replied media).",
        category: "media",
        usage: `${global.client.config.PREFIX}imgbb <image url> (or reply to an image/video/sticker)`
    },

    async onRun({ sock, event, args }) {
        const chatId = event.key.remoteJid;
        const quoted = event.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        let buffer = null;
        let ext = "jpg";
        let sourceUrl = null;

        try {
            const maybeUrl = args[0]?.trim();
            const isUrl = typeof maybeUrl === "string" && /^https?:\/\/\S+/i.test(maybeUrl);

            if (isUrl) {
                const res = await axios.get(maybeUrl, { responseType: "arraybuffer", timeout: 15000 });
                buffer = Buffer.from(res.data);
                const ct = res.headers["content-type"] || "";
                if (ct.includes("png")) ext = "png";
                else if (ct.includes("webp")) ext = "webp";
                else if (ct.includes("gif")) ext = "gif";
                else if (ct.includes("mp4") || ct.includes("video")) ext = "mp4";
                else ext = "jpg";
                sourceUrl = maybeUrl;
            } else if (quoted && (quoted.imageMessage || quoted.videoMessage || quoted.stickerMessage)) {
                if (quoted.imageMessage) {
                    buffer = await downloadMediaMessage({ message: { imageMessage: quoted.imageMessage } }, "buffer");
                    ext = "jpg";
                } else if (quoted.videoMessage) {
                    buffer = await downloadMediaMessage({ message: { videoMessage: quoted.videoMessage } }, "buffer");
                    ext = "mp4";
                } else if (quoted.stickerMessage) {
                    buffer = await downloadMediaMessage({ message: { stickerMessage: quoted.stickerMessage } }, "buffer");
                    ext = quoted.stickerMessage.isAnimated ? "gif" : "webp";
                }
            } else {
                return await sock.sendMessage(chatId, { text: "Reply to an image/video/sticker or provide a direct image URL." }, { quoted: event });
            }

            const tmpFileName = `imgbb_upload_${Date.now()}.${ext}`;
            const tmpFilePath = path.join(os.tmpdir(), tmpFileName);
            fs.writeFileSync(tmpFilePath, buffer);

            const result = await utils.uploadToImgbb(tmpFilePath);

            try { fs.unlinkSync(tmpFilePath); } catch {}

            if (!result || !result.url) {
                return await sock.sendMessage(chatId, { text: "Upload failed. Please try again later." }, { quoted: event });
            }

            const imageUrl = sourceUrl || result.url;
            const title = "Image uploaded to ImgBB";
            const body = "Click to view or download the image";
            const caption = [
                "✨ Image uploaded successfully!",
                `🔗 Link: ${result.url}`,
                `🖼️ Preview below — tap to open.`,
            ].join("\n");

            await sock.sendMessage(chatId, {
                image: { url: imageUrl },
                caption,
            }, {
                quoted: event,
                contextInfo: {
                    externalAdReply: {
                        showAdAttribution: true,
                        mediaType: 2,
                        title,
                        body,
                        sourceUrl: result.url,
                        thumbnailUrl: imageUrl
                    }
                }
            });
        } catch (error) {
            try { await sock.sendMessage(chatId, { text: `Error: ${error.message || error}` }, { quoted: event }); } catch {}
        }
    }
};
