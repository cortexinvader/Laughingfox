import commandHander from "./commandHandler.js";

import handleOnReply from "./handleOnReply.js";

import handleOnReaction from "./handleOnReaction.js";

import handleOnChat from "./handleonChat.js";

import { setgroupBanned, setuserBanned, handleDatabase } from "./handleDatabase.js";

import db, { dataCache, saveTable, getTable, getUserData, getgroupData, getUserMoney } from "../utils/data.js";

class MessageHandler {

  constructor({ font, sock, log, proto }) {

    this.font = font;

    this.sock = sock;

    this.log = log;

    this.proto = proto;

    this.prefix = global.client.config.PREFIX;

  }

  async mainFunc({ senderID, threadID, event, message, args, bot }) {

    try {

      if (global.client.config.private && !global.client.config.admins.includes(senderID.replace("@lid", ""))) {

        return message.send(`❌ | Only bot admins can use the bot`);

      }

      if (!args.startsWith(this.prefix)) return;

      if (await db.isUserBanned(senderID) && !global.client.config.admins.includes(senderID.replace("@lid", ""))) return;

      if (await db.isGroupBanned(threadID) && !global.client.config.admins.includes(senderID.replace("@lid", ""))) {

        return message.send("❌ | This group is banned");

      }

      const [commandName, ...commandArgs] = args.slice(this.prefix.length).trim().split(" ");

      const cmd = global.client.commands.get(commandName.toLowerCase()) || global.client.aliases.get(commandName.toLowerCase());

      if (!cmd) {

        await this.sock.sendMessage(threadID, { text: `❌ | Command '${commandName}' does not exist. Type ${this.prefix}help to view all commands.` });

        return;

      }

      await commandHander({ sock: this.sock, event, threadID, senderID, args: commandArgs, log: this.log, commandName, font: this.font, message, bot, proto: this.proto, dataCache, saveTable, getTable, getUserData, getgroupData, getUserMoney, setgroupBanned, setuserBanned });

    } catch (error) {

      console.log(error);

    }

  }

  async helperFunc({ threadID, senderID, message, args, bot, event }) {

    try {

      if (global.client.config.private && !global.client.config.admins.includes(senderID.replace("@lid", ""))) return;

      if (await db.isUserBanned(senderID) && !global.client.config.admins.includes(senderID.replace("@lid", ""))) return;

      await Promise.all([

        handleDatabase({ threadID, senderID, sock: this.sock, event }),

        handleOnReply({ sock: this.sock, event, threadID, senderID, proto: this.proto, font: this.font, bot, message, args, dataCache, saveTable, getTable, getUserData, getgroupData, getUserMoney, setuserBanned, setgroupBanned }),

        handleOnReaction({ sock: this.sock, event, threadID, senderID, proto: this.proto, font: this.font, bot, message, args, dataCache, saveTable, getTable, getUserData, getgroupData, getUserMoney, setuserBanned, setgroupBanned }),

        handleOnChat({ sock: this.sock, event, threadID, senderID, proto: this.proto, font: this.font, bot, message, args, dataCache, saveTable, getTable, getUserData, getgroupData, getUserMoney, setuserBanned, setgroupBanned })

      ]);

    } catch (error) {

      console.log(error);

    }

  }

  async handleMessage(event) {

    try {

      const threadID = event.key.remoteJid;

      if (threadID === "status@broadcast") return;

      let senderID = event.key.participant || (threadID.split("@")[0] + "@lid");

      let args = "";

      const msg = event.message;

      if (!msg) return;

      args = msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.videoMessage?.caption || "";

      if (global.client.config.whitelist.status &&

        !global.client.config.whitelist.ids.includes(senderID.split("@")[0])) return;

      const message = {
        send: async form => {
          return await this.sock.sendMessage(threadID, { text: form });
        },
        reply: async form => {
          return await this.sock.sendMessage(threadID, { text: form }, { quoted: event });
        },
        edit: async (form, data) => {
          return await this.sock.sendMessage(threadID, { text: form, edit: data.key });
        },
        react: async (emoji, data) => {
          return await this.sock.sendMessage(threadID, { react: { text: emoji, key: data.key } });
        },
        unsend: async data => {
          await this.sock.sendMessage(threadID, { delete: data.key });
        },
        sendGif: async (filepath, cap) => {
          return await this.sock.sendMessage(threadID, { video: { url: filepath, caption: cap || "", gifPlayback: true } });
        },
        sendAudio: async (filepath, cap) => {
          return await this.sock.sendMessage(threadID, { audio: { url: filepath, caption: cap || "" } });
        },
        sendVideo: async (cap, filepath, boo) => {
          return await this.sock.sendMessage(threadID, { image: { url: filepath }, viewOnce: boo || false, caption: cap || "" });
        },
        sendImage: async (cap, filepath, boo) => {
          return await this.sock.sendMessage(threadID, { image: { url: filepath }, viewOnce: boo || false, caption: cap || "" });
        }
      };

      const bot = {

        changeProfileStatus: form => this.sock.updateProfileStatus(form),

        changeProfileName: form => this.sock.updateProfileName(form),

        changeProfilePic: filepath => this.sock.updateProfilePicture(threadID, { url: filepath }),

        removeProfilePic: id => this.sock.removeProfilePicture(id),

        createGroup: (sock, name, members) => this.sock.groupCreate(name, [members]),

        participants: (id, action) => this.sock.groupParticipantsUpdate(threadID, [id], action),

        leave: id => this.sock.groupLeave(id),

        user: (id, action) => this.sock.updateBlockStatus(id, action)

      };

      await Promise.all([

        this.mainFunc({ senderID, threadID, event, message, args, bot }),

        this.helperFunc({ threadID, senderID, message, args, bot, event })

      ]);

    } catch (e) {

      console.log(e);

    }

  }

}

export default async ({ font, sock, event, log, proto }) => {

  const messageHandler = new MessageHandler({ font, sock, log, proto });

  await messageHandler.handleMessage(event);

};