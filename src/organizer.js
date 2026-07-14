import fs from "node:fs/promises";
import path from "node:path";

const CATEGORY_RULES = [
  ["Videos", [".mp4", ".mkv", ".mov", ".avi", ".webm", ".m4v", ".ts", ".flv", ".wmv"]],
  ["Audio", [".mp3", ".flac", ".wav", ".m4a", ".aac", ".ogg", ".opus"]],
  ["Archives", [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".iso"]],
  ["Apps", [".exe", ".msi", ".apk", ".appx", ".msix", ".dmg"]],
  ["Documents", [".pdf", ".epub", ".txt", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"]],
  ["Images", [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".heic", ".svg"]]
];

export class DownloadOrganizer {
  constructor({ downloadDir, dataDir }) {
    this.downloadDir = downloadDir;
    this.dataFile = path.join(dataDir, "organized-files.json");
    this.records = new Map();
    this.loading = this.load();
    this.busy = false;
  }

  async processTasks(tasks) {
    await this.loading;
    if (this.busy) return;
    this.busy = true;
    try {
      for (const task of tasks) {
        await this.processTask(task);
      }
    } finally {
      this.busy = false;
    }
  }

  decorateTasks(tasks) {
    return tasks.map((task) => {
      const record = this.records.get(task.id);
      if (!record) return task;
      return {
        ...task,
        dir: path.dirname(record.filePath),
        filePath: record.filePath,
        filePaths: [record.filePath],
        organized: true,
        organizedCategory: record.category
      };
    });
  }

  async removeTaskFiles(taskId, { deleteFiles = false } = {}) {
    await this.loading;
    const record = this.records.get(taskId);
    if (!record) return;

    if (deleteFiles && record.filePath) {
      await removeIfExists(record.filePath);
      await removeSidecarFiles(record.filePath);
    }

    this.records.delete(taskId);
    await this.save();
  }

  async processTask(task) {
    if (task.status !== "complete") return;
    if (this.records.has(task.id)) return;

    const filePaths = Array.isArray(task.filePaths) && task.filePaths.length > 0
      ? task.filePaths
      : task.filePath
        ? [task.filePath]
        : [];
    if (filePaths.length !== 1) return;

    const source = path.resolve(filePaths[0]);
    if (!isPathInside(source, this.downloadDir)) return;
    if (!await isFile(source)) return;

    const category = categoryForFile(source);
    const destinationDir = path.join(this.downloadDir, category);
    const destination = await uniqueDestination(path.join(destinationDir, path.basename(source)));
    if (path.resolve(source) === path.resolve(destination)) return;

    await fs.mkdir(destinationDir, { recursive: true });
    await fs.rename(source, destination);
    await removeSidecarFiles(source);

    this.records.set(task.id, {
      filePath: destination,
      originalPath: source,
      category,
      organizedAt: new Date().toISOString()
    });
    await this.save();
  }

  async load() {
    try {
      const raw = await fs.readFile(this.dataFile, "utf8");
      const records = JSON.parse(raw);
      for (const [id, record] of Object.entries(records)) {
        if (record?.filePath) this.records.set(id, record);
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  async save() {
    await fs.mkdir(path.dirname(this.dataFile), { recursive: true });
    await fs.writeFile(
      this.dataFile,
      JSON.stringify(Object.fromEntries(this.records), null, 2),
      "utf8"
    );
  }
}

function categoryForFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  for (const [category, extensions] of CATEGORY_RULES) {
    if (extensions.includes(extension)) return category;
  }
  return "Other";
}

async function uniqueDestination(destination) {
  const parsed = path.parse(destination);
  let candidate = destination;
  let index = 2;
  while (await pathExists(candidate)) {
    candidate = path.join(parsed.dir, `${parsed.name} (${index})${parsed.ext}`);
    index += 1;
  }
  return candidate;
}

async function removeSidecarFiles(source) {
  await removeIfExists(`${source}.aria2`);
  await removeIfExists(`${source}.part`);
  await removeIfExists(`${source}.ytdl`);
}

async function removeIfExists(filePath) {
  try {
    await fs.rm(filePath, { force: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function isFile(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isPathInside(child, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
