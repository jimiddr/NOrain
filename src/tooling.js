import { createWriteStream, existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import extractZip from "extract-zip";

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configuredHome = process.env.NORAIN_HOME || process.env.ALL_LINK_DOWNLOADER_HOME;
export const APP_HOME = configuredHome ? path.resolve(configuredHome) : PROJECT_ROOT;
export const DATA_DIR = path.join(APP_HOME, "data");
export const TOOLS_DIR = path.join(APP_HOME, "tools");
export const BIN_DIR = path.join(TOOLS_DIR, "bin");
export const CACHE_DIR = path.join(TOOLS_DIR, "cache");
export const DOWNLOAD_DIR = path.join(APP_HOME, "downloads");
export const TORRENT_DIR = path.join(DATA_DIR, "torrents");
const IS_WINDOWS = process.platform === "win32";
const IS_MAC = process.platform === "darwin";

export async function ensureDirectories() {
  await Promise.all([
    fs.mkdir(DATA_DIR, { recursive: true }),
    fs.mkdir(BIN_DIR, { recursive: true }),
    fs.mkdir(CACHE_DIR, { recursive: true }),
    fs.mkdir(DOWNLOAD_DIR, { recursive: true }),
    fs.mkdir(TORRENT_DIR, { recursive: true })
  ]);
}

export function findCommand(command) {
  if (!IS_WINDOWS) {
    const commonPath = findUnixCommandPath(command);
    if (commonPath) return commonPath;
  }
  try {
    const locator = IS_WINDOWS ? "where.exe" : "/usr/bin/which";
    const output = execFileSync(locator, [command], {
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"]
    });
    return output.split(/\r?\n/).find(Boolean) ?? null;
  } catch {
    return null;
  }
}

export async function ensureYtDlp() {
  const binaryName = IS_WINDOWS ? "yt-dlp.exe" : IS_MAC ? "yt-dlp_macos" : "yt-dlp";
  const exePath = path.join(BIN_DIR, binaryName);
  if (existsSync(exePath) && isRunnable(exePath, ["--version"])) return exePath;
  if (existsSync(exePath)) await fs.rm(exePath, { force: true });

  const pathCommand = findCommand(binaryName) ?? findCommand("yt-dlp");
  if (pathCommand && isRunnable(pathCommand, ["--version"])) return pathCommand;

  await fs.rm(`${exePath}.download`, { force: true });
  await downloadFile(
    `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${binaryName}`,
    exePath
  );
  if (!IS_WINDOWS) await fs.chmod(exePath, 0o755);
  if (!isRunnable(exePath, ["--version"])) {
    await fs.rm(exePath, { force: true });
    throw new Error(`下载到的 ${binaryName} 无法运行，请稍后重试视频下载。`);
  }
  return exePath;
}

export async function ensureAria2() {
  const binaryName = IS_WINDOWS ? "aria2c.exe" : "aria2c";
  const exePath = path.join(BIN_DIR, binaryName);

  const bundledPath = getBundledAria2Path();
  if (bundledPath && isRunnable(bundledPath, ["--version"])) return bundledPath;

  const pathCommand = findCommand(binaryName) ?? findCommand("aria2c");
  if (pathCommand && isRunnable(pathCommand, ["--version"])) return pathCommand;

  if (existsSync(exePath) && isRunnable(exePath, ["--version"])) return exePath;

  if (!IS_WINDOWS) {
    throw new Error(
      IS_MAC
        ? "没有找到 NOrain 随附的 aria2。开发模式可先执行 brew install aria2。"
        : "当前系统没有找到 aria2c，请先安装 aria2。"
    );
  }

  const wingetExe = await findWingetAria2();
  if (wingetExe) return wingetExe;

  const cachedExe = await findValidFile(CACHE_DIR, "aria2c.exe", ["--version"]);
  if (cachedExe) {
    await fs.copyFile(cachedExe, exePath);
    return exePath;
  }

  const release = await fetchJson("https://api.github.com/repos/aria2/aria2/releases/latest");
  const wants64Bit = ["x64", "arm64"].includes(os.arch());
  const assets = release.assets ?? [];
  const preferred = assets.find((asset) =>
    wants64Bit
      ? /win-64bit.*\.zip$/i.test(asset.name)
      : /win-32bit.*\.zip$/i.test(asset.name)
  );
  const fallback = assets.find((asset) => /win.*\.zip$/i.test(asset.name));
  const asset = preferred ?? fallback;

  if (!asset?.browser_download_url) {
    throw new Error("没有找到适合 Windows 的 aria2 发布包。");
  }

  const zipPath = path.join(CACHE_DIR, asset.name);
  const extractDir = path.join(CACHE_DIR, path.basename(asset.name, ".zip"));

  await downloadFile(asset.browser_download_url, zipPath);
  await fs.rm(extractDir, { recursive: true, force: true });
  await fs.mkdir(extractDir, { recursive: true });
  await extractZip(zipPath, { dir: extractDir });

  const extractedExe = await findFile(extractDir, "aria2c.exe");
  if (!extractedExe) {
    throw new Error("aria2 发布包里没有找到 aria2c.exe。");
  }

  await fs.copyFile(extractedExe, exePath);
  if (!isRunnable(exePath, ["--version"])) {
    throw new Error("下载到的 aria2c.exe 无法运行，请安装 winget 包 aria2.aria2。");
  }
  return exePath;
}

export async function downloadFile(url, destination) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(240000),
    headers: {
      "User-Agent": "norain/0.1"
    }
  });

  if (!response.ok || !response.body) {
    throw new Error(`下载失败：${url} (${response.status})`);
  }

  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.download`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
  await fs.rename(temporary, destination);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "norain/0.1"
    }
  });

  if (!response.ok) {
    throw new Error(`请求失败：${url} (${response.status})`);
  }

  return response.json();
}

async function findFile(directory, fileName) {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
      return fullPath;
    }
    if (entry.isDirectory()) {
      const found = await findFile(fullPath, fileName);
      if (found) return found;
    }
  }

  return null;
}

async function findValidFile(directory, fileName, args) {
  if (!existsSync(directory)) return null;
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (["EACCES", "EPERM", "ENOENT"].includes(error.code)) return null;
    throw error;
  }

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
      if (isRunnable(fullPath, args)) return fullPath;
    }
    if (entry.isDirectory()) {
      const found = await findValidFile(fullPath, fileName, args);
      if (found) return found;
    }
  }

  return null;
}

async function findWingetAria2() {
  if (!IS_WINDOWS) return null;
  const wingetRoot = path.join(
    os.homedir(),
    "AppData",
    "Local",
    "Microsoft",
    "WinGet",
    "Packages"
  );
  const candidate = await findValidFile(wingetRoot, "aria2c.exe", ["--version"]);
  return candidate && /aria2\.aria2/i.test(candidate) ? candidate : null;
}

function isRunnable(filePath, args = []) {
  try {
    const result = spawnSync(filePath, args, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"]
    });
    return !result.error && result.status === 0;
  } catch {
    return false;
  }
}

function getBundledAria2Path() {
  if (!IS_MAC || !process.resourcesPath) return null;
  const candidate = path.join(process.resourcesPath, "aria2", "bin", "aria2c");
  return existsSync(candidate) ? candidate : null;
}

function findUnixCommandPath(command) {
  const candidates = [
    path.join("/opt/homebrew/bin", command),
    path.join("/usr/local/bin", command),
    path.join("/usr/bin", command)
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}
