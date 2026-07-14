import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

export class VideoJobManager {
  constructor({ ytDlpPath, ffmpegPath, downloadDir }) {
    this.ytDlpPath = ytDlpPath;
    this.ffmpegPath = ffmpegPath;
    this.downloadDir = downloadDir;
    this.jobs = new Map();
  }

  start(options) {
    const id = `video-${crypto.randomBytes(8).toString("hex")}`;
    const job = this.createJob(id, options);
    this.jobs.set(id, job);
    this.spawnJob(job);
    return id;
  }

  list() {
    return [...this.jobs.values()].map((job) => ({
      id: job.id,
      engine: "yt-dlp",
      kind: "video",
      name: job.name,
      status: job.status,
      total: job.total,
      completed: job.completed,
      progress: job.progress,
      downloadSpeed: job.speed,
      uploadSpeed: 0,
      connections: 0,
      seeders: 0,
      dir: job.outputDir,
      filePath: job.outputFiles[0] || "",
      filePaths: [...job.outputFiles],
      errorMessage: job.errorMessage,
      source: job.url,
      eta: job.eta,
      rawLine: job.rawLine,
      exitCode: job.exitCode
    }));
  }

  pause(id) {
    const job = this.jobs.get(id);
    if (!job) throw new Error("没有找到视频任务。");
    if (job.child && !job.child.killed) job.child.kill();
    job.status = "paused";
  }

  resume(id) {
    const job = this.jobs.get(id);
    if (!job) throw new Error("没有找到视频任务。");
    if (job.status !== "paused" && job.status !== "error") return;
    job.status = "active";
    job.errorMessage = "";
    this.spawnJob(job);
  }

  setRateLimit(id, rateLimit) {
    const job = this.jobs.get(id);
    if (!job) throw new Error("没有找到视频任务。");
    job.rateLimit = normalizeRateLimit(rateLimit);
    replaceArgument(job.args, "--limit-rate", job.rateLimit);
    if (job.child && !job.child.killed) {
      job.status = "paused";
      job.child.kill();
      setTimeout(() => {
        if (this.jobs.get(id) === job && job.status === "paused") this.spawnJob(job);
      }, 180);
    }
  }

  async remove(id, { deleteFiles = false } = {}) {
    const job = this.jobs.get(id);
    if (!job) throw new Error("没有找到视频任务。");
    if (job.child && !job.child.killed) job.child.kill();
    this.jobs.delete(id);
    if (deleteFiles) await deleteVideoFiles(job);
  }

  createJob(id, options) {
    const outputDir = options.dir || this.downloadDir;
    const args = [
      "--newline",
      "--continue",
      "--progress",
      "--paths",
      outputDir,
      "--output",
      "%(title).180B [%(id)s].%(ext)s",
      "--merge-output-format",
      "mp4",
      "--ffmpeg-location",
      path.dirname(this.ffmpegPath)
    ];

    if (!options.playlist) args.push("--no-playlist");
    if (options.format) args.push("--format", options.format);
    else args.push("--format", "bv*+ba/b");
    if (options.rateLimit) args.push("--limit-rate", options.rateLimit);
    if (options.userAgent) args.push("--user-agent", options.userAgent);
    if (options.referer) args.push("--referer", options.referer);

    args.push(options.url);

    return {
      id,
      url: options.url,
      args,
      outputDir,
      child: null,
      name: options.url,
      status: "queued",
      progress: 0,
      total: 0,
      completed: 0,
      speed: 0,
      eta: "",
      rawLine: "",
      errorMessage: "",
      exitCode: null,
      outputFiles: [],
      rateLimit: normalizeRateLimit(options.rateLimit)
    };
  }

