import axios from 'axios';

export default {
	config: {
		name: "fact",
		aliases: ["facts"],
		version: "1.0",
		author: "Samir",
		countDown: 30,
		role: 0,
		shortDescription: "Get Random Fact",
		longDescription: "Get Random Fact",
		category: "Study",
		guide: "{pn}"
	},

	onRun: async function ({ message }) {
		try {
			const res = await axios.get(`https://api.popcat.xyz/fact`);
			const fact = res.data.fact;
			return message.reply(`🤓 *Did you know?* \n\n${fact}`);
		} catch (error) {
			console.error("Fact API Error:", error.message);
			return message.reply("❌ Failed to fetch a random fact. Please try again later.");
		}
	}
};
