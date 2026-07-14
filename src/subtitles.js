import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import extractZip from "extract-zip";

const SUBTITLE_EXTENSIONS = new Set([".srt", ".ass", ".ssa", ".vtt", ".sub", ".sup"]);
const VIDEO_EXTENSIONS = new Set([".mkv", ".mp4", ".avi", ".mov", ".webm", ".m4v", ".ts"]);

export async function listSubtitles({ ytDlpPath, url }) {
  const output = await run(ytDlpPath, ["--no-playlist", "--skip-download", "--dump-single-json", url]);
  const metadata = JSON.parse(output);
  return {
    title: metadata.title || url,
    manual: normalizeTracks(metadata.subtitles, false),
    automatic: normalizeTracks(metadata.automatic_captions, true)
  };
}

export async function downloadSubtitles({ ytDlpPath, ffmpegPath, url, dir, languages, automatic = true }) {
  const selected = normalizeLanguageList(languages);
  if (selected.length === 0) throw new Error("请至少选择一种字幕语言。");
  const args = ["--no-playlist", "--skip-download", "--write-subs", "--sub-langs", selected.join(","), "--sub-format", "srt/best", "--convert-subs", "srt", "--paths", dir, "--output", "%(title).180B [%(id)s].%(ext)s", "--ffmpeg-location", path.dirname(ffmpegPath)];
  if (automatic) args.push("--write-auto-subs");
  args.push(url);
  const output = await run(ytDlpPath, args);
  return { ok: true, output: output.trim() };
}

export async function analyzeLocalVideo({ videoPath, ffmpegPath }) {
  const resolved = path.resolve(String(videoPath || ""));
  const stat = await fs.stat(resolved);
  if (!stat.isFile() || !VIDEO_EXTENSIONS.has(path.extname(resolved).toLowerCase())) throw new Error("请选择可识别的视频文件。");
  const [embedded, sidecars, moviehash] = await Promise.all([
    inspectEmbeddedSubtitles(resolved, ffmpegPath),
    findSidecarSubtitles(resolved),
    stat.size >= 131072 ? computeOpenSubtitlesHash(resolved, stat.size) : null
  ]);
  return { videoPath: resolved, size: stat.size, moviehash, metadata: parseReleaseName(path.basename(resolved)), embedded, sidecars };
}

export async function searchSubtitleCenter({ query = {}, providers = {}, tools = {} }) {
  const jobs = [];
  if (query.sourceUrl && tools.ytDlpPath) jobs.push(searchSourceSubtitles(query, tools.ytDlpPath));
  if (providers.subdlApiKey) jobs.push(searchSubDL(query, providers.subdlApiKey));
  if (providers.openSubtitlesApiKey) jobs.push(searchOpenSubtitles(query, providers));
  const settled = await Promise.allSettled(jobs);
  const results = [];
  const errors = [];
  for (const item of settled) {
    if (item.status === "fulfilled") results.push(...item.value);
    else errors.push(item.reason?.message || String(item.reason));
  }
  return { results: rankResults(results, query), errors };
}

export async function acquireSubtitle({ result, targetVideo, outputDir, tools, providers }) {
  if (!result || typeof result !== "object") throw new Error("字幕结果无效。");
  if (result.provider === "sidecar") return { ok: true, filePath: result.path, existing: true };
  if (result.provider === "embedded") return extractEmbeddedSubtitle({ result, targetVideo, outputDir, ffmpegPath: tools.ffmpegPath });
  if (result.provider === "source") return downloadSubtitles({ ytDlpPath: tools.ytDlpPath, ffmpegPath: tools.ffmpegPath, url: result.sourceUrl, dir: outputDir || path.dirname(targetVideo), languages: [result.language], automatic: result.automatic });
  if (result.provider === "subdl") return downloadRemoteSubtitle(result.downloadUrl, { targetVideo, outputDir, language: result.language, apiKey: providers.subdlApiKey });
  if (result.provider === "opensubtitles") {
    const link = await getOpenSubtitlesDownloadLink(result.fileId, providers);
    return downloadRemoteSubtitle(link, { targetVideo, outputDir, language: result.language });
  }
  if (result.provider === "direct") return downloadRemoteSubtitle(result.downloadUrl, { targetVideo, outputDir, language: result.language || "und" });
  throw new Error("不支持这个字幕来源。");
}

