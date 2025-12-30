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
import NodeCache from "node-cache";

dotenv.config();

const logger = P({ level: "silent" });
const msgRetryCounterMap = new Map();

const msgRetryCounterCache = {
  get: (key) => msgRetryCounterMap.get(key) || 0,
  set: (key, value) => msgRetryCounterMap.set(key, value),
  delete: (key) => msgRetryCounterMap.delete(key),
};

const messageCache = new NodeCache({ stdTTL: 300, checkperiod: 600, useClones: false });
const mutationCache = new NodeCache({ stdTTL: 300, checkperiod: 60, useClones: false, maxKeys: 1000 });

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
    const data = await fs.readFile(new URL("./config.json", import.meta.url), "utf-8");
    this.config = JSON.parse(data);
  }
}

class Msgstore {
  constructor() {
    this.data = { chats: {}, messages: {} };
    this.cache = messageCache;
  }

  bind(ev) {
    ev.on("messages.upsert", ({ messages }) => {
      for (const msg of messages) {
        const jid = msg.key?.remoteJid || "unknown";
        if (!this.data.messages[jid]) this.data.messages[jid] = [];
        this.data.messages[jid].push(msg);
        const cacheKey = `${jid}:${msg.key?.id}`;
        this.cache.set(cacheKey, msg);
      }
    });
  }

  readFromFile(file) {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf-8");
      const parsed = JSON.parse(raw || "{}");
      this.data = parsed;
      Object.values(this.data.messages).flat().forEach(msg => {
        if (msg?.key?.remoteJid && msg?.key?.id) {
          const cacheKey = `${msg.key.remoteJid}:${msg.key.id}`;
          this.cache.set(cacheKey, msg);
        }
      });
    }
  }

  writeToFile(file) {
    fs.ensureDirSync(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify(this.data, null, 2), "utf-8");
  }

  getMessage(key) {
    const jid = key?.remoteJid || key?.participant || "unknown";
    const id = key?.id || key?.stanzaId;
    const cacheKey = `${jid}:${id}`;
    const cachedMsg = this.cache.get(cacheKey);
    if (cachedMsg) return cachedMsg;
    const msgs = this.data.messages[jid] || [];
    const msg = msgs.find(m => m.key?.id === id);
    if (msg) {
      this.cache.set(cacheKey, msg);
      return msg;
    }
    return null;
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
    if (!this.config.SESSION_ID) throw new Error("Please add your session to SESSION_ID in config!");
    const sessdata = this.config.SESSION_ID.replace("sypher™--", "");
    const response = await axios.get(`https://existing-madelle-lance-ui-efecfdce.koyeb.app/download/${sessdata}`, { 
      responseType: "stream",
      timeout: 15000
    });
    
    if (response.status === 404) throw new Error(`File with identifier ${sessdata} not found.`);
    
    await fs.ensureDir(this.sessionDir);
    const writer = fs.createWriteStream(`${this.sessionDir}/creds.json`);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        log.success("Session credentials downloaded successfully!");
        resolve();
      });
      writer.on("error", (err) => {
        log.error("Failed to download session file:", err);
        reject(err);
      });
    });
  }

  async connect() {
    let retries = 0;
    const maxRetries = 5;
    
    while (retries < maxRetries) {
      try {
        const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
        const { version } = await fetchLatestBaileysVersion();
        
        this.sock = makeWASocket({
          logger,
          auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
          },
          version,
          printQRInTerminal: false,
          browser: Browsers.ubuntu("Chrome"),
          msgRetryCounterCache,
          getMessage: async (key) => this.store.getMessage(key),
          markOnlineOnConnect: true,
          defaultQueryTimeoutMs: 60000,
          connectTimeoutMs: 60000,
          syncFullHistory: true,
          generateHighQualityLinkPreview: true
        });

        this.store.bind(this.sock.ev);
        this.sock.ev.on("creds.update", utils.saveCreds);
        
        this.sock.ev.on("messages.upsert", async ({ messages, type }) => {
            console.log(messages)
            if (!messages || !Array.isArray(messages)) return;
            if (type === "notify") {
                for (const event of messages) {
                    if (!event) continue;
                    const jid = event.key.remoteJid || event.key.participant;
                    if (jid === "status@broadcast") return;
                    await this.sock.sendPresenceUpdate('available',jid)
                    try {
                        await messageHandler({ 
                            font: utils.font, 
                            event, 
                            sock: this.sock, 
                            log, 
                            proto: pkg.proto 
                        });
                    } catch (err) {
                        log.error("Message handler error:", err);
                    }
                }
            }
        });

        this.sock.ev.on("groups.update", async (update) => {
            if (!update) return;
            try {
                await handleEvent({ 
                    sock: this.sock, 
                    event: update, 
                    log, 
                    font: utils.font 
                });
            } catch (err) {
                log.error("Group update handler error:", err);
            }
        });

        this.sock.ev.on("group-participants.update", async (update) => {
            if (!update) return;
            try {
                await handleEvent({ 
                    sock: this.sock, 
                    event: update, 
                    log, 
                    font: utils.font 
                });
            } catch (err) {
                log.error("Participant update handler error:", err);
            }
        });

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Connection timeout")), 30000);
          
          this.sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
            if (connection === "open") {
              clearTimeout(timeout);
              resolve();
            }
            
            if (connection === "close") {
              clearTimeout(timeout);
              const statusCode = lastDisconnect?.error?.output?.statusCode;
              const reason = lastDisconnect?.error?.message;

              if (reason?.includes("Bad MAC")) {
                await fs.rm(this.sessionDir, { recursive: true, force: true });
                await fs.ensureDir(this.sessionDir);
                await this.loadSession();
                reject(new Error("Session reset required"));
                return;
              }

              if (statusCode === DisconnectReason.restartRequired || 
                  statusCode === DisconnectReason.connectionClosed) {
                await this.sock.logout();
                await fs.rm(this.sessionDir, { recursive: true, force: true });
                process.exit(0);
              }

              const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
              if (shouldReconnect) reject(new Error("Connection closed"));
            }
          });
        });

        return this.sock;

      } catch (error) {
        retries++;
        log.error(`Connection attempt ${retries} failed:`, error);
        if (retries === maxRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, 10000 * retries));
      }
    }
}

async start() {
    try {
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

        await fs.ensureDir(this.sessionDir);
        await this.loadSession();
        await this.connect();
        await db.initSQLite();
        global.utils = utils;
        
        log.success("Bot is ready and listening for events!");
        
    } catch (error) {
        log.error(`Failed to start bot: ${error.message}`);
        process.exit(0);
    }
}
}

class BotServer {
  constructor(bot) {
    this.bot = bot;
    this.app = express();
  }

  async startServer() {
    this.app.get("/", (req, res) => res.json({ status: "bot is up and running" }));
    this.app.listen(this.bot.config.PORT);
  }
}

const main = async () => {
  const bot = new WhatsAppBot();
  await bot.start();
  const server = new BotServer(bot);
  await server.startServer();
};

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

main();
