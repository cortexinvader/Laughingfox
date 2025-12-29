import db, {
  saveTable,
  getUserMoney,
  getUserData,
  getPrefixesData,
  setUserBanned,
  setGroupBanned,
} from "../utils/data.js";

const updateUserData = async (data, table) => {
  await saveTable(table, [data]);
};

const updateGroupData = async (data) => {
    await saveTable("groupData", [data]);
}

const handleDatabase = async ({ threadID, senderID, sock, event }) => {
  try {
    let userMoney = await getUserMoney(senderID);
    if (!userMoney.id) {
      userMoney = { id: senderID, money: 0, msgCount: 0 };
    }
    userMoney.msgCount = (userMoney.msgCount || 0) + 1;
    await updateUserData(userMoney, "userMoney");

    let userData = await getUserData(senderID);
    if (!userData.id) {
      userData = { id: senderID, name: event.pushName, banned: 0, exp: 0, data: {} };
      await updateUserData(userData, "userData");
    }

    const prefixesData = await db.getTable("prefixesData");
    let prefixEntry = prefixesData.find((p) => p.id === threadID);

    if (!prefixEntry) {
      prefixEntry = {
        id: threadID,
        prefix: global.client.config.PREFIX,
      };
      await updateUserData(prefixEntry, "prefixesData");
    }

    if (threadID.endsWith("@g.us")) {
      const groupDataArray = await db.getTable("groupData");
      let groupData = groupDataArray.find(
        (group) => group.id === threadID && group.uid === senderID
      );
      
      if (!groupData) {
        const groupMetadata = async () => {
          const groupInfo = await sock.groupMetadata(threadID);
          return groupInfo ? groupInfo.subject : "Unknown Group";
        };
        const groupName = await groupMetadata();

        groupData = {
          id: threadID,
          name: groupName,
          uid: senderID,
          banned: 0,
          msgCount: 0,
        };
      }
      
      groupData.msgCount = (groupData.msgCount || 0) + 1;
      await updateGroupData(groupData);
    }
  } catch (e) {
    console.log(`Error in handleDatabase: ${e.message}`);
  }
};

const setuserBannedDirect = async (userId, banned) => {
  await setUserBanned(userId, banned);
};

const setgroupBannedDirect = async (groupId, banned) => {
  await setGroupBanned(groupId, banned);
};

const dataCache = {
};

export { 
    setgroupBannedDirect as setgroupBanned, 
    setuserBannedDirect as setuserBanned, 
    handleDatabase, 
    dataCache 
};
export default dataCache;