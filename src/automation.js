import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export class JsonStore {
  constructor(filePath, defaults) {
    this.filePath = filePath;
    this.defaults = structuredClone(defaults);
    this.value = structuredClone(defaults);
  }

  async load() {
    try {
      const text = await fs.readFile(this.filePath, "utf8");
      this.value = mergeValue(this.defaults, JSON.parse(text));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await this.save();
    }
    return this.value;
  }

  get() {
    return structuredClone(this.value);
  }

  async set(value) {
    this.value = mergeValue(this.defaults, value);
    await this.save();
    return this.get();
  }

  async save() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, `${JSON.stringify(this.value, null, 2)}\n`, "utf8");
  }
}

export class ScheduleManager {
  constructor({ filePath, execute, now = () => Date.now() }) {
    this.store = new JsonStore(filePath, { schedules: [] });
    this.execute = execute;
    this.now = now;
    this.timer = null;
    this.running = new Set();
  }

  async start() {
    await this.store.load();
    this.timer = setInterval(() => this.tick().catch(console.error), 1000);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  list() {
    return this.store.get().schedules.sort((a, b) => a.nextRun - b.nextRun);
  }

  async create(input) {
    const schedule = normalizeSchedule(input, this.now());
    const data = this.store.get();
    data.schedules.push(schedule);
    await this.store.set(data);
    return schedule;
  }

  async update(id, changes) {
    const data = this.store.get();
    const index = data.schedules.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("没有找到计划任务。");
    data.schedules[index] = normalizeSchedule({ ...data.schedules[index], ...changes, id }, this.now());
    await this.store.set(data);
    return data.schedules[index];
  }

  async remove(id) {
    const data = this.store.get();
    const next = data.schedules.filter((item) => item.id !== id);
    if (next.length === data.schedules.length) throw new Error("没有找到计划任务。");
    data.schedules = next;
    await this.store.set(data);
  }

  async tick() {
    const current = this.now();
    const due = this.list().filter((item) => item.enabled && item.nextRun <= current && !this.running.has(item.id));
    for (const schedule of due) await this.run(schedule, current);
  }

  async run(schedule, current) {
    this.running.add(schedule.id);
    try {
      const ids = await this.execute(schedule.task);
      await this.finishRun(schedule.id, { lastRun: current, lastResult: "success", lastIds: ids, lastError: "" });
    } catch (error) {
      await this.finishRun(schedule.id, { lastRun: current, lastResult: "error", lastError: error.message || String(error) });
    } finally {
      this.running.delete(schedule.id);
    }
  }

  async finishRun(id, result) {
    const data = this.store.get();
    const schedule = data.schedules.find((item) => item.id === id);
    if (!schedule) return;
    Object.assign(schedule, result);
    if (schedule.repeat === "daily") {
      do schedule.nextRun += 24 * 60 * 60 * 1000;
      while (schedule.nextRun <= this.now());
    } else {
      schedule.enabled = false;
    }
    await this.store.set(data);
  }
}

function normalizeSchedule(input, now) {
  const nextRun = new Date(input.nextRun ?? input.startAt).getTime();
  if (!Number.isFinite(nextRun)) throw new Error("计划时间无效。");
  if (!input.task || typeof input.task !== "object") throw new Error("计划任务缺少下载内容。");
  return {
    id: input.id || `schedule-${crypto.randomBytes(8).toString("hex")}`,
    name: String(input.name || "计划下载").trim().slice(0, 120),
    enabled: input.enabled !== false,
    repeat: input.repeat === "daily" ? "daily" : "once",
    nextRun: Math.max(nextRun, now),
    task: structuredClone(input.task),
    createdAt: Number(input.createdAt || now),
    lastRun: Number(input.lastRun || 0),
    lastResult: input.lastResult || "pending",
    lastIds: Array.isArray(input.lastIds) ? input.lastIds : [],
    lastError: String(input.lastError || "")
  };
}

function mergeValue(defaults, value) {
  if (Array.isArray(defaults)) return Array.isArray(value) ? structuredClone(value) : structuredClone(defaults);
  if (!defaults || typeof defaults !== "object") return value ?? defaults;
  const source = value && typeof value === "object" ? value : {};
  const result = { ...structuredClone(defaults), ...structuredClone(source) };
  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (defaultValue && typeof defaultValue === "object" && !Array.isArray(defaultValue)) {
      result[key] = mergeValue(defaultValue, source[key]);
    }
  }
  return result;
}
