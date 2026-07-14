import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

test("server persists policies and schedule CRUD through the real API", async () => {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "norain-server-"));
  const bin = path.join(home, "tools", "bin");
  await fs.mkdir(bin, { recursive: true });
  await fs.copyFile(path.join(projectRoot, "tools", "bin", "aria2c.exe"), path.join(bin, "aria2c.exe"));
  process.env.NORAIN_HOME = home;

  const { startDownloadServer } = await import(`../src/server.js?test=${Date.now()}`);
  const instance = await startDownloadServer({ port: 0 });
  try {
    const settings = await request(instance.url, "/api/settings");
    assert.equal(settings.speed.maxConcurrentDownloads, 10);

    const updated = await request(instance.url, "/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speed: { downloadLimit: "2M", uploadLimit: "500K", maxConcurrentDownloads: 3 } })
    });
    assert.deepEqual(updated.speed, { downloadLimit: "2M", uploadLimit: "500K", maxConcurrentDownloads: 3 });

    const schedule = await request(instance.url, "/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startAt: Date.now() + 60_000, task: { url: "https://example.com/test.zip" } })
    });
    assert.match(schedule.id, /^schedule-/);
    const listed = await request(instance.url, "/api/schedules");
    assert.equal(listed.schedules.length, 1);
    await request(instance.url, `/api/schedules/${schedule.id}`, { method: "DELETE" });

    const subtitles = await request(instance.url, "/api/subtitle-center/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: { title: "Example", languages: ["zh-CN"] }, directUrl: "https://example.com/example.zh-CN.srt" })
    });
    assert.equal(subtitles.results[0].provider, "direct");

    const blockedOrigin = await fetch(`${instance.url}/api/settings`, { headers: { Origin: "https://example.com" } });
    assert.equal(blockedOrigin.headers.get("access-control-allow-origin"), null);
    const extensionOrigin = await fetch(`${instance.url}/api/settings`, { headers: { Origin: "chrome-extension://abcdefghijklmnop" } });
    assert.equal(extensionOrigin.headers.get("access-control-allow-origin"), "chrome-extension://abcdefghijklmnop");
  } finally {
    await instance.stop();
  }
});

async function request(base, pathname, options) {
  const response = await fetch(`${base}${pathname}`, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}
