import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import parseTorrent from "parse-torrent";

const pendingTorrents = new Map();

export async function inspectTorrentUpload(file) {
  const data = await fs.readFile(file.path);
  const torrent = await parseTorrent(data);
  const id = crypto.randomBytes(12).toString("hex");
  const files = normalizeFiles(torrent.files);
  const totalSize = files.reduce((sum, item) => sum + item.length, 0);

  const record = {
    id,
    path: file.path,
    originalName: file.originalname,
    name: torrent.name || file.originalname || path.basename(file.path),
    infoHash: torrent.infoHash || "",
    files,
    totalSize,
    createdAt: Date.now()
  };

  pendingTorrents.set(id, record);
  cleanupOldTorrents();

  return {
    id: record.id,
    name: record.name,
    infoHash: record.infoHash,
    files: record.files,
    totalSize: record.totalSize
  };
}

export function getPendingTorrent(id) {
  return pendingTorrents.get(id) || null;
}

function normalizeFiles(files = []) {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  return files.map((file, index) => ({
    index: index + 1,
    path: cleanPath(file.path || file.name || `file-${index + 1}`),
    name: file.name || path.basename(file.path || `file-${index + 1}`),
    length: Number(file.length || 0)
  }));
}

function cleanPath(input) {
  return String(input || "")
    .replaceAll("\\", "/")
    .replace(/^\/+/, "");
}

function cleanupOldTorrents() {
  const maxAgeMs = 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (const [id, record] of pendingTorrents.entries()) {
    if (now - record.createdAt > maxAgeMs) {
      pendingTorrents.delete(id);
      fs.rm(record.path, { force: true }).catch(() => {});
    }
  }
}
