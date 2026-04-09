import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { scrapeSite } from "./scraper.js";


import {
  saveScrape,
  getTokens,
  updateLockedTokens,
  initDb,
  getVersionHistory,
  saveHistoryVersion
} from "./db.js";
import { tokensToCssVariables } from "./export.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ── POST /api/scrape ──────────────────────────────────────────────
app.post("/api/scrape", async (req, res) => {
  const { url } = req.body;

  if (!url || !url.startsWith("http")) {
    return res.status(400).json({ error: "Invalid URL. Must start with http or https." });
  }

  try {
    const tokens = await scrapeSite(url);
    const siteId = await saveScrape(url, tokens);

    return res.json({ siteId, url, tokens });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Scraping failed.", detail: err.message });
  }
});

// ── GET /api/tokens/:siteId ───────────────────────────────────────
app.get("/api/tokens/:siteId", async (req, res) => {
  const data = await getTokens(req.params.siteId);
  if (!data) return res.status(404).json({ error: "Site not found." });
  return res.json({
    extracted: data.extracted,
    locked:    data.locked,
    computed:  data.computed
  });
});

// ── POST /api/tokens/:siteId/lock ─────────────────────────────────
app.post("/api/tokens/:siteId/lock", async (req, res) => {
  const { lockedTokens } = req.body;
  try {
    const computed = await updateLockedTokens(req.params.siteId, lockedTokens);
    return res.json({ success: true, computed });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/history/:siteId", async (req, res) => {
  try {
    const { before, after } = req.body;

    await saveHistoryVersion(
      req.params.siteId,
      before,
      after
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ── GET /api/export/:siteId/css ───────────────────────────────────
app.get("/api/export/:siteId/css", async (req, res) => {
  const data = await getTokens(req.params.siteId);
  if (!data) return res.status(404).json({ error: "Site not found." });
  const css = tokensToCssVariables(data.computed);
  res.setHeader("Content-Type", "text/css");
  return res.send(css);
});

app.get("/api/history/:siteId", async (req, res) => {
  try {
    const history = await getVersionHistory(req.params.siteId);
    return res.json(history);
  } catch (err) {
    return res.status(500).json({
      error: err.message,
    });
  }
});

// ── BOOT ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  await initDb();
  console.log(`StyleSync backend running on http://localhost:${PORT}`);
});