import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export default {
  config: {
    name: "admins",
    description: "Add, remove, or list bot admins",
    usage: ".admins add <@user>\n.admins remove <@user>\n.admins list",
    role: 1,
    category: "admin"
  },
  onRun: async ({ event, args, message, getUserData }) => {
    const subcmd = (args[0] || "").toLowerCase();
    const ctx = event.message?.extendedTextMessage?.contextInfo || {};
    let mentionedJids = ctx?.mentionedJid || [];
    const sender = event.key.participant || event.key.remoteJid;

    if (!global.client.config.admins) global.client.config.admins = [];

    const saveConfig = () => {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const configPath = path.join(__dirname, "../../config.json");
      try {
        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        config.admins = global.client.config.admins;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      } catch (e) {
        message.reply("Failed to update config.json.");
      }
    };

    const resolveTargetJid = () => {
      if (mentionedJids.length) return mentionedJids[0];
      if (args[1]) {
        const raw = args[1];
        if (raw.includes("@")) return raw;
        return `${raw}@s.whatsapp.net`;
      }
      if (ctx.participant) return ctx.participant;
      if (ctx.quotedMessage?.key) {
        return ctx.quotedMessage.key.participant || ctx.quotedMessage.key.remoteJid || null;
      }
      return null;
    };

    if (subcmd === "add") {
      const target = resolveTargetJid();
      if (!target) return message.reply("Mention a user, reply to their message, or provide a phone id to add as admin.");
      const id = target.split("@")[0];
      if (global.client.config.admins.includes(id)) return message.reply("User is already an admin.");
      global.client.config.admins.push(id);
      saveConfig();
      await message.reply("User added as bot admin.");
    } else if (subcmd === "remove") {
      const target = resolveTargetJid();
      if (!target) return message.reply("Mention a user, reply to their message, or provide a phone id to remove from admins.");
      const id = target.split("@")[0];
      if (!global.client.config.admins.includes(id)) return message.reply("User is not an admin.");
      global.client.config.admins = global.client.config.admins.filter(a => a !== id);
      saveConfig();
      await message.reply("User removed from bot admins.");
    } else if (subcmd === "list") {
      if (!global.client.config.admins || global.client.config.admins.length === 0) return message.reply("No bot admins set.");
      let adminList = [];
      for (const id of global.client.config.admins) {
        const userData = await getUserData(`${id}@lid`);
        const name = userData && userData.name ? userData.name : id;
        adminList.push(`• ${name}`);
      }
      await message.reply(`Bot Admins:\n${adminList.join("\n")}`);
    } else {
      await message.reply("Usage:\n.admins add <@user>\n.admins remove <@user>\n.admins list");
    }
  },
};