import axios from "axios";

const leaderboard = {};

export default {
  config: {
    name: "quiz",
    description: "Play a quiz game with various categories and track your score.",
    usage: "quiz <category>",
    aliase: ["trivia", "game"],
    role: 0,
    category: "games",
  },

  async onRun({ sock, args, message, threadID, event }) {
    const apiUrl = "https://opentdb.com/api.php";
    const categoryUrl = "https://opentdb.com/api_category.php";

    try {
      if (!args[0]) {
        const { data } = await axios.get(categoryUrl);
        const categories = data.trivia_categories;

        const categoryList = categories
          .map((cat) => `• ${cat.name} (ID: ${cat.id})`)
          .join("\n");

        return await sock.sendMessage(threadID, {
          text: `🎲 Available Quiz Categories:\n\n${categoryList}\n\nUse: quiz <category ID> to start a quiz.`,
        });
      }

      const categoryId = parseInt(args[0], 10);
      if (isNaN(categoryId)) {
        return await sock.sendMessage(threadID, {
          text: "Please provide a valid category ID. Use `quiz` to see available categories.",
        });
      }

      const { data } = await axios.get(apiUrl, {
        params: {
          amount: 1,
          category: categoryId,
          type: "multiple",
        },
      });

      if (!data.results || data.results.length === 0) {
        return await sock.sendMessage(threadID, {
          text: "No questions found for the selected category. Please try another category.",
        });
      }

      const question = data.results[0];
      const options = [...question.incorrect_answers, question.correct_answer].sort(
        () => Math.random() - 0.5
      );

      const questionText = `🧠 ${question.question}\n\n${options
        .map((opt, i) => `${i + 1}. ${opt}`)
        .join("\n")}\n\nReply with the number of your answer.`;

      const sentMessage = await sock.sendMessage(threadID, {
        text: questionText,
      });

      global.client.replies.set(sentMessage.key.id, {
        id: sentMessage.key.id,
        commandName: this.config.name,
        correctAnswer: question.correct_answer,
        options,
      });
    } catch (error) {
      console.error(error);
      await sock.sendMessage(threadID, {
        text: "An error occurred while fetching quiz data. Please try again later.",
      });
    }
  },

  async onReply({ sock, event, data, threadID, senderID, args }) {
    const sender = senderID || threadID;
    const { correctAnswer, options, id } = data;

    const replydata = typeof args === "string" ? args.split(' ')[0] : args;

    const answerIndex = parseInt(replydata, 10) - 1;

    if (isNaN(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
      return await sock.sendMessage(threadID, {
        text: "Invalid answer. Please reply with the number corresponding to your choice.",
      });
    }

    if (options[answerIndex] === correctAnswer) {
      leaderboard[sender] = (leaderboard[sender] || 0) + 1;
      await sock.sendMessage(threadID, {
        text: `🎉 Correct! Well done! Your current score: ${leaderboard[sender]}`,
      });
    } else {
      await sock.sendMessage(threadID, {
        text: `❌ Incorrect. The correct answer was: ${correctAnswer}\nYour current score: ${leaderboard[sender] || 0}`,
      });
    }

    global.client.replies.delete(id);
  },
};