  spawnJob(job) {
    job.status = "active";
    job.exitCode = null;
    const child = spawn(this.ytDlpPath, job.args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    job.child = child;

    child.stdout.on("data", (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) {
        parseYtDlpLine(job, line);
      }
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString().trim();
      if (text) {
        job.rawLine = text;
        if (/error/i.test(text)) job.errorMessage = text;
      }
    });

    child.on("exit", (code) => {
      job.exitCode = code;
      job.child = null;

      if (job.status === "paused") return;
      if (code === 0) {
        job.status = "complete";
        job.progress = 100;
      } else {
        job.status = "error";
        job.errorMessage ||= `yt-dlp 退出码：${code}`;
      }
    });
  }
}

function replaceArgument(args, flag, value) {
  const index = args.indexOf(flag);
  if (index >= 0) args.splice(index, 2);
  const url = args.pop();
  if (value && value !== "0") args.push(flag, value);
  args.push(url);
}

function normalizeRateLimit(value) {
  const text = String(value || "0").trim();
  return /^(0|\d+(?:\.\d+)?[KMG]?)$/i.test(text) ? text.toUpperCase() : "0";
}

export function listVideoFormats({ ytDlpPath, url }) {
  return new Promise((resolve, reject) => {
    const child = spawn(ytDlpPath, ["--no-playlist", "--list-formats", url], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let output = "";
    let errorOutput = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      errorOutput += chunk.toString();
    });
    child.on("exit", (code) => {
      if (code === 0) resolve(output.trim());
      else reject(new Error(errorOutput.trim() || `yt-dlp 退出码：${code}`));
    });
  });
}

function parseYtDlpLine(job, line) {
  job.rawLine = line;

  const destination = line.match(/\[download\]\s+Destination:\s+(.+)/);
  if (destination) {
    rememberOutputFile(job, destination[1]);
    job.name = path.basename(cleanOutputPath(destination[1]));
    return;
  }

  const merging = line.match(/\[Merger\]\s+Merging formats into\s+"(.+)"/);
  if (merging) {
    rememberOutputFile(job, merging[1]);
    job.name = path.basename(cleanOutputPath(merging[1]));
    job.status = "processing";
    return;
  }

  const progress = line.match(
    /\[download\]\s+([\d.]+)%\s+of\s+~?\s*([^\s]+)(?:\s+at\s+([^\s]+))?(?:\s+ETA\s+([^\s]+))?/i
  );
  if (progress) {
    job.status = "active";
    job.progress = Number(progress[1]);
    job.total = parseSize(progress[2]);
    job.completed = Math.round((job.progress / 100) * job.total);
    job.speed = parseSize(progress[3] || "");
    job.eta = progress[4] || "";
    return;
  }

  if (/\[download\]\s+100%/i.test(line)) {
    job.progress = 100;
  }
}

function parseSize(value) {
  const match = String(value).match(/([\d.]+)\s*([KMGT]?i?B)?/i);
  if (!match) return 0;

  const number = Number(match[1]);
  const unit = (match[2] || "B").toLowerCase();
  const multipliers = {
    b: 1,
    kb: 1000,
    mb: 1000 ** 2,
    gb: 1000 ** 3,
    tb: 1000 ** 4,
    kib: 1024,
    mib: 1024 ** 2,
    gib: 1024 ** 3,
    tib: 1024 ** 4
  };

  return Math.round(number * (multipliers[unit] ?? 1));
}

function rememberOutputFile(job, filePath) {
  const cleaned = cleanOutputPath(filePath);
  const resolved = path.isAbsolute(cleaned)
    ? path.resolve(cleaned)
    : path.resolve(job.outputDir, cleaned);
  if (!job.outputFiles.includes(resolved)) job.outputFiles.push(resolved);
}

function cleanOutputPath(filePath) {
  return String(filePath || "").trim().replace(/^"|"$/g, "");
}

async function deleteVideoFiles(job) {
  for (const target of job.outputFiles) {
    await removeFileIfExists(target);
    await removeFileIfExists(`${target}.part`);
    await removeFileIfExists(`${target}.ytdl`);
  }
}

async function removeFileIfExists(target) {
  try {
    const stat = await fs.lstat(target);
    if (stat.isDirectory()) return;
    await fs.rm(target, { force: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
