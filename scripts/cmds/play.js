import axios from 'axios';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url))

const cacheFolder = path.join(__dirname, 'cache');
if (!fs.existsSync(cacheFolder)) {
  fs.mkdirSync(cacheFolder);
}

export default {
  config: {
    name: 'play',
    description: 'Search and download audio from Spotify',
    role: 0,
    category: "media",
    author: "lance",
    usage: "!play <search query>"
  },
  async onRun({ sock, event, threadID, message, args }) {
    if (!args.length) {
      return message.reply('Please provide a search term.');
    }
    const query = args.join(' ');
    await message.react("⌛", event);
    try {
      const searchRes = await axios.get(`https://api.ccprojectsapis-jonell.gleeze.com/api/spotifysearch?q=${encodeURIComponent(query)}`);
      const results = searchRes.data.results;
      if (!results || results.length === 0) {
        await sock.sendMessage(threadID, { text: 'No results found for your query.' });
        return;
      }
      let listMsg = `🎵 *Spotify Search Results for:* ${query}\n\n`;
      results.slice(0, 5).forEach((track, i) => {
        listMsg += `*${i + 1}.* ${track.title} - ${track.artist}\n`;
        listMsg += `   ⏱️ ${track.duration} | � ${track.album} | 📅 ${track.release_date}\n`;
      });
      listMsg += "_Reply with the number (1-5) to select and download._";
      const sentMsg = await sock.sendMessage(threadID, { text: listMsg, quoted: event });
      global.client.replies.set(sentMsg.key.id, {
        commandName: this.config.name,
        tracks: results.slice(0, 5)
      });
      await message.react("✅", event);
    } catch (error) {
      await message.react("❌", event);
      await sock.sendMessage(threadID, { text: `An error occurred: ${error.message}` });
    }
  },
  async onReply({ sock, event, args, data, threadID, message }) {
    const { tracks } = data;
    const choice = parseInt(args[0]);
    if (isNaN(choice) || choice < 1 || choice > tracks.length) {
      return await sock.sendMessage(threadID, { text: "❌ Invalid selection. Please reply with a number between 1 and 5." }, { quoted: event });
    }
    const selectedTrack = tracks[choice - 1];
    await sock.sendMessage(threadID, { text: `Fetching your track: ${selectedTrack.title}` }, { quoted: event });
    try {
      const dlRes = await axios.get(`https://api.ccprojectsapis-jonell.gleeze.com/api/spotify?url=${encodeURIComponent(selectedTrack.track_url)}`);
      const { mp3DownloadLink, songTitle, artist, coverImage } = dlRes.data;
      if (!mp3DownloadLink) {
        await sock.sendMessage(threadID, { text: 'Failed to fetch the audio file. Please try again later.' });
        return;
      }
      const tmpFileName = `${songTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
      const tmpFilePath = path.join(os.tmpdir(), tmpFileName);
      const writer = fs.createWriteStream(tmpFilePath);
      const audioStream = await axios.get(mp3DownloadLink, { responseType: 'stream' });
      audioStream.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      await sock.sendMessage(threadID, {
        audio: { url: tmpFilePath },
        mimetype: 'audio/mpeg',
        fileName: tmpFileName,
        ptt: false,
        caption: `${songTitle} - ${artist}`
      }, { quoted: event });
      fs.unlink(tmpFilePath, err => {
        if (err) console.error('Failed to delete temp file:', err);
      });
    } catch (error) {
      await sock.sendMessage(threadID, { text: `Error downloading track: ${error.message}` }, { quoted: event });
    }
  }
};
