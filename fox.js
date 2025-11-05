import dotenv from "dotenv";
import P from "pino";
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, Browsers, DisconnectReason, makeCacheableSignalKeyStore } from "baileys";
import pkg from "baileys";
import utils from "./utils/utils.js";
import path from "path";
import log from "./utils/log.js";
import fs from "fs-extra";
import express from "express";
import messageHandler from "./handler/messagehandler.js";
import handleEvent from "./handler/handleEvent.js";
import db from "./utils/data.js";
import axios from "axios";

dotenv.config();

class BaseBot {
  constructor() {
    this.config = {};
    this.commands = new Map();
    this.reactions = new Map();
    this.events = new Map();
    this.replies = new Map();
    this.cooldowns = new Map();
    this.startTime = Date.now();
    this.aliases = new Map();
  }

  async loadConfig() {
    try {
      const data = await fs.readFile(new URL("./config.json", import.meta.url), "utf-8");
      this.config = JSON.parse(data);
    } catch (error) {
      log.error("Error loading configuration:", error.message);
      throw error;
    }
  }
}

class Msgstore {
  constructor() {
    this.data = { chats: {}, messages: {} };
  }

  bind(ev) {
    ev.on("messages.upsert", ({ messages }) => {
      try {
        for (const msg of messages) {
          const jid = msg.key?.remoteJid || "unknown";
          if (!this.data.messages[jid]) this.data.messages[jid] = [];
          this.data.messages[jid].push(msg);
        }
      } catch (e) {
        console.error(e?.message || e);
      }
    });
  }

  readFromFile(file) {
    try {
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, "utf-8");
        const parsed = JSON.parse(raw || "{}");
        this.data = parsed;
      }
    } catch (e) {
      console.error(e?.message || e);
    }
  }

  writeToFile(file) {
    try {
      fs.ensureDirSync(path.dirname(file));
      fs.writeFileSync(file, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (e) {
      console.error(e?.message || e);
    }
  }

  getMessage(key) {
    try {
      const jid = key?.remoteJid || key?.participant || "unknown";
      const id = key?.id || key?.stanzaId;
      const msgs = this.data.messages[jid] || [];
      return msgs.find(m => m.key?.id === id) || null;
    } catch (e) {
      return null;
    }
  }
}

class WhatsAppBot extends BaseBot {
  constructor() {
    super();
    this.sock = null;
    this.sessionDir = path.join(process.cwd(), "cache", "auth_info_baileys");
    this.store = new Msgstore();
    this.storeFile = path.join(process.cwd(), "cache", "baileys_store.json");
  }

  async loadSession() {
    try {
      if (!this.config.SESSION_ID) {
        throw new Error("Please add your session to SESSION_ID in config!");
      }
      const sessdata = this.config.SESSION_ID.replace("sypher™--", "");
      const response = await axios.get(`https://existing-madelle-lance-ui-efecfdce.koyeb.app/download/${sessdata}`, { responseType: "stream" });
      if (response.status === 404) {
        throw new Error(`File with identifier ${sessdata} not found.`);
      }
      const writer = await fs.createWriteStream(`${this.sessionDir}/creds.json`);
      response.data.pipe(writer);
      return new Promise((resolve, reject) => {
        writer.on("finish", () => {
          log.success("creds file downloaded successfully");
          resolve();
        });
        writer.on("error", () => {
          log.error("failed to download file");
          reject();
        });
      });
    } catch (err) {
      log.error(err.message);
    }
  }

  async connect() {
    const { state } = await useMultiFileAuthState(this.sessionDir);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 2322, 2] }));
    this.sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, P({ level: "fatal" }).child({ level: "fatal" })),
      },
      version,
      printQRInTerminal: false,
      browser: Browsers.macOS("Safari"),
      markOnlineOnConnect: true,
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000,
      retryRequestDelayMs: 5000,
      maxRetries: 5,
      logger: P({ level: "silent" }),
      getMessage: (key) => this.store.getMessage(key),
      syncFullHistory: true,
      generateHighQualityLinkPreview: true,
      patchMessageBeforeSending: (message) => message,
      store: this.store
    });

    this.store.bind(this.sock.ev);

    try {
      await fs.ensureDir(path.dirname(this.storeFile));
      if (fs.existsSync(this.storeFile)) {
        this.store.readFromFile(this.storeFile);
      }
    } catch (err) {
      log.error("Failed to read msgstore file:", err?.message || err);
    }

    setInterval(() => {
      try {
        this.store.writeToFile(this.storeFile);
      } catch (err) {
        log.error("Failed to write msgstore file:", err?.message || err);
      }
    }, 10000);

    this.sock.ev.on("creds.update", utils.saveCreds);

    this.sock.ev.on("connection.update", async update => {
      const { connection, lastDisconnect } = update;
      if (connection === "close" && lastDisconnect?.error?.output?.statusCode === DisconnectReason.restartRequired) {
        setTimeout(() => this.connect(), 10000);
      }
      if (connection === "open") {
        log.success("Connected to WhatsApp");
      }
    });
  }

  async start() {
    await this.loadConfig();
    global.client = {
      config: this.config,
      commands: this.commands,
      reactions: this.reactions,
      events: this.events,
      replies: this.replies,
      cooldowns: this.cooldowns,
      startTime: this.startTime,
      aliases: this.aliases,
    };
    await this.loadSession();
    await this.connect();
    await db.initSQLite();
    global.utils = utils;

    this.sock.ev.on("messages.upsert", async ({ messages, type }) => {
      console.log(messages);
      if (type === "notify") {
        for (const event of messages) {
          await messageHandler({ font: utils.font, event, sock: this.sock, log, proto: pkg.proto });
        }
      }
    });

    this.sock.ev.on("groups.update", async ({ event, update }) => {
      await handleEvent({ sock: this.sock, event, log, font: utils.font, update });
    });

    this.sock.ev.on("group-participants.update", async ({ event, update }) => {
      await handleEvent({ sock: this.sock, event, log, font: utils.font, update });
    });
  }
}

class BotServer {
  constructor(bot) {
    this.bot = bot;
    this.app = express();
  }

  async startServer() {
    this.app.get("/", (req, res) => {
      res.json({ status: "bot is up and running" });
    });

    this.app.listen(this.bot.config.PORT, () => log.info(`Bot running on port ${this.bot.config.PORT}`));
  }
}

async function main() {
  const bot = new WhatsAppBot();
  await bot.start();
  const server = new BotServer(bot);
  await server.startServer();
}

process.on("unhandledRejection", error => console.error("Unhandled Rejection:", error));
process.on("uncaughtException", error => console.error("Uncaught Exception:", error));

main();
