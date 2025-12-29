import path from "path";
import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db;

let isCacheLoaded = false;
const dataCache = {
  userMoney: [],
  userData: [],
  prefixesData: [],
  groupData: [],
};

export async function initSQLite() {
  const dbPath = path.join(__dirname, "data", "data.sqlite");
  db = new sqlite3.Database(dbPath);

  const tables = {
    userMoney: `CREATE TABLE IF NOT EXISTS userMoney (id TEXT PRIMARY KEY, money INTEGER, msgCount INTEGER)`,
    userData: `CREATE TABLE IF NOT EXISTS userData (id TEXT PRIMARY KEY, banned INTEGER DEFAULT 0, name TEXT, exp INTEGER, data TEXT)`,
    prefixesData: `CREATE TABLE IF NOT EXISTS prefixesData (id TEXT PRIMARY KEY, prefix TEXT)`,
    groupData: `CREATE TABLE IF NOT EXISTS groupData (id TEXT NOT NULL PRIMARY KEY, name TEXT, banned INTEGER DEFAULT 0`,
  };

  for (const sql of Object.values(tables)) {
    await runSQL(sql);
  }
  
  await loadAllTablesIntoCache(); 
  isCacheLoaded = true;
}

async function loadAllTablesIntoCache() {
  dataCache.userMoney = await loadTableFromDB("userMoney");
  dataCache.userData = await loadTableFromDB("userData");
  dataCache.prefixesData = await loadTableFromDB("prefixesData");
  dataCache.groupData = await loadTableFromDB("groupData");
}

function runSQL(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function allSQL(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function loadTableFromDB(tableName) {
  try {
    const rows = await allSQL(`SELECT * FROM ${tableName}`);
    if (tableName === "userData") {
      return rows.map((row) => ({
        id: row.id,
        name: row.name || "",
        banned: row.banned || 0,
      }));
    }
    return rows;
  } catch (err) {
    if (err.message.includes("no such table")) return [];
    throw err;
  }
}

export async function getTable(tableName) {
  return await loadTableFromDB(tableName); 
}


export async function getUserMoney(userId) {
  const user = await allSQL("SELECT * FROM userMoney WHERE id = ?", [userId]);
  return user.length > 0 ? user[0] : { money: 0, msgCount: 0 };
}

export async function getUserData(userId) {
  const user = await allSQL("SELECT * FROM userData WHERE id = ?", [userId]);
  return user.length > 0 ? user[0] : {};
}

export async function getPrefixesData(threadId) { 
  const prefixEntry = await allSQL("SELECT prefix FROM prefixesData WHERE id = ?", [threadId]);
  return prefixEntry.length > 0 ? prefixEntry[0].prefix : "";
}

export async function getGroupData(groupId) {
  const group = await allSQL("SELECT * FROM groupData WHERE id = ?", [groupId]);
  return group;
}


export async function saveTable(tableName, data) {
  let insertSQL = "";
  let makeParams;

  if (tableName === "userMoney") {
    insertSQL = `
      INSERT INTO userMoney (id, money, msgCount)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        money = excluded.money,
        msgCount = excluded.msgCount
    `;
    makeParams = (item) => [item.id, item.money ?? 0, item.msgCount ?? 0];
  } else if (tableName === "userData") {
    insertSQL = `
      INSERT INTO userData (id, banned, name, exp, data)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        banned = excluded.banned,
        name = excluded.name,
        exp = excluded.exp,
        data = excluded.data
    `;
    makeParams = (item) => [
      item.id,
      item.banned ?? 0,
      item.name ?? "",
      item.exp ?? 0,
      item.data ? JSON.stringify(item.data) : null,
    ];
  } else if (tableName === "prefixesData") {
    insertSQL = `
      INSERT INTO prefixesData (id, prefix)
      VALUES (?, ?)
      ON CONFLICT(id) DO UPDATE SET
        prefix = excluded.prefix
    `;
    makeParams = (item) => [item.id, item.prefix];
  } else if (tableName === "groupData") {
    insertSQL = `
      INSERT INTO groupData (id, name, banned)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        banned = excluded.banned
    `;
    makeParams = (item) => [
      item.name,
      item.banned ?? 0,
    ];
  }

  const promises = [];
  for (const item of data) {
    promises.push(runSQL(insertSQL, makeParams(item)));
  }
  await Promise.all(promises);
}

export async function setUserBanned(userId, banned = true) {
  const existingUser = await getUserData(userId);
  const dataToSave = {
    id: userId,
    banned: banned ? 1 : 0,
    name: existingUser.name || "",
    exp: existingUser.exp || 0,
    data: existingUser.data || {},
  };
  await saveTable("userData", [dataToSave]);
  return dataToSave;
}

export async function isUserBanned(userId) {
  const user = await getUserData(userId);
  return user.id ? !!user.banned : false;
}

export async function setGroupBanned(groupId, banned = true) {
  const updateSQL = `
    UPDATE groupData SET banned = ? WHERE id = ?
  `;
  await runSQL(updateSQL, [banned ? 1 : 0, groupId]);
  
  return await getGroupData(groupId);
}

export async function isGroupBanned(groupId) {
  const group = await allSQL("SELECT banned FROM groupData WHERE id = ? LIMIT 1", [groupId]);
  return group.length > 0 ? !!group[0].banned : false;
}

export { dataCache };
export default {
  initSQLite,
  getTable,
  getUserMoney,
  getUserData,
  getPrefixesData,
  getGroupData, 
  saveTable,
  isGroupBanned,
  isUserBanned,
  setUserBanned,
  setGroupBanned,
};
