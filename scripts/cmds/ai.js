import fs from "fs";
import path from "path";
import Cerebras from "@cerebras/cerebras_cloud_sdk";
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let noPrefux = ["sypher", "ai", "bot", "lance"];

const settingsFile = path.join(__dirname, "ai_model.json");

const historyFile = path.join(__dirname, "ai_history.json");

const AVAILABLE_MODELS = [
    "llama3.1-8b",
    "llama-3.3-70b",
    "llama-4-scout-17b-16e-instruct"
];

const client = new Cerebras({
    apiKey: "csk-prcc628w42cc6jhjn48n5pe8xwhyyd26tteyek8x4dy8dpf6",
    warmTCPConnection: false
});

function ensureFile(file, defObj) {
    if (!fs.existsSync(file))
        fs.writeFileSync(file, JSON.stringify(defObj, null, 2));
}

function loadModel() {
    ensureFile(settingsFile, { model: AVAILABLE_MODELS[1] });
    try {
        return JSON.parse(fs.readFileSync(settingsFile, "utf8"));
    } catch {
        fs.writeFileSync(
            settingsFile,
            JSON.stringify({ model: AVAILABLE_MODELS[1] }, null, 2)
        );
        return { model: AVAILABLE_MODELS[1] };
    }
}

function saveModel(model) {
    fs.writeFileSync(settingsFile, JSON.stringify({ model }, null, 2));
}

function loadHistory(uid) {
    ensureFile(historyFile, {});
    try {
        const all = JSON.parse(fs.readFileSync(historyFile, "utf8") || "{}");
        all[uid] ||= [];
        return all;
    } catch {
        fs.writeFileSync(historyFile, JSON.stringify({}, null, 2));
        return {};
    }
}

function saveHistory(uid, historyArr) {
    ensureFile(historyFile, {});
    const all = JSON.parse(fs.readFileSync(historyFile, "utf8") || "{}");
    all[uid] = historyArr;
    fs.writeFileSync(historyFile, JSON.stringify(all, null, 2));
}

function resetHistory(uid) {
    const all = loadHistory(uid);
    all[uid] = [];
    fs.writeFileSync(historyFile, JSON.stringify(all, null, 2));
}

function normalizeCommand(body) {
    if (!body) return { usedPrefix: null, prompt: "" };
    const lower = body.toLowerCase();
    const used = noPrefux.find(p => lower.startsWith(p));
    if (!used) return { usedPrefix: null, prompt: "" };
    const prompt = body.substring(used.length).trim();
    return { usedPrefix: used, prompt };
}

async function callCerebrasChat({ model, messages, stream = false }) {
    const resp = await client.chat.completions.create({
        model,
        messages,
        stream
    });
    if (stream) {
        let full = "";
        for await (const chunk of resp) {
            const delta = chunk?.choices?.[0]?.delta?.content;
            if (delta) full += delta;
        }
        return full || "";
    }
    return resp?.choices?.[0]?.message?.content || "";
}

export default {
    config: {
        name: "ai",
        version: "2.0.1",
        role: 0,
        category: "AI",
        author: "lance",
        description:
            "Smart AI using Cerebras models with per-user chat history, reply chaining, and quick model switching."
    },

    onRun: async function () {},

    onChat: async function ({
        senderID,
        threadID,
        args,
        message,
        event,
        sock
    }) {
        const body = args;
        if (!body) return;

        const lower = body.toLowerCase();
        const uid = senderID;

        if (lower === "ai -set:1") {
            saveModel(AVAILABLE_MODELS[0]);
            return await message.reply(
                `✅ AI model has been set to "${AVAILABLE_MODELS[0]}".`
            );
        }
        if (lower === "ai -set:2") {
            saveModel(AVAILABLE_MODELS[1]);
            return await message.reply(
                `✅ AI model has been set to "${AVAILABLE_MODELS[1]}".`
            );
        }
        if (lower === "ai -set:3") {
            saveModel(AVAILABLE_MODELS[2]);
            return await message.reply(
                `✅ AI model has been set to "${AVAILABLE_MODELS[2]}".`
            );
        }
        if (["ai clear", "sypher clear", "bot clear"].includes(lower)) {
            resetHistory(uid);
            return await message.reply("🧹 Chat history cleared for you.");
        }

        if (
            ["ai my details", "sypher my details", "bot my details"].includes(
                lower
            )
        ) {
            return await message.reply(
                `👤 Your Details:\n• UID: ${uid}\n• Name: ${senderID}\n• Prefix Used: ${noPrefux.join(
                    ", "
                )}`
            );
        }

        const { usedPrefix, prompt } = normalizeCommand(body);
        if (!usedPrefix) return;
        if (!prompt) {
            const greetings = [
                "👑 sypher ai here! Ask me anything.",
                "🌟 Hi! Ready to chat?",
                "💡 Say something and I’ll respond!",
                "✨ What shall we explore today?"
            ];
            const random =
                greetings[Math.floor(Math.random() * greetings.length)];
            return await message.reply(random);
        }

        const thinking = await message.reply("🧠 Thinking...");
        const { model } = loadModel();

        try {
            const all = loadHistory(uid);
            const historyArr = all[uid];

            historyArr.push({ role: "user", content: prompt });
            saveHistory(uid, historyArr);

            const replyText =
                (await callCerebrasChat({
                    model,
                    messages: historyArr,
                    stream: false
                })) || "❌ No response found.";

            historyArr.push({ role: "assistant", content: replyText });
            saveHistory(uid, historyArr);

            await sock.sendMessage(threadID, {
                text: replyText,
                edit: thinking.key
            });

            global.client.replies.set(thinking.key.id, {
                commandName: "ai",
                messageID: thinking.key.id,
                author: senderID
            });
        } catch (err) {
            await sock.sendMessage(threadID, {
                text: "⚠️ Error! Try again later.",
                edit: thinking.key
            });
        }
    },

    onReply: async function ({
        sock,
        message,
        event,
        data,
        args,
        threadID,
        senderID
    }) {
        if (!data || senderID !== data.author) return;

        const userText = args;
        if (!userText) return;

        const uid = senderID;
        const thinking = await message.reply("🧠 Thinking...");

        try {
            const { model } = loadModel();
            const all = loadHistory(uid);
            const historyArr = all[uid];

            historyArr.push({ role: "user", content: userText });
            saveHistory(uid, historyArr);

            const replyText =
                (await callCerebrasChat({
                    model,
                    messages: historyArr,
                    stream: false
                })) || "❌ No response found.";

            historyArr.push({ role: "assistant", content: replyText });
            saveHistory(uid, historyArr);

            await sock.sendMessage(threadID, {
                text: replyText,
                edit: thinking.key
            });

            global.client.replies.set(thinking.key.id, {
                commandName: "ai",
                messageID: thinking.key.id,
                author: senderID
            });
        } catch (err) {
            await sock.sendMessage(threadID, {
                text: "⚠️ Error! Try again later.",
                edit: thinking.key
            });
        }
    }
};
