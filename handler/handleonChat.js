export default async ({
  sock,
  event,
  threadID,
  senderID,
  proto,
  font,
  bot,
  message,
  args,
  dataCache,
  saveTable,
  getTable,
  getUserData,
  getGroupData,
  setuserBanned,
  setgroupBanned
}) => {
  try {
    const cmdsArray = Array.from(global.client.commands.values());
    for (const cmd of cmdsArray) {
      if (cmd?.onChat) {
        await cmd.onChat({
          sock,
          event,
          threadID,
          senderID,
          proto,
          font,
          bot,
          message,
          args,
          dataCache,
          saveTable,
          getTable,
          getUserData,
          getGroupData,
          setuserBanned,
          setgroupBanned
        });
      }
    }
  } catch (error) {
    message.send("Failed to handle onChat check your console to know the error");
    console.log(error);
  }
};