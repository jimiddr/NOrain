import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

const TASK_KEYS = [
  "gid",
  "status",
  "totalLength",
  "completedLength",
  "downloadSpeed",
  "uploadSpeed",
  "connections",
  "numSeeders",
  "seeder",
  "dir",
  "files",
  "bittorrent",
  "errorCode",
  "errorMessage"
];

export class Aria2Manager {
  constructor({ binPath, downloadDir, dataDir }) {
    this.binPath = binPath;
    this.downloadDir = downloadDir;
    this.dataDir = dataDir;
    this.secret = crypto.randomBytes(18).toString("hex");
    this.process = null;
    this.port = null;
  }

  async start() {
    await fs.mkdir(this.downloadDir, { recursive: true });
    await fs.mkdir(this.dataDir, { recursive: true });

    const sessionFile = path.join(this.dataDir, "aria2.session");
    await fs.appendFile(sessionFile, "");
    this.port = await getFreePort();

    const args = [
      `--dir=${this.downloadDir}`,
      "--enable-rpc=true",
      "--rpc-listen-all=false",
      `--rpc-listen-port=${this.port}`,
      `--rpc-secret=${this.secret}`,
      "--continue=true",
      "--file-allocation=none",
      "--auto-file-renaming=false",
      "--max-concurrent-downloads=10",
      "--max-connection-per-server=16",
      "--split=16",
      "--min-split-size=1M",
      "--bt-enable-lpd=true",
      "--enable-dht=true",
      "--enable-dht6=true",
      "--enable-peer-exchange=true",
      "--follow-torrent=mem",
      "--seed-ratio=1.0",
      "--summary-interval=0",
      `--input-file=${sessionFile}`,
      `--save-session=${sessionFile}`,
      "--save-session-interval=30"
    ];

    this.process = spawn(this.binPath, args, {
      cwd: this.downloadDir,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    this.process.stdout.on("data", (chunk) => {
      const text = chunk.toString().trim();
      if (text) console.log(`[aria2] ${text}`);
    });

    this.process.stderr.on("data", (chunk) => {
      const text = chunk.toString().trim();
      if (text) console.warn(`[aria2] ${text}`);
    });

    this.process.on("exit", (code) => {
      console.warn(`[aria2] exited with code ${code}`);
    });

    await this.waitUntilReady();
  }

  async waitUntilReady() {
    const started = Date.now();
    let lastError;

    while (Date.now() - started < 10000) {
      try {
        await this.call("aria2.getVersion", []);
        return;
      } catch (error) {
        lastError = error;
        await delay(250);
      }
    }

    throw lastError ?? new Error("aria2 启动超时。");
  }

  async call(method, params = []) {
    if (!this.port) throw new Error("aria2 还没有启动。");

    const response = await fetch(`http://127.0.0.1:${this.port}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method,
        params: [`token:${this.secret}`, ...params]
      })
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (payload.error) {
      throw new Error(payload.error.message ?? "aria2 RPC 出错。");
    }

    if (!response.ok) {
      throw new Error(`aria2 RPC 请求失败 (${response.status})`);
    }

    return payload.result;
  }

  addUri(uris, options) {
    return this.call("aria2.addUri", [uris, options]);
  }

  addTorrent(base64Torrent, options) {
    return this.call("aria2.addTorrent", [base64Torrent, [], options]);
  }

  pause(gid) {
    return this.call("aria2.forcePause", [gid]);
  }

  resume(gid) {
    return this.call("aria2.unpause", [gid]);
  }

  setTaskLimit(gid, downloadLimit) {
    return this.call("aria2.changeOption", [gid, {
      "max-download-limit": normalizeLimit(downloadLimit)
    }]);
  }

  setGlobalOptions({ downloadLimit = "0", uploadLimit = "0", maxConcurrentDownloads = 10 }) {
    return this.call("aria2.changeGlobalOption", [{
      "max-overall-download-limit": normalizeLimit(downloadLimit),
      "max-overall-upload-limit": normalizeLimit(uploadLimit),
      "max-concurrent-downloads": String(Math.max(1, Math.min(50, Number(maxConcurrentDownloads) || 10)))
    }]);
  }

  async remove(gid, { deleteFiles = false } = {}) {
    const taskForCleanup = deleteFiles ? await this.getTaskForCleanup(gid) : null;
    let result;
    try {
      result = await this.call("aria2.forceRemove", [gid]);
    } catch (error) {
      if (/not found|is not active|already removed/i.test(error.message)) {
        result = await this.call("aria2.removeDownloadResult", [gid]);
      } else {
        throw error;
      }
    }

    try {
      await this.call("aria2.removeDownloadResult", [gid]);
    } catch {
      // Active removals may not have a result entry immediately.
    }

    await this.saveSession();
    if (deleteFiles && taskForCleanup) {
      await deleteDownloadedFiles(taskForCleanup, this.downloadDir);
    }
    return result;
  }

  async getTaskForCleanup(gid) {
    try {
      return await this.call("aria2.tellStatus", [gid, TASK_KEYS]);
    } catch {
      return null;
    }
  }

  async getTasks() {
    const [active, waiting, stopped, global] = await Promise.all([
      this.call("aria2.tellActive", [TASK_KEYS]),
      this.call("aria2.tellWaiting", [0, 1000, TASK_KEYS]),
      this.call("aria2.tellStopped", [0, 1000, TASK_KEYS]),
      this.call("aria2.getGlobalStat", [])
    ]);

    return {
      tasks: [...active, ...waiting, ...stopped].map(normalizeAriaTask),
      global
    };
  }

  async saveSession() {
    try {
      await this.call("aria2.saveSession", []);
    } catch {
      // Session saving is best-effort during shutdown and cleanup.
    }
  }

  async stop() {
    await this.saveSession();

    try {
      await this.call("aria2.shutdown", []);
    } catch {
      if (this.process && !this.process.killed) {
        this.process.kill();
      }
    }
  }
}

function normalizeAriaTask(task) {
  const total = Number(task.totalLength || 0);
  const completed = Number(task.completedLength || 0);
  const file = task.files?.find((item) => item.path)?.path ?? "";
  const firstUri = task.files?.[0]?.uris?.[0]?.uri ?? "";
  const filePaths = normalizeAriaFilePaths(task.files, task.dir);
  const name =
    task.bittorrent?.info?.name ??
    (file ? path.basename(file) : "") ??
    firstUri ??
    task.gid;

  return {
    id: task.gid,
    engine: "aria2",
    kind: task.bittorrent ? "torrent" : firstUri.startsWith("magnet:") ? "magnet" : "link",
    name,
    status: task.status,
    total,
    completed,
    progress: total > 0 ? Math.min(100, (completed / total) * 100) : 0,
    downloadSpeed: Number(task.downloadSpeed || 0),
    uploadSpeed: Number(task.uploadSpeed || 0),
    connections: Number(task.connections || 0),
    seeders: Number(task.numSeeders || 0),
    dir: task.dir,
    filePath: filePaths[0] || "",
    filePaths,
    errorMessage: task.errorMessage || "",
    source: firstUri
  };
}

function normalizeAriaFilePaths(files, dir) {
  if (!Array.isArray(files)) return [];

  return files
    .map((file) => file?.path)
    .filter(Boolean)
    .map((filePath) => (
      path.isAbsolute(filePath)
        ? path.resolve(filePath)
        : path.resolve(dir || "", filePath)
    ));
}

async function deleteDownloadedFiles(task, defaultDir) {
  const root = path.resolve(task.dir || defaultDir);
  const files = Array.isArray(task.files) ? task.files : [];
  const targets = new Set(
    files
      .map((file) => file?.path)
      .filter(Boolean)
      .map((filePath) => path.resolve(filePath))
      .filter((filePath) => isPathInside(filePath, root))
  );

  for (const target of targets) {
    await removeFileIfExists(target);
    await removeFileIfExists(`${target}.aria2`);
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

function isPathInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeLimit(value) {
  const text = String(value || "0").trim();
  return /^(0|\d+(?:\.\d+)?[KMG]?)$/i.test(text) ? text.toUpperCase() : "0";
}
