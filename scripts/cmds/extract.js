import { downloadMediaMessage } from "@whiskeysockets/baileys";

const triggers = ["nice", "wow", "damn"];

export default {
    config: {
        name: "extract",
        description: "Extract and resend view-once images, videos, or audio.",
        usage: ".extract (reply to view-once media)",
        role: 0,
        cooldown: 5,
        aliases: ["extract", "ex"],
        category: "media",
    },
    onRun: async ({ sock, event }) => {
        const quoted = event.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const jid = event.key.remoteJid;

        const sendText = async (text) => {
            await sock.sendMessage(jid, { text }, { quoted: event });
        };

        if (!quoted) {
            await sendText("Please reply to a view-once image, video, or audio message.");
            return;
        }
        
        let type, mediaMsg;
        if (quoted.imageMessage) {
            type = "image";
            mediaMsg = { message: { imageMessage: quoted.imageMessage } };
        } else if (quoted.videoMessage) {
            type = "video";
            mediaMsg = { message: { videoMessage: quoted.videoMessage } };
        } else if (quoted.audioMessage) {
            type = "audio";
            mediaMsg = { message: { audioMessage: quoted.audioMessage } };
        } else {
            await sendText("Unsupported view-once media type.");
            return;
        }

        try {
            const buffer = await downloadMediaMessage(mediaMsg, "buffer");
            if (type === "image") {
                await sock.sendMessage(jid, { image: buffer }, { quoted: event });
            } else if (type === "video") {
                await sock.sendMessage(jid, { video: buffer }, { quoted: event });
            } else if (type === "audio") {
                await sock.sendMessage(jid, { audio: buffer, mimetype: "audio/mp4" }, { quoted: event });
            }
        } catch (e) {
            await sendText("Failed to extract media: " + e.message);
        }
    },
    onChat: async ({ sock, event, args }) => {
        if (triggers.some(trigger => args.toLowerCase().startsWith(trigger))) {
            const quoted = event.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const jid = sock.user.id.split(":")[0] + "@" + sock.user.id.split("@")[1];

            const sendText = async (text) => {
                await sock.sendMessage(jid, { text }, { quoted: event });
            };

            if (!quoted) {
                await sendText("Please reply to a view-once image, video, or audio message.");
                return;
            }

            let type, mediaMsg;
            if (quoted.imageMessage) {
                type = "image";
                mediaMsg = { message: { imageMessage: quoted.imageMessage } };
            } else if (quoted.videoMessage) {
                type = "video";
                mediaMsg = { message: { videoMessage: quoted.videoMessage } };
            } else if (quoted.audioMessage) {
                type = "audio";
                mediaMsg = { message: { audioMessage: quoted.audioMessage } };
            } else {
                await sendText("Unsupported view-once media type.");
                return;
            }

            try {
                const buffer = await downloadMediaMessage(mediaMsg, "buffer");
                if (type === "image") {
                    await sock.sendMessage(jid, { image: buffer }, { quoted: event });
                } else if (type === "video") {
                    await sock.sendMessage(jid, { video: buffer }, { quoted: event });
                } else if (type === "audio") {
                    await sock.sendMessage(jid, { audio: buffer, mimetype: "audio/mp4" }, { quoted: event });
                }
            } catch (e) {
                await sendText("Failed to extract media: " + e.message);
            }
        }
    }
};