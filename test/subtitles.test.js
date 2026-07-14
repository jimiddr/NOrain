import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { computeOpenSubtitlesHash, parseReleaseName } from "../src/subtitles.js";

test("release parser extracts title, year, season and episode", () => {
  assert.deepEqual(parseReleaseName("The.Last.Show.S02E07.2026.2160p.WEB-DL.mkv"), {
    title: "The Last Show",
    year: "2026",
    season: 2,
    episode: 7,
    release: "The.Last.Show.S02E07.2026.2160p.WEB-DL"
  });
});

test("OpenSubtitles movie hash includes size and first/last 64 KiB", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "norain-hash-"));
  const file = path.join(dir, "zero.mkv");
  await fs.writeFile(file, Buffer.alloc(131072));
  assert.equal(await computeOpenSubtitlesHash(file), "0000000000020000");
});
