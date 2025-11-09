import axios from "axios";
import fs from 'fs';
import path from 'path';

const ACCESS_TOKEN = "QB-8618884f56ecd6442f7b";

const BASE_QUESTION_URL = "https://questions.aloc.com.ng/api/v2/q"; 

const CACHE_DIR = path.join(process.cwd(), 'cache');
const LEADERBOARD_FILE = path.join(CACHE_DIR, 'leaderboard.json');

const AVAILABLE_SUBJECTS = [
  "english", "mathematics", "commerce", "accounting", "biology", 
  "physics", "chemistry", "englishlit", "government", "crk", 
  "geography", "economics", "irk", "civiledu", "insurance", 
  "currentaffairs", "history"
];

function ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}

function loadLeaderboard() {
    ensureCacheDir();
    try {
        const data = fs.readFileSync(LEADERBOARD_FILE, 'utf8');
        const rawData = JSON.parse(data);
        const finalData = {};
        for (const id in rawData) {
            if (typeof rawData[id] === 'number') {
                finalData[id] = { score: rawData[id], name: id };
            } else {
                finalData[id] = rawData[id];
            }
        }
        return finalData;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {};
        }
        return {};
    }
}

function saveLeaderboard(currentLeaderboard) {
    ensureCacheDir();
    try {
        fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(currentLeaderboard, null, 2), 'utf8');
    } catch (error) {
        
    }
}

let leaderboard = loadLeaderboard();

function getHelpMessage(page) {
    const usage = "quiz <subject> [type] [year]";
    const subjectList = AVAILABLE_SUBJECTS.slice(0, 10).map(s => `• ${s}`).join('\n') + `\n...(Type 'quiz' for full list)`;

    if (page === 'main') {
        return `
📚 *Quiz Command Help* 📚

*Usage:* \`${usage}\`
*Leaderboard:* \`quiz leaderboard\`
---

*Page 1/2: Basics & Subject List*
- Run \`quiz\` with no arguments to see the full list of available subjects.
- Start a quiz by specifying a subject: \`quiz chemistry\`

This cmd uses specific names for subjects. If you're unsure, check the list below:
${subjectList}

To see optional filters, type: \`quiz help filters\`
        `.trim();
    } else if (page === 'filters') {
        return `
⚙️ *Quiz Command Help* ⚙️

*Page 2/2: Optional Filters*
Filters let you narrow down the questions you receive. You can use one or both.

1. *[type]*: Filter by exam type.
   - *Example:* \`quiz2 physics utme\`
   - *Supported Types:* \`utme\`, \`wassce\`, \`post-utme\`

2. *[year]*: Filter by the question's year.
   - *Example:* \`quiz2 biology wassce 2010\`
   - *Format:* Must be a four-digit year (e.g., \`2005\`, \`2013\`).

*Remember:* Subject is always required!

To return to the main help page, type: \`quiz help main\`
        `.trim();
    }
    return `Invalid help page. Use \`quiz help main\` or \`quiz help filters\`.`;
}

