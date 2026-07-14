import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("browser extension declares the complete local connector permissions", async () => {
  const manifest = JSON.parse(await fs.readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  for (const permission of ["downloads", "contextMenus", "storage", "notifications", "tabs"]) {
    assert.ok(manifest.permissions.includes(permission), `missing ${permission}`);
  }
  assert.ok(manifest.host_permissions.includes("http://127.0.0.1:4288/*"));
});

test("browser interception sends before cancelling the browser download", async () => {
  const source = await fs.readFile(new URL("../extension/background.js", import.meta.url), "utf8");
  const sendIndex = source.indexOf("await sendToDownloader(downloadItem.url");
  const cancelIndex = source.indexOf("await chrome.downloads.cancel(downloadItem.id)");
  assert.ok(sendIndex >= 0 && cancelIndex > sendIndex);
});
