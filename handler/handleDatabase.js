import db, {
  saveTable,
  getUserData,
  setUserBanned,
  setGroupBanned,
} from "../utils/data.js";

const updateUserData = async (data) => {
  await saveTable("userData", [data]);
};

const updateGroupData = async (data) => {
  await saveTable("groupData", [data]);
};

const handleDatabase = async ({ threadID, senderID, sock, event }) => {
  try {
    let userData = await getUserData(senderID);
    
    userData.name = userData.name || event.pushName || "Unknown";
    userData.msgCount = (userData.msgCount || 0) + 1;
    await updateUserData(userData);

    if (threadID.endsWith("@g.us")) {
      const groupDataArray = await db.getTable("groupData");
      let groupData = groupDataArray.find((group) => group.id === threadID);

      if (!groupData) {
        const groupInfo = await sock.groupMetadata(threadID);
        const groupName = groupInfo ? groupInfo.subject : "Unknown Group";

        groupData = {
          id: threadID,
          name: groupName,
          banned: 0,
          msgCount: 0
        };
      }

      groupData.msgCount = (groupData.msgCount || 0) + 1;
      await updateGroupData(groupData);
    }
  } catch (e) {
    console.error(`Error in handleDatabase: ${e.message}`);
  }
};

const setuserBannedDirect = async (userId, banned) => {
  await setUserBanned(userId, banned);
};

const setgroupBannedDirect = async (groupId, banned) => {
  await setGroupBanned(groupId, banned);
};

const dataCache = {};

export { 
    setgroupBannedDirect as setgroupBanned, 
    setuserBannedDirect as setuserBanned, 
    handleDatabase, 
    dataCache 
};
export default dataCache;