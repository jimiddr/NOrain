import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStore, ScheduleManager } from "../src/automation.js";

test("JsonStore persists merged settings across repeated writes", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "norain-store-"));
  const file = path.join(dir, "settings.json");
  const store = new JsonStore(file, { speed: { downloadLimit: "0", uploadLimit: "0" }, notifications: true });
  await store.load();
  await store.set({ speed: { downloadLimit: "2M" }, notifications: false });
  await store.set({ ...store.get(), speed: { ...store.get().speed, uploadLimit: "500K" } });
  const reloaded = new JsonStore(file, { speed: { downloadLimit: "0", uploadLimit: "0" }, notifications: true });
  await reloaded.load();
  assert.deepEqual(reloaded.get(), { speed: { downloadLimit: "2M", uploadLimit: "500K" }, notifications: false });
});

test("one-time schedule runs once and remains disabled", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "norain-schedule-"));
  let now = 1_700_000_000_000;
  const executed = [];
  const manager = new ScheduleManager({
    filePath: path.join(dir, "schedules.json"),
    now: () => now,
    execute: async (task) => { executed.push(task); return ["task-1"]; }
  });
  await manager.start();
  manager.stop();
  await manager.create({ name: "test", startAt: now + 1000, task: { url: "https://example.com/file.zip" } });
  now += 1000;
  await manager.tick();
  await manager.tick();
  assert.equal(executed.length, 1);
  assert.equal(manager.list()[0].enabled, false);
  assert.equal(manager.list()[0].lastResult, "success");
});

test("daily schedule advances to the next day", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "norain-daily-"));
  let now = 1_700_000_000_000;
  const manager = new ScheduleManager({ filePath: path.join(dir, "schedules.json"), now: () => now, execute: async () => [] });
  await manager.start();
  manager.stop();
  const schedule = await manager.create({ startAt: now, repeat: "daily", task: { url: "magnet:?xt=test" } });
  await manager.tick();
  assert.equal(manager.list()[0].nextRun, schedule.nextRun + 86_400_000);
  assert.equal(manager.list()[0].enabled, true);
});
