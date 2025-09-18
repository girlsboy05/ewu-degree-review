// routes/searchLogs.js
const express = require("express");
const router = express.Router();
const { queryLogs } = require("../lib/searchLogger");

router.get("/search-logs", (req, res) => {
  res.render("search-logs", { title: "Search Logs" });
});

router.get("/api/search-logs", (req, res) => {
  const { from, to } = req.query;
  const data = queryLogs({ from, to });
  res.json(data);
});

module.exports = router;