export function parseReleaseName(fileName) {
  const stem = path.parse(String(fileName || "")).name;
  const seasonEpisode = stem.match(/(?:S(\d{1,2})E(\d{1,3})|(\d{1,2})x(\d{1,3}))/i);
  const year = stem.match(/(?:^|[. _-])((?:19|20)\d{2})(?:[. _-]|$)/)?.[1] || "";
  const cutoff = [year ? stem.indexOf(year) : -1, seasonEpisode?.index ?? -1, ...["2160p", "1080p", "720p", "WEB-DL", "BluRay", "HDTV"].map((token) => stem.toLowerCase().indexOf(token.toLowerCase()))].filter((index) => index > 0);
  const titleEnd = cutoff.length ? Math.min(...cutoff) : stem.length;
  const title = stem.slice(0, titleEnd).replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
  return { title: title || stem, year, season: Number(seasonEpisode?.[1] || seasonEpisode?.[3] || 0), episode: Number(seasonEpisode?.[2] || seasonEpisode?.[4] || 0), release: stem };
}

export async function computeOpenSubtitlesHash(filePath, knownSize) {
  const stat = knownSize ? { size: knownSize } : await fs.stat(filePath);
  if (stat.size < 131072) throw new Error("文件太小，无法计算影片哈希。");
  const handle = await fs.open(filePath, "r");
  try {
    let hash = BigInt(stat.size);
    for (const position of [0, stat.size - 65536]) {
      const buffer = Buffer.alloc(65536);
      await handle.read(buffer, 0, buffer.length, position);
      for (let offset = 0; offset < buffer.length; offset += 8) hash = BigInt.asUintN(64, hash + buffer.readBigUInt64LE(offset));
    }
    return hash.toString(16).padStart(16, "0");
  } finally {
    await handle.close();
  }
}

async function inspectEmbeddedSubtitles(videoPath, ffmpegPath) {
  const output = await runForOutput(ffmpegPath, ["-hide_banner", "-i", videoPath]);
  return output.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/Stream #0:(\d+)(?:\(([^)]+)\))?.*Subtitle:\s*([^,\s]+)/i);
    if (!match) return [];
    const title = line.match(/title\s*:\s*(.+)$/i)?.[1]?.trim() || "";
    return [{ provider: "embedded", index: Number(match[1]), language: match[2] || "und", codec: match[3], title, score: 100 }];
  });
}

async function findSidecarSubtitles(videoPath) {
  const parsed = path.parse(videoPath);
  const files = await fs.readdir(parsed.dir, { withFileTypes: true });
  const normalizedStem = normalizeName(parsed.name);
  return files.filter((entry) => entry.isFile() && SUBTITLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) && normalizeName(path.parse(entry.name).name).includes(normalizedStem)).map((entry) => ({ provider: "sidecar", path: path.join(parsed.dir, entry.name), name: entry.name, language: inferLanguage(entry.name), score: 110 }));
}

async function searchSourceSubtitles(query, ytDlpPath) {
  const data = await listSubtitles({ ytDlpPath, url: query.sourceUrl });
  return [...data.manual.map((track) => ({ ...track, provider: "source", sourceUrl: query.sourceUrl, name: data.title, score: 95 })), ...data.automatic.map((track) => ({ ...track, provider: "source", sourceUrl: query.sourceUrl, name: data.title, score: 72 }))];
}

