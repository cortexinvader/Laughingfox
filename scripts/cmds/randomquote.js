import axios from "axios";

export default {
  config: {
    name: "randomquote",
    cooldown: 5,
    aliase: ["quote", "inspirobot", "inspire"],
    description: "Get a random inspirational quote as an image.",
    category: "utility",
    usage: `${global.client.config.PREFIX}randomquote`
  },
  async onRun({ sock, event }) {
    const chatId = event.key.remoteJid;
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    try {
      const apiUrl = "https://apis-keith.vercel.app/random/inspirobot";
      const imgBufferRes = await axios.get(apiUrl, { responseType: 'arraybuffer' });
      const imgBuffer = Buffer.from(imgBufferRes.data, 'binary');
      const tmpFileName = `inspirobot_${Date.now()}.jpg`;
      const tmpFilePath = path.join(os.tmpdir(), tmpFileName);
      fs.writeFileSync(tmpFilePath, imgBuffer);
      await sock.sendMessage(chatId, {
        image: { url: tmpFilePath },
        caption: "🖼️ Random Inspirational Quote"
      }, { quoted: event });
      fs.unlink(tmpFilePath, err => {
        if (err) console.error('Failed to delete temp file:', err);
      });
    } catch (error) {
      await sock.sendMessage(chatId, { text: `Error fetching quote: ${error.message}` }, { quoted: event });
    }
  }
};
