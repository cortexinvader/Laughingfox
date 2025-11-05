import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
  config: {
    name: "help",
    author: "lance",
    version: "1.0.0",
    description: "Get a list of all commands or info about a specific command.",
    usage: "help [page] or help <command>",
    aliase: ["commands", "cmds", "menu"],
    role: 0,
    category: "utility",
  },
  onRun: async ({ sock, font, args, message, threadID, event }) => {
    const bannerUrls = [
      "https://i.imgur.com/8Km9tLL.jpg",
      "https://i.imgur.com/3ZQ3Z4V.jpg",
      "https://i.imgur.com/2nCt3Sbl.jpg",
    ];
    const imageUrl = bannerUrls[Math.floor(Math.random() * bannerUrls.length)];
    const commands = Array.from(global.client.commands.values());

    if (args.length > 0 && !isNaN(args[0])) {
      const pageSize = 20;
      let page = Math.max(1, parseInt(args[0], 10) || 1);

      const categories = {};
      for (const cmd of commands) {
        const cat = cmd.config?.category || "Uncategorized";
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(cmd);
      }

      const sortedCats = Object.keys(categories).sort();
      let allLines = [];
      for (const cat of sortedCats) {
        allLines.push(`${font.bold(cat)}:`);
        allLines.push(
          ...categories[cat].map(
            (cmd) =>
              `  • ${font.mono(cmd.config.name)} — ${cmd.config.description || "no description"}`
          )
        );
      }

      const totalPages = Math.max(1, Math.ceil(allLines.length / pageSize));
      if (page > totalPages) page = totalPages;
      const start = (page - 1) * pageSize;
      const pageLines = allLines.slice(start, start + pageSize);

      let helpMessage = `${font.bold("📜 Command List")}\n\n`;
      helpMessage += pageLines.join("\n") + "\n\n";
      helpMessage += `${font.bold("Page")}: ${page}/${totalPages} • ${font.bold("Total")}: ${commands.length}\n`;
      helpMessage += `${font.bold("Prefix")}: ${font.mono(String(global.client.config.PREFIX))}\n`;
      helpMessage += `Use: ${font.mono("help <page>")} or ${font.mono("help <command>")}\n`;

      const title = "Laughingfox — Commands";
      const body = `Page ${page} • ${commands.length} commands`;
      const sourceUrl = "https://gitlab.com/lance-ui1/Laughingfox";

      return await sock.sendMessage(threadID, {
        image: { url: imageUrl },
        caption: helpMessage,
        contextInfo: {
          externalAdReply: {
            showAdAttribution: true,
            mediaType: 2,
            title,
            body,
            sourceUrl,
            thumbnailUrl: imageUrl,
          },
        },
      });
    }

    if (args.length > 0) {
      const cmdName = args[0].toLowerCase();
      const cmd = commands.find(
        (c) =>
          c.config.name.toLowerCase() === cmdName ||
          (Array.isArray(c.config.aliases) &&
            c.config.aliases.map((a) => a.toLowerCase()).includes(cmdName)) ||
          (Array.isArray(c.config.aliase) &&
            c.config.aliase.map((a) => a.toLowerCase()).includes(cmdName))
      );
      if (!cmd)
        return message.reply(
          `No command found with the name or alias "${cmdName}".`
        );

      let info = `${font.bold("📝 Command Info")}\n`;
      info += `${font.bold("Name")}: ${font.mono(cmd.config.name)}\n`;
      const aliases = Array.isArray(cmd.config.aliases) && cmd.config.aliases.length
        ? cmd.config.aliases
        : (Array.isArray(cmd.config.aliase) && cmd.config.aliase.length ? cmd.config.aliase : []);
      info += `${font.bold("Aliases")}: ${font.mono(aliases.length ? aliases.join(", ") : "None")}\n`;
      info += `${font.bold("Usage")}: ${cmd.config.usage ? font.mono(cmd.config.usage) : "no usage info"}\n`;
      info += `${font.bold("Description")}: ${cmd.config.description || "no description provided"}\n`;
      info += `${font.bold("Version")}: ${cmd.config.version || "n/a"}\n`;
      info += `${font.bold("Author")}: ${cmd.config.author || "unknown"}\n`;
      info += `${font.bold("Role")}: ${typeof cmd.config.role !== "undefined" ? cmd.config.role : "0"}\n`;

      const title = `${cmd.config.name} — Command Info`;
      const body = cmd.config.description || "Command details";
      const sourceUrl = "https://gitlab.com/lance-ui1/Laughingfox";

      return await sock.sendMessage(threadID, {
        image: { url: imageUrl },
        caption: info,
        contextInfo: {
          externalAdReply: {
            showAdAttribution: true,
            mediaType: 2,
            title,
            body,
            sourceUrl,
            thumbnailUrl: imageUrl,
          },
        },
      });
    }

    const pageSize = 20;
    let page = 1;

    const categories = {};
    for (const cmd of commands) {
      const cat = cmd.config?.category || "Uncategorized";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(cmd);
    }

    const sortedCats = Object.keys(categories).sort();
    let allLines = [];
    for (const cat of sortedCats) {
      allLines.push(`${font.bold(cat)}:`);
      allLines.push(
        ...categories[cat].map(
          (cmd) =>
            `  • ${font.mono(cmd.config.name)} — ${cmd.config.description || "no description given"}`
        )
      );
    }

    const totalPages = Math.max(1, Math.ceil(allLines.length / pageSize));
    if (page > totalPages) page = totalPages;
    const start = (page - 1) * pageSize;
    const pageLines = allLines.slice(start, start + pageSize);

    let helpMessage = `${font.bold("📜 Command List")}\n\n`;
    helpMessage += pageLines.join("\n") + "\n\n";
    helpMessage += `${font.bold("Page")}: ${page}/${totalPages} • ${font.bold("Total")}: ${commands.length}\n`;
    helpMessage += `${font.bold("Prefix")}: ${font.mono(String(global.client.config.PREFIX))}\n`;
    helpMessage += `Use: ${font.mono("help <page>")} or ${font.mono("help <command>")}\n`;

    const title = "Laughingfox — Commands";
    const body = `${commands.length} commands available`;
    const sourceUrl = "https://gitlab.com/lance-ui1/Laughingfox";

    return await sock.sendMessage(threadID, {
      image: { url: imageUrl },
      caption: helpMessage,
      contextInfo: {
        externalAdReply: {
          showAdAttribution: true,
          mediaType: 2,
          title,
          body,
          sourceUrl,
          thumbnailUrl: imageUrl,
        },
      },
    });
  },
};
