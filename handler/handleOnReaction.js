function getStanzaId(message) {
  if (message.reactionMessage && message.reactionMessage.key) {
    return message.reactionMessage.key.id;
  }
  return null;
}

export default async ({
    sock,
    event,
    threadID,
    senderID,
    proto,
    font,
    message,
    bot,
    dataCache,
    saveTable,
    getTable,
    getUserData,
    getGroupData
}) => {
    const { reactions, commands } = global.client;
    try {
        const stanzaId = getStanzaId(event.message);
        if (stanzaId && reactions.has(stanzaId)) {
            const data = reactions.get(stanzaId);
            if (data && data.commandName) {
                const command = commands.get(data.commandName);
                if (command && command.onReaction) {
                    const emoji = event.message?.reactionMessage?.text;
                    await command.onReaction({
                        sock,
                        threadID,
                        senderID,
                        proto,
                        font,
                        message,
                        bot,
                        emoji,
                        data,
                        dataCache,
                        saveTable,
                        getTable,
                        getUserData,
                        getGroupData,
                        event
                    });
                }
            }
        }
    } catch (err) {
        console.log(err);
        message.reply(
            "Failed to handle onReaction. Please contact admin so that this is fixed immediately."
        );
    }
};