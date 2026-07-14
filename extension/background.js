const DEFAULTS = {
  autoCapture: false,
  captureMode: "link"
};
const MENU_LINK = "send-link-to-norain";
const MENU_PAGE = "send-page-to-norain";

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(DEFAULTS);
  await chrome.storage.local.set(stored);
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: MENU_LINK, title: "用 NOrain 下载", contexts: ["link", "video", "audio"] });
  chrome.contextMenus.create({ id: MENU_PAGE, title: "用 NOrain 解析当前页面", contexts: ["page"] });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url = info.linkUrl || info.srcUrl || info.pageUrl || tab?.url;
  if (!isSupportedUrl(url)) return notify("无法发送", "这不是可下载的网页链接", true);
  sendToDownloader(url, info.menuItemId === MENU_PAGE || looksLikeVideo(url) ? "video" : "link").catch((error) => {
    notify("接管失败", error.message, true);
  });
});

chrome.downloads.onCreated.addListener(async (downloadItem) => {
  const settings = await chrome.storage.local.get(DEFAULTS);
  if (!settings.autoCapture || !isSupportedUrl(downloadItem.url)) return;
  try {
    await sendToDownloader(downloadItem.url, settings.captureMode || "link", downloadItem.filename, { quiet: true });
    await chrome.downloads.cancel(downloadItem.id);
    await chrome.downloads.erase({ id: downloadItem.id });
    notify("已接管下载", fileName(downloadItem.filename) || downloadItem.url);
  } catch (error) {
    notify("保留浏览器下载", `NOrain 未接收：${error.message}`, true);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ping") {
    pingDownloader().then(sendResponse);
    return true;
  }
  if (message?.type === "send-url") {
    sendToDownloader(message.url, message.mode || "link")
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "settings-updated") {
    chrome.storage.local.set(message.settings || {}).then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

async function sendToDownloader(url, mode = "link", filename = "", options = {}) {
  if (!isSupportedUrl(url)) throw new Error("链接格式不受支持");
  const response = await fetch(`http://127.0.0.1:4288/api/extension/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, mode, out: fileName(filename) })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `桌面端返回 ${response.status}`);
  if (!options.quiet) notify("已发送到 NOrain", fileName(filename) || url);
  return payload;
}

async function pingDownloader() {
  try {
    const response = await fetch(`http://127.0.0.1:4288/api/health`);
    return { ok: response.ok, payload: await response.json() };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function notify(title, message, error = false) {
  chrome.action.setBadgeBackgroundColor({ color: error ? "#c43f48" : "#ff671d" });
  chrome.action.setBadgeText({ text: error ? "!" : "OK" });
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.svg",
    title,
    message: String(message || "").slice(0, 220)
  }).catch(() => {});
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2600);
}

function fileName(value) {
  return String(value || "").split(/[\\/]/).pop();
}

function isSupportedUrl(url) {
  return /^(https?|ftp):\/\//i.test(url || "") || /^magnet:/i.test(url || "");
}

function looksLikeVideo(url) {
  return /\.(m3u8|mpd)(\?|#|$)/i.test(url || "") || /youtube|youtu\.be|bilibili|vimeo|tiktok|douyin/i.test(url || "");
}
