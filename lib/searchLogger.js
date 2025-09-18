// lib/searchLogger.js
const fs = require("fs");
const path = require("path");

const LOG_DIR = path.join(__dirname, "..", "data");
const LOG_FILE = path.join(LOG_DIR, "search-logs.json");

function ensureStore() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, "[]", "utf8");
}

function readAll() {
  ensureStore();
  try {
    const raw = fs.readFileSync(LOG_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeAll(arr) {
  ensureStore();
  fs.writeFileSync(LOG_FILE, JSON.stringify(arr, null, 2), "utf8");
}

exports.logSearch = function ({ searchedId, meta = {} }) {
  const all = readAll();
  all.push({
    searchedId: String(searchedId ?? ""),
    searchedAt: new Date().toISOString(),
    ...meta,
  });
  writeAll(all);
};

exports.queryLogs = function ({ from, to, limit = 500 }) {
  const all = readAll();
  let filtered = all;

  if (from) {
    const fromTs = new Date(from + "T00:00:00.000Z").getTime();
    filtered = filtered.filter(x => new Date(x.searchedAt).getTime() >= fromTs);
  }
  if (to) {
    const toTs = new Date(to + "T23:59:59.999Z").getTime();
    filtered = filtered.filter(x => new Date(x.searchedAt).getTime() <= toTs);
  }

  filtered.sort((a, b) => new Date(b.searchedAt) - new Date(a.searchedAt));
  return {
    count: filtered.length,
    items: filtered.slice(0, limit),
  };
};