async function searchSubDL(query, apiKey) {
  const params = new URLSearchParams({ api_key: apiKey, languages: toSubDLLanguages(query.languages).join(","), subs_per_page: "30", releases: "1", hi: "1", unpack: "1" });
  if (query.title) params.set("film_name", query.title);
  if (query.release) params.set("file_name", query.release);
  if (query.year) params.set("year", query.year);
  if (query.season) params.set("season_number", query.season);
  if (query.episode) params.set("episode_number", query.episode);
  const response = await fetch(`https://api.subdl.com/api/v1/subtitles?${params}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  const payload = await response.json();
  if (!response.ok || payload.status === false) throw new Error(payload.error || "SubDL 查询失败。");
  return (payload.subtitles || []).map((item) => ({ provider: "subdl", id: String(item.id || item.n_id || item.url), name: item.release_name || item.name, release: item.release_name || "", language: item.language || "und", format: item.format || path.extname(item.name || "").slice(1), fps: item.fps || "", hearingImpaired: Boolean(item.hi), downloadUrl: new URL(item.url, "https://dl.subdl.com").href, score: 76 }));
}

async function searchOpenSubtitles(query, providers) {
  const params = new URLSearchParams({ languages: normalizeLanguageList(query.languages).join(",") || "zh-cn,en" });
  if (query.moviehash) params.set("moviehash", query.moviehash);
  if (query.title) params.set("query", query.title);
  if (query.release) params.set("query", query.release);
  if (query.year) params.set("year", query.year);
  if (query.season) params.set("season_number", query.season);
  if (query.episode) params.set("episode_number", query.episode);
  const response = await fetch(`https://api.opensubtitles.com/api/v1/subtitles?${params}`, { headers: openSubtitlesHeaders(providers), signal: AbortSignal.timeout(15000) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "OpenSubtitles 查询失败。");
  return (payload.data || []).flatMap((item) => (item.attributes?.files || []).map((file) => ({ provider: "opensubtitles", id: String(item.id), fileId: file.file_id, name: file.file_name || item.attributes?.release || "OpenSubtitles", release: item.attributes?.release || "", language: item.attributes?.language || "und", hearingImpaired: Boolean(item.attributes?.hearing_impaired), downloads: item.attributes?.download_count || 0, score: query.moviehash ? 92 : 80 })));
}

async function getOpenSubtitlesDownloadLink(fileId, providers) {
  const headers = { ...openSubtitlesHeaders(providers), "Content-Type": "application/json" };
  if (providers.openSubtitlesToken) headers.Authorization = `Bearer ${providers.openSubtitlesToken}`;
  const response = await fetch("https://api.opensubtitles.com/api/v1/download", { method: "POST", headers, body: JSON.stringify({ file_id: Number(fileId) }), signal: AbortSignal.timeout(15000) });
  const payload = await response.json();
  if (!response.ok || !payload.link) throw new Error(payload.message || "OpenSubtitles 下载授权失败。");
  return payload.link;
}

function openSubtitlesHeaders(providers) {
  return { "Api-Key": providers.openSubtitlesApiKey, "User-Agent": "NOrain v0.3" };
}

async function extractEmbeddedSubtitle({ result, targetVideo, outputDir, ffmpegPath }) {
  if (!targetVideo) throw new Error("提取内嵌字幕需要本地视频文件。");
  const imageSubtitle = /pgs|dvd_subtitle|dvb_subtitle/i.test(result.codec || "");
  const extension = /pgs/i.test(result.codec || "") ? ".sup" : imageSubtitle ? ".sub" : ".srt";
  const destination = subtitleDestination(targetVideo, outputDir, result.language, extension);
  await run(ffmpegPath, ["-y", "-i", targetVideo, "-map", `0:${Number(result.index)}`, "-c:s", imageSubtitle ? "copy" : "srt", destination]);
  return { ok: true, filePath: destination };
}

async function downloadRemoteSubtitle(url, { targetVideo, outputDir, language, apiKey }) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("字幕下载地址无效。");
  if (apiKey && parsed.hostname.endsWith("subdl.com")) parsed.searchParams.set("api_key", apiKey);
  const response = await fetch(parsed, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`字幕下载失败 (${response.status})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const dir = outputDir || (targetVideo ? path.dirname(targetVideo) : process.cwd());
  await fs.mkdir(dir, { recursive: true });
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) return extractSubtitleArchive(buffer, { targetVideo, dir, language });
  const extension = SUBTITLE_EXTENSIONS.has(path.extname(parsed.pathname).toLowerCase()) ? path.extname(parsed.pathname).toLowerCase() : ".srt";
  const destination = subtitleDestination(targetVideo, dir, language, extension);
  await fs.writeFile(destination, buffer);
  return { ok: true, filePath: destination };
}

async function extractSubtitleArchive(buffer, { targetVideo, dir, language }) {
  const temporaryDir = path.join(dir, `.norain-subs-${crypto.randomBytes(5).toString("hex")}`);
  const archive = `${temporaryDir}.zip`;
  await fs.writeFile(archive, buffer);
  await fs.mkdir(temporaryDir, { recursive: true });
  try {
    await extractZip(archive, { dir: temporaryDir });
    const candidates = await findSubtitleFiles(temporaryDir);
    if (candidates.length === 0) throw new Error("字幕压缩包中没有可识别的字幕文件。");
    const chosen = candidates.sort((a, b) => scoreFileName(b, targetVideo) - scoreFileName(a, targetVideo))[0];
    const destination = subtitleDestination(targetVideo, dir, language, path.extname(chosen));
    await fs.copyFile(chosen, destination);
    return { ok: true, filePath: destination, archiveEntries: candidates.length };
  } finally {
    await fs.rm(archive, { force: true });
    await fs.rm(temporaryDir, { recursive: true, force: true });
  }
}

async function findSubtitleFiles(directory) {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await findSubtitleFiles(fullPath));
    else if (SUBTITLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) result.push(fullPath);
  }
  return result;
}

function subtitleDestination(videoPath, outputDir, language, extension) {
  const base = videoPath ? path.parse(videoPath).name : "subtitle";
  return path.join(outputDir || path.dirname(videoPath), `${base}.${normalizeLanguageTag(language)}${extension}`);
}

function rankResults(results, query) {
  const release = normalizeName(query.release || "");
  return results.map((item) => ({ ...item, score: Math.min(100, Number(item.score || 50) + (release && normalizeName(item.release || item.name).includes(release.slice(0, 18)) ? 12 : 0)) })).sort((a, b) => b.score - a.score);
}

function scoreFileName(filePath, targetVideo) {
  if (!targetVideo) return 0;
  const subtitle = normalizeName(path.parse(filePath).name);
  const video = normalizeName(path.parse(targetVideo).name);
  let score = 0;
  for (const token of video.split(" ").filter((item) => item.length > 2)) if (subtitle.includes(token)) score += 1;
  return score;
}

function normalizeTracks(source, automatic) {
  if (!source || typeof source !== "object") return [];
  return Object.entries(source).map(([language, formats]) => ({ language, automatic, formats: [...new Set((formats || []).map((item) => item.ext).filter(Boolean))] })).sort((a, b) => a.language.localeCompare(b.language));
}

function normalizeLanguageList(input) {
  const values = Array.isArray(input) ? input : String(input || "").split(",");
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
}

function toSubDLLanguages(input) {
  return normalizeLanguageList(input).map((item) => (
    { "zh-cn": "ZH", "zh-hans": "ZH", "zh-tw": "ZT", "zh-hant": "ZT", en: "EN", ja: "JA", ko: "KO" }[item.toLowerCase()]
    || item.toUpperCase()
  ));
}

function normalizeLanguageTag(language) {
  return String(language || "und").replace(/[^a-z0-9-]/gi, "-").slice(0, 20) || "und";
}

function inferLanguage(fileName) {
  return fileName.match(/\.(zh-cn|zh-hans|zh-tw|zh-hant|chs|cht|en|ja|ko)(?:\.|$)/i)?.[1] || "und";
}

function normalizeName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").trim();
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve(stdout || stderr) : reject(new Error(stderr.trim() || `字幕工具退出码：${code}`)));
  });
}

function runForOutput(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.on("error", reject);
    child.on("exit", () => resolve(output));
  });
}