export default {
  config: {
    name: "quiz",
    description: "Play a quiz game using questions from ALOC, with subject, type, and year filters.",
    usage: "quiz <subject> [type] [year] | quiz leaderboard", 
    aliase: ["trivia", "game"],
    role: 0,
    category: "games",
  },

  async onRun({ sock, args, message, threadID, event, senderID }) {
    
    try {
      const commandArg = args[0] ? args[0].toLowerCase() : null;

      if (commandArg === 'leaderboard') {
        const scores = Object.values(leaderboard)
          .sort((a, b) => b.score - a.score)
          .slice(0, 30);

        if (scores.length === 0) {
          return await sock.sendMessage(threadID, { text: "🏆 The quiz leaderboard is currently empty. Be the first to score!" });
        }
        
        const leaderboardText = scores.map((entry, index) => {
          const rank = index + 1;
          const name = entry.name.substring(0, 20);
          return `#${rank} | ${name}: ${entry.score} points`;
        }).join('\n');

        return await sock.sendMessage(threadID, {
          text: `🏆 *Quiz Top ${scores.length} Leaderboard* 🏆\n\n${leaderboardText}\n\nYour score: ${leaderboard[senderID]?.score || 0}`,
        });
      }


      if (commandArg === 'help') {
          const helpPage = args[1] ? args[1].toLowerCase() : 'main';
          const helpText = getHelpMessage(helpPage);
          return await sock.sendMessage(threadID, { text: helpText });
      }
      
      const subject = commandArg;
      let type = null;
      let year = null;

      if (args.length > 1) {
          if (!isNaN(parseInt(args[1])) && args[1].length === 4) {
              year = args[1];
          } else {
              type = args[1].toLowerCase();
          }
      }

      if (args.length > 2) {
          if (!year && !isNaN(parseInt(args[2])) && args[2].length === 4) {
              year = args[2];
          } else if (!type) {
              type = args[2].toLowerCase();
          }
      }

      if (!subject) {
        const categoryList = AVAILABLE_SUBJECTS
          .map((subj) => `• ${subj}`)
          .join("\n");
        return await sock.sendMessage(threadID, {
          text: `📚 Available Quiz Subjects:\n\n${categoryList}\n\nTo start, use: quiz2 <subject> [type] [year]\n(Example: quiz2 chemistry utme 2010)\n\nFor help, type: \`quiz2 help\``,
        });
      }

      if (!AVAILABLE_SUBJECTS.includes(subject)) {
        return await sock.sendMessage(threadID, {
          text: `Subject "${subject}" is not valid. Use \`quiz2\` to see available subjects.`,
        });
      }
      
      const params = { subject: subject };
      if (type) params.type = type;
      if (year) params.year = year;

      const { data: apiResponse } = await axios.get(BASE_QUESTION_URL, {
        params: params,
        headers: {
          'AccessToken': ACCESS_TOKEN, 
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      const questionData = apiResponse.data || null; 

      if (!questionData || !questionData.question) {
        return await sock.sendMessage(threadID, {
          text: "No questions found for the selected subject/parameters. Try a different type or year.",
        });
      }

      const questionText = questionData.question;
      const optionsObject = questionData.option; 
      const correctAnswerKey = questionData.answer.toUpperCase(); 

      const optionsKeys = ['A', 'B', 'C', 'D', 'E'];
      const options = [];
      let correctText = '';

      for (const key of optionsKeys) {
          const optionValue = optionsObject[key.toLowerCase()];
          if (optionValue) {
              options.push(optionValue);
              if (key === correctAnswerKey) {
                  correctText = optionValue;
              }
          }
      }
      
      if (!correctText) {
          throw new Error("Invalid answer mapping from API response.");
      }

      const info = `Subject: ${apiResponse.subject.toUpperCase()}${type ? ` | Type: ${type.toUpperCase()}` : ''}${year ? ` | Year: ${year}` : ''}`;
      
      const questionFormatted = `🧠 ${info}\n\n${questionText}\n\n${options
        .map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`)
        .join("\n")}\n\nReply with the letter of your answer (A, B, C, or D).`;

      const sentMessage = await sock.sendMessage(threadID, {
        text: questionFormatted,
      });

      global.client.replies.set(sentMessage.key.id, {
        id: sentMessage.key.id,
        commandName: this.config.name,
        correctAnswerKey: correctAnswerKey, 
        correctAnswerText: correctText,     
        options: options,                  
      });
        
    } catch (error) {
      let errorText = "An error occurred while fetching quiz data.";

      if (error.response) {
          if (error.response.status === 401) {
              errorText = "❌ Unauthorized: Please ensure your ALOC AccessToken is correct in the command file headers.";
          }
      }
      
      await sock.sendMessage(threadID, { text: errorText });
    }
  },

  async onReply({ sock, event, data, threadID, senderID, args }) {
    const sender = senderID || threadID;
    const { correctAnswerKey, correctAnswerText, options, id } = data;

    const replyAnswer = (typeof args === "string" ? args.split(' ')[0] : args).toUpperCase();

    const currentData = leaderboard[sender] || { score: 0, name: event.pushName || sender };
    
    if (replyAnswer === correctAnswerKey) {
      currentData.score += 1;
      currentData.name = event.pushName || currentData.name;
      leaderboard[sender] = currentData;

      await sock.sendMessage(threadID, {
        text: `🎉 Correct! The answer was: ${correctAnswerKey} (${correctAnswerText})\n\nYour current score: ${currentData.score}`,
      });
    } else if (['A', 'B', 'C', 'D', 'E'].includes(replyAnswer)) { 
      currentData.name = event.pushName || currentData.name;
      leaderboard[sender] = currentData;

      await sock.sendMessage(threadID, {
        text: `❌ Incorrect. The correct answer was: ${correctAnswerKey} (${correctAnswerText})\n\nYour current score: ${currentData.score}`,
      });
    } else {
      return await sock.sendMessage(threadID, {
        text: "Invalid answer. Please reply with the letter corresponding to your choice (A, B, C, D, or E).",
      });
    }

    saveLeaderboard(leaderboard);
    
    global.client.replies.delete(id);
  },
};
