const DEFAULTS = { autoCapture: false, captureMode: "link" };
const $ = (selector) => document.querySelector(selector);
const ui = { status: $("#status"), dot: $("#statusDot"), auto: $("#autoCapture"), url: $("#urlInput"), mode: $("#captureMode") };

init();
$("#refresh").addEventListener("click", checkConnection);
$("#sendLink").addEventListener("click", () => sendUrl(ui.url.value, "link"));
$("#sendVideo").addEventListener("click", () => sendUrl(ui.url.value, "video"));
$("#sendCurrent").addEventListener("click", sendCurrentPage);
$("#saveSettings").addEventListener("click", saveSettings);
ui.auto.addEventListener("change", saveSettings);

async function init() {
  const settings = await chrome.storage.local.get(DEFAULTS);
  ui.auto.checked = settings.autoCapture;
  ui.mode.value = settings.captureMode;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (isSupported(tab?.url)) ui.url.value = tab.url;
  await checkConnection();
}

async function checkConnection() {
  setStatus("正在连接桌面端", false);
  const result = await chrome.runtime.sendMessage({ type: "ping" });
  setStatus(result.ok ? `已连接 · ${result.payload?.schedules || 0} 个计划` : "桌面端未连接", result.ok);
}

async function sendCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await sendUrl(tab?.url, "video");
}

async function sendUrl(url, mode) {
  const value = String(url || "").trim();
  if (!isSupported(value)) return setStatus("请输入 http、ftp 或 magnet 链接", false);
  setStatus("正在发送", false);
  const result = await chrome.runtime.sendMessage({ type: "send-url", url: value, mode });
  setStatus(result.ok ? "已交给 NOrain" : result.error || "发送失败", result.ok);
}

async function saveSettings() {
  await chrome.runtime.sendMessage({ type: "settings-updated", settings: { autoCapture: ui.auto.checked, captureMode: ui.mode.value } });
  setStatus("设置已保存", true);
  await checkConnection();
}

function setStatus(text, online) {
  ui.status.textContent = text;
  ui.dot.classList.toggle("online", Boolean(online));
}

function isSupported(url) {
  return /^(https?|ftp):\/\//i.test(url || "") || /^magnet:/i.test(url || "");
}
