export default {
  config: {
    name: "welcome"
  },
  onEvent: async ({ event, sock, client }) => {
    if (!['add', 'remove'].includes(event.action)) {
      return;
    }

    const groupId = event.id;
    const metadata = await sock.groupMetadata(groupId).catch(() => null);

    if (!metadata) {
        console.error(`Could not fetch metadata for group: ${groupId}`);
        return;
    }

    const botBase = sock.user.id.split(":")[0];
    const botNumberS = `${botBase}@s.whatsapp.net`;
    const botNumberLid = `${botBase}@lid`;

    for (const participantObj of event.participants) {
      const participantId = participantObj.id; 

      if (
        event.action === "add" &&
        (participantId === botNumberS || participantId === botNumberLid)
      ) {
        const text = `Thanks for adding me to *${metadata.subject}*! 🎉\n` +
                     `Use */help* to see all available commands.`;

        await sock.sendMessage(groupId, { text });

        const admins = client.config?.admis; 
        if (Array.isArray(admins) && admins.length > 0) {
          const adminMessage = `Bot was added to a new group: *${metadata.subject}* (${groupId})`;
          for (const admin of admins) {
            const adminJid = String(`${admin}@s.whatsapp.net`);
            await sock.sendMessage(adminJid, { text: adminMessage }).catch(e => console.error(`Failed to message admin ${admin}`, e));
          }
        }
        continue; 
      }

      const username = participantId.split("@")[0];
      const pp = await sock.profilePictureUrl(participantId, "image").catch(() => "https://i.ibb.co/FzYpDmt/default.png");
      const memberCount = metadata.participants.length;

      if (event.action === "add") {
        const text =
          `👋 Welcome @${username} to *${metadata.subject}*! 🎉\n` +
          `You are the *${memberCount}th* member of this group.\n` +
          `Feel free to introduce yourself!`;

        await sock.sendMessage(groupId, {
          image: { url: pp },
          caption: text,
          mentions: [participantId],
        });
      } else if (event.action === "remove") {
        const text = `😢 @${username} has left *${metadata.subject}*. Farewell!`;

        await sock.sendMessage(groupId, {
          image: { url: pp },
          caption: text,
          mentions: [participantId],
        });
      }
    }
  }
}
