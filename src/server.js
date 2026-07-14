import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import express from "express";
import multer from "multer";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { Aria2Manager } from "./aria2.js";
import {
  DATA_DIR,
  DOWNLOAD_DIR,
  PROJECT_ROOT,
  TORRENT_DIR,
  ensureAria2,
  ensureDirectories,
  ensureYtDlp
} from "./tooling.js";
import { VideoJobManager, listVideoFormats } from "./videoJobs.js";
import { getPendingTorrent, inspectTorrentUpload } from "./torrents.js";
import { DownloadOrganizer } from "./organizer.js";
import { JsonStore, ScheduleManager } from "./automation.js";
import { acquireSubtitle, analyzeLocalVideo, downloadSubtitles, listSubtitles, parseReleaseName, searchSubtitleCenter } from "./subtitles.js";

const PORT = Number(process.env.PORT || 4288);
const publicDir = path.join(PROJECT_ROOT, "public");
const upload = multer({ dest: TORRENT_DIR });

export async function startDownloadServer({ port = PORT, host = "127.0.0.1" } = {}) {
  await ensureDirectories();

  console.log("正在准备下载引擎...");
  const aria2Path = await ensureAria2();
  const aria2 = new Aria2Manager({
    binPath: aria2Path,
    downloadDir: DOWNLOAD_DIR,
    dataDir: DATA_DIR
  });
  await aria2.start();
  const organizer = new DownloadOrganizer({
    downloadDir: DOWNLOAD_DIR,
    dataDir: DATA_DIR
  });
  const settingsStore = new JsonStore(path.join(DATA_DIR, "settings.json"), {
    speed: {
      downloadLimit: "0",
      uploadLimit: "0",
      maxConcurrentDownloads: 10
    },
    notifications: true,
    closeToTray: true,
    subtitles: {
      subdlApiKey: "",
      openSubtitlesApiKey: "",
      openSubtitlesToken: "",
      preferredLanguages: ["zh-CN", "zh-TW", "en"]
    }
  });
  const settings = await settingsStore.load();
  await aria2.setGlobalOptions(settings.speed);
  const schedules = new ScheduleManager({
    filePath: path.join(DATA_DIR, "schedules.json"),
    execute: addUrlTasks
  });
  await schedules.start();

  let ytDlpPath = null;
  let videos = null;
  let videoToolsError = "";

  const app = express();
  app.use(corsForLocalTools);
  app.use(express.json({ limit: "2mb" }));
  app.use(express.static(publicDir));

  app.get("/api/health", (_request, response) => {
    response.json({
      ok: true,
      downloads: DOWNLOAD_DIR,
      tools: {
        aria2: aria2Path,
        ytDlp: ytDlpPath,
        ffmpeg: ffmpegInstaller.path
      },
      videoReady: Boolean(videos),
      videoError: videoToolsError,
      settings: settingsStore.get(),
      schedules: schedules.list().length
    });
  });

  app.get("/api/tasks", async (_request, response, next) => {
    try {
      response.json(await listAllTasks());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/tasks", async (request, response, next) => {
    try {
      const ids = await addUrlTasks(request.body ?? {});
      response.json({ ids });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/extension/capture", async (request, response, next) => {
    try {
      const ids = await addUrlTasks({ ...request.body, mode: request.body?.mode || "link" });
      response.json({ ok: true, ids });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/settings", (_request, response) => {
    response.json(settingsStore.get());
  });

  app.put("/api/settings", async (request, response, next) => {
    try {
      const current = settingsStore.get();
      const nextSettings = {
        ...current,
        ...request.body,
        speed: normalizeSpeedSettings({ ...current.speed, ...request.body?.speed }),
        subtitles: { ...current.subtitles, ...request.body?.subtitles }
      };
      const saved = await settingsStore.set(nextSettings);
      await aria2.setGlobalOptions(saved.speed);
      response.json(saved);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/schedules", (_request, response) => {
    response.json({ schedules: schedules.list() });
  });

  app.post("/api/schedules", async (request, response, next) => {
    try {
      response.status(201).json(await schedules.create(request.body ?? {}));
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/schedules/:id", async (request, response, next) => {
    try {
      response.json(await schedules.update(request.params.id, request.body ?? {}));
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/schedules/:id", async (request, response, next) => {
    try {
      await schedules.remove(request.params.id);
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/torrents/inspect", upload.single("torrent"), async (request, response, next) => {
    try {
      if (!request.file) {
        response.status(400).json({ error: "请先选择 .torrent 文件。" });
        return;
      }
      response.json(await inspectTorrentUpload(request.file));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/torrents", upload.single("torrent"), async (request, response, next) => {
    try {
      const body = request.body ?? {};
      const torrentRecord = body.torrentId ? getPendingTorrent(body.torrentId) : null;
      const torrentPath = torrentRecord?.path || request.file?.path;

      if (!torrentPath) {
        response.status(400).json({ error: "请先选择 .torrent 文件。" });
        return;
      }

      const options = buildAriaOptions(body);
      const selectedFiles = parseSelectedFiles(body.selectFiles);
      if (body.selectFiles !== undefined && selectedFiles.length === 0) {
        response.status(400).json({ error: "至少选择一个种子文件。" });
        return;
      }
      if (selectedFiles.length > 0) {
        options["select-file"] = selectedFiles.join(",");
      }

      const data = await fs.readFile(torrentPath);
      const id = await aria2.addTorrent(data.toString("base64"), options);
      response.json({ ids: [id] });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/video/formats", async (request, response, next) => {
    try {
      const url = String(request.query.url || "").trim();
      if (!url) {
        response.status(400).json({ error: "缺少视频链接。" });
        return;
      }
      const videoManager = await getVideoManager();
      const formats = await listVideoFormats({ ytDlpPath: videoManager.ytDlpPath, url });
      response.type("text/plain").send(formats);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/subtitles", async (request, response, next) => {
    try {
      const url = cleanText(request.query.url);
      if (!url) throw new Error("缺少视频链接。");
      const videoManager = await getVideoManager();
      response.json(await listSubtitles({ ytDlpPath: videoManager.ytDlpPath, url }));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/subtitles/download", async (request, response, next) => {
    try {
      const body = request.body ?? {};
      const url = cleanText(body.url);
      if (!url) throw new Error("缺少视频链接。");
      const videoManager = await getVideoManager();
      response.json(await downloadSubtitles({
        ytDlpPath: videoManager.ytDlpPath,
        ffmpegPath: ffmpegInstaller.path,
        url,
        dir: resolveDownloadDir(body.dir),
        languages: body.languages,
        automatic: body.automatic !== false
      }));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/subtitle-center/analyze", async (request, response, next) => {
    try {
      response.json(await analyzeLocalVideo({ videoPath: request.query.path, ffmpegPath: ffmpegInstaller.path }));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/subtitle-center/search", async (request, response, next) => {
    try {
      const body = request.body ?? {};
      const settings = settingsStore.get();
      const query = { ...(body.query || {}), languages: body.query?.languages || settings.subtitles.preferredLanguages };
      const localResults = [];
      let targetVideo = cleanText(body.videoPath);
      let outputDir = targetVideo ? path.dirname(path.resolve(targetVideo)) : resolveDownloadDir(body.outputDir);

      if (body.taskId) {
        const taskData = await listAllTasks();
        const task = taskData.tasks.find((item) => item.id === body.taskId);
        if (!task) throw new Error("没有找到下载任务。");
        Object.assign(query, parseReleaseName(task.name), { sourceUrl: task.kind === "video" ? task.source : "" });
        targetVideo = task.filePath || "";
        outputDir = task.dir || outputDir;
      }

      if (targetVideo && await pathExists(targetVideo)) {
        const analysis = await analyzeLocalVideo({ videoPath: targetVideo, ffmpegPath: ffmpegInstaller.path });
        Object.assign(query, analysis.metadata, { moviehash: analysis.moviehash });
        localResults.push(...analysis.sidecars, ...analysis.embedded);
      } else if (body.fileName) {
        Object.assign(query, parseReleaseName(body.fileName));
      }

      if (body.directUrl) {
        localResults.push({ provider: "direct", name: body.directName || "指定字幕", language: body.directLanguage || query.languages?.[0] || "und", downloadUrl: body.directUrl, score: 100 });
      }

      const online = await searchSubtitleCenter({
        query,
        providers: settings.subtitles,
        tools: { ytDlpPath: query.sourceUrl ? (await getVideoManager()).ytDlpPath : null }
      });
      response.json({ query, targetVideo, outputDir, results: [...localResults, ...online.results].sort((a, b) => Number(b.score || 0) - Number(a.score || 0)), errors: online.errors, providers: { source: Boolean(query.sourceUrl), subdl: Boolean(settings.subtitles.subdlApiKey), opensubtitles: Boolean(settings.subtitles.openSubtitlesApiKey) } });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/subtitle-center/acquire", async (request, response, next) => {
    try {
      const settings = settingsStore.get();
      const ytDlpPath = request.body?.result?.provider === "source" ? (await getVideoManager()).ytDlpPath : null;
      response.json(await acquireSubtitle({
        result: request.body?.result,
        targetVideo: cleanText(request.body?.targetVideo),
        outputDir: resolveDownloadDir(request.body?.outputDir),
        tools: { ytDlpPath, ffmpegPath: ffmpegInstaller.path },
        providers: settings.subtitles
      }));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/tasks/:id/pause", async (request, response, next) => {
    try {
      if (request.params.id.startsWith("video-")) {
        if (!videos) throw new Error("视频引擎还没有启动。");
        videos.pause(request.params.id);
      } else {
        await aria2.pause(request.params.id);
      }
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/tasks/:id/resume", async (request, response, next) => {
    try {
      if (request.params.id.startsWith("video-")) {
        if (!videos) throw new Error("视频引擎还没有启动。");
        videos.resume(request.params.id);
      } else {
        await aria2.resume(request.params.id);
      }
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/tasks/:id/limit", async (request, response, next) => {
    try {
      const limit = normalizeLimit(request.body?.downloadLimit);
      if (request.params.id.startsWith("video-")) {
        if (!videos) throw new Error("视频引擎还没有启动。");
        videos.setRateLimit(request.params.id, limit);
      } else {
        await aria2.setTaskLimit(request.params.id, limit);
      }
      response.json({ ok: true, downloadLimit: limit });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/tasks/:id", async (request, response, next) => {
    try {
      const deleteFiles = request.query.files === "1" || request.query.deleteFiles === "true";
      if (request.params.id.startsWith("video-")) {
        if (!videos) throw new Error("视频引擎还没有启动。");
        await videos.remove(request.params.id, { deleteFiles });
      } else {
        await aria2.remove(request.params.id, { deleteFiles });
      }
      await organizer.removeTaskFiles(request.params.id, { deleteFiles });
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _request, response, _next) => {
    console.error(error);
    response.status(500).json({ error: error.message || "服务器出错。" });
  });

  let server;
  try {
    server = await listen(app, port, host);
  } catch (error) {
    await aria2.stop();
    throw error;
  }
  const address = server.address();
  const actualPort = address && typeof address === "object" ? address.port : port;
  const url = `http://${host}:${actualPort}`;
  console.log(`下载工具已启动：${url}`);

  return {
    app,
    server,
    url,
    async stop() {
      schedules.stop();
      await aria2.stop();
      await new Promise((resolve) => server.close(() => resolve()));
    }
  };

  async function addUrlTasks(body) {
    const urls = splitUrls(body.urls || body.url);
    const mode = body.mode || "link";

    if (urls.length === 0) {
      throw new Error("请先输入链接。");
    }

    const ids = [];
    for (const url of urls) {
      if (mode === "video" || looksLikeVideo(url)) {
        const videoManager = await getVideoManager();
        ids.push(
          videoManager.start({
            url,
            dir: resolveDownloadDir(body.dir),
            format: body.format,
            playlist: Boolean(body.playlist),
            rateLimit: cleanText(body.rateLimit),
            userAgent: cleanText(body.userAgent),
            referer: cleanText(body.referer)
          })
        );
      } else {
        ids.push(await aria2.addUri([url], buildAriaOptions(body)));
      }
    }

    return ids;
  }

  async function getVideoManager() {
    if (videos) return videos;

    try {
      ytDlpPath = await ensureYtDlp();
      videos = new VideoJobManager({
        ytDlpPath,
        ffmpegPath: ffmpegInstaller.path,
        downloadDir: DOWNLOAD_DIR
      });
      videoToolsError = "";
      return videos;
    } catch (error) {
      videoToolsError = error.message || "视频引擎准备失败。";
      throw error;
    }
  }

  async function listAllTasks() {
    const aria = await aria2.getTasks();
    const tasks = [...aria.tasks, ...(videos ? videos.list() : [])].sort(sortTasks);
    await organizer.processTasks(tasks);
    return { global: aria.global, tasks: organizer.decorateTasks(tasks) };
  }
}

function buildAriaOptions(body) {
  const split = clamp(Number(body.threads || 16), 1, 64);
  const options = {
    dir: resolveDownloadDir(body.dir),
    split: String(split),
    "max-connection-per-server": String(split),
    "min-split-size": "1M"
  };

  const out = cleanText(body.out);
  const rateLimit = cleanText(body.rateLimit);
  const userAgent = cleanText(body.userAgent);
  const referer = cleanText(body.referer);

  if (out) options.out = out;
  if (rateLimit) options["max-download-limit"] = rateLimit;
  if (userAgent) options["user-agent"] = userAgent;
  if (referer) options.referer = referer;

  return options;
}

function normalizeSpeedSettings(input = {}) {
  return {
    downloadLimit: normalizeLimit(input.downloadLimit),
    uploadLimit: normalizeLimit(input.uploadLimit),
    maxConcurrentDownloads: clamp(Number(input.maxConcurrentDownloads || 10), 1, 50)
  };
}

function normalizeLimit(input) {
  const value = cleanText(input || "0");
  if (!/^(0|\d+(?:\.\d+)?[KMG]?)$/i.test(value)) {
    throw new Error("限速格式无效，请使用 0、500K、2M 或 1G。");
  }
  return value.toUpperCase();
}

function resolveDownloadDir(input) {
  const text = cleanText(input);
  return text ? path.resolve(text) : DOWNLOAD_DIR;
}

function splitUrls(input) {
  return String(input || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanText(input) {
  return String(input || "").trim();
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function looksLikeVideo(url) {
  return /\.(m3u8|mpd)(\?|#|$)/i.test(url);
}

function sortTasks(a, b) {
  const weight = { active: 0, waiting: 1, paused: 2, processing: 3, complete: 4, error: 5, removed: 6 };
  return (weight[a.status] ?? 10) - (weight[b.status] ?? 10);
}

function parseSelectedFiles(input) {
  if (Array.isArray(input)) return input.map(Number).filter(Number.isFinite);
  if (input === undefined || input === null || input === "") return [];

  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) return parsed.map(Number).filter(Number.isFinite);
  } catch {
    // Fall through to comma parsing.
  }

  return String(input)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter(Number.isFinite);
}

function corsForLocalTools(request, response, next) {
  const origin = String(request.headers.origin || "");
  if (/^(chrome-extension|moz-extension):\/\//i.test(origin) || /^http:\/\/(127\.0\.0\.1|localhost):4288$/i.test(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  next();
}

function listen(app, port, host) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      server.off("error", reject);
      resolve(server);
    });
    server.once("error", reject);
  });
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function isDirectRun() {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isDirectRun()) {
  const instance = await startDownloadServer();

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
      await instance.stop();
      process.exit(0);
    });
  }
}
