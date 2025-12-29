import path from "path";
import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db;
let isCacheLoaded = false;

const dataCache = {
  userData: [],
  groupData: [],
};

export async function initSQLite() {
  const dbPath = path.join(__dirname, "data", "data.sqlite");
  db = new sqlite3.Database(dbPath);

  const tables = {
    userData: `CREATE TABLE IF NOT EXISTS userData (
      id TEXT PRIMARY KEY, 
      banned INTEGER DEFAULT 0, 
      name TEXT, 
      exp INTEGER DEFAULT 0, 
      money INTEGER DEFAULT 0, 
      msgCount INTEGER DEFAULT 0, 
      data TEXT
    )`,
    groupData: `CREATE TABLE IF NOT EXISTS groupData (
      id TEXT NOT NULL PRIMARY KEY, 
      name TEXT, 
      banned INTEGER DEFAULT 0
    )`,
  };

  for (const sql of Object.values(tables)) {
    await runSQL(sql);
  }

  await loadAllTablesIntoCache(); 
  isCacheLoaded = true;
}

async function loadAllTablesIntoCache() {
  dataCache.userData = await loadTableFromDB("userData");
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
    return await allSQL(`SELECT * FROM ${tableName}`);
  } catch (err) {
    if (err.message.includes("no such table")) return [];
    throw err;
  }
}

export async function getTable(tableName) {
  return await loadTableFromDB(tableName); 
}

export async function getUserData(userId) {
  const user = await allSQL("SELECT * FROM userData WHERE id = ?", [userId]);
  return user.length > 0 ? user[0] : { id: userId, money: 0, msgCount: 0, exp: 0, banned: 0, name: "" };
}

export async function getGroupData(groupId) {
  return await allSQL("SELECT * FROM groupData WHERE id = ?", [groupId]);
}

export async function saveTable(tableName, data) {
  let insertSQL = "";
  let makeParams;

  if (tableName === "userData") {
    insertSQL = `
      INSERT INTO userData (id, banned, name, exp, money, msgCount, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        banned = excluded.banned,
        name = excluded.name,
        exp = excluded.exp,
        money = excluded.money,
        msgCount = excluded.msgCount,
        data = excluded.data
    `;
    makeParams = (item) => [
      item.id,
      item.banned ?? 0,
      item.name ?? "",
      item.exp ?? 0,
      item.money ?? 0,
      item.msgCount ?? 0,
      item.data ? JSON.stringify(item.data) : null,
    ];
  } else if (tableName === "groupData") {
    insertSQL = `
      INSERT INTO groupData (id, name, banned)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        banned = excluded.banned
    `;
    makeParams = (item) => [item.id, item.name, item.banned ?? 0];
  }

  const promises = data.map(item => runSQL(insertSQL, makeParams(item)));
  await Promise.all(promises);
}

export async function setUserBanned(userId, banned = true) {
  const user = await getUserData(userId);
  user.banned = banned ? 1 : 0;
  await saveTable("userData", [user]);
  return user;
}

export async function isUserBanned(userId) {
  const user = await getUserData(userId);
  return !!user.banned;
}

export async function setGroupBanned(groupId, banned = true) {
  await runSQL(`UPDATE groupData SET banned = ? WHERE id = ?`, [banned ? 1 : 0, groupId]);
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
  getUserData,
  getGroupData, 
  saveTable,
  isGroupBanned,
  isUserBanned,
  setUserBanned,
  setGroupBanned,
  runSQL
};