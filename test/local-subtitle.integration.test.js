import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { acquireSubtitle, analyzeLocalVideo } from "../src/subtitles.js";

test("local video analysis discovers and extracts an embedded subtitle", async () => {
  const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
  const ffmpegPath = path.join(projectRoot, "node_modules", "@ffmpeg-installer", "win32-x64", "ffmpeg.exe");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "norain-embedded-"));
  const sourceSubtitle = path.join(dir, "source.srt");
  const videoPath = path.join(dir, "Example.Movie.2026.1080p.WEB-DL.mkv");
  await fs.writeFile(sourceSubtitle, "1\n00:00:00,000 --> 00:00:00,800\nNOrain subtitle test\n", "utf8");
  const generated = spawnSync(ffmpegPath, ["-y", "-f", "lavfi", "-i", "color=black:s=160x90:d=1", "-i", sourceSubtitle, "-c:v", "mpeg4", "-c:s", "srt", "-metadata:s:s:0", "language=eng", videoPath], { windowsHide: true, encoding: "utf8" });
  assert.equal(generated.status, 0, generated.stderr);

  const analysis = await analyzeLocalVideo({ videoPath, ffmpegPath });
  assert.equal(analysis.embedded.length, 1);
  assert.equal(analysis.embedded[0].language, "eng");

  const acquired = await acquireSubtitle({ result: analysis.embedded[0], targetVideo: videoPath, outputDir: dir, tools: { ffmpegPath }, providers: {} });
  assert.match(await fs.readFile(acquired.filePath, "utf8"), /NOrain subtitle test/);
});
