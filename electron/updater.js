import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import electronUpdater from "electron-updater";

const { autoUpdater } = electronUpdater;
const AUTO_CHECK_DELAY_MS = 5000;
const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export class UpdateController {
  constructor({ getWindow, beforeInstall }) {
    this.getWindow = getWindow;
    this.beforeInstall = beforeInstall;
    this.preferencesPath = path.join(app.getPath("userData"), "update-preferences.json");
    this.autoCheckTimer = null;
    this.autoCheckInterval = null;
    this.initialized = false;
    this.state = {
      supported: app.isPackaged && ["win32", "darwin"].includes(process.platform),
      phase: "idle",
      currentVersion: app.getVersion(),
      availableVersion: "",
      autoCheck: true,
      percent: 0,
      transferred: 0,
      total: 0,
      bytesPerSecond: 0,
      message: "尚未检查更新"
    };
  }

  async initialize() {
    if (this.initialized) return this.getState();
    this.initialized = true;
    this.state.autoCheck = await this.readAutoCheckPreference();

    if (!this.state.supported) {
      this.patchState({
        phase: "unsupported",
        message: app.isPackaged ? "当前平台暂不支持自动更新" : "开发模式不连接发布更新源"
      });
      return this.getState();
    }

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = app.getVersion().includes("-");
    autoUpdater.logger = console;
    this.bindUpdaterEvents();
    this.scheduleAutomaticChecks();
    return this.getState();
  }

  getState() {
    return { ...this.state };
  }

  async setAutoCheck(enabled) {
    this.state.autoCheck = Boolean(enabled);
    await fs.mkdir(path.dirname(this.preferencesPath), { recursive: true });
    await fs.writeFile(this.preferencesPath, JSON.stringify({ autoCheck: this.state.autoCheck }, null, 2));
    this.scheduleAutomaticChecks();
    this.broadcast();
    return this.getState();
  }

  async check({ manual = false } = {}) {
    if (!this.initialized) await this.initialize();
    if (!this.state.supported) return this.getState();
    if (["checking", "downloading"].includes(this.state.phase)) return this.getState();

    this.patchState({
      phase: "checking",
      message: manual ? "正在手动检查更新" : "正在后台检查更新",
      percent: 0,
      transferred: 0,
      total: 0,
      bytesPerSecond: 0
    });

    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      this.handleError(error);
    }
    return this.getState();
  }

  async install() {
    if (this.state.phase !== "ready") return false;
    this.patchState({ phase: "installing", message: "正在退出并安装更新" });
    await this.beforeInstall?.();
    autoUpdater.quitAndInstall(false, true);
    return true;
  }

  dispose() {
    clearTimeout(this.autoCheckTimer);
    clearInterval(this.autoCheckInterval);
    this.autoCheckTimer = null;
    this.autoCheckInterval = null;
  }

  bindUpdaterEvents() {
    autoUpdater.on("checking-for-update", () => {
      this.patchState({ phase: "checking", message: "正在检查更新" });
    });
    autoUpdater.on("update-available", (info) => {
      this.patchState({
        phase: "available",
        availableVersion: info.version || "",
        message: `发现 NOrain ${info.version || "新版本"}，正在下载`
      });
    });
    autoUpdater.on("update-not-available", (info) => {
      this.patchState({
        phase: "current",
        availableVersion: info.version || this.state.currentVersion,
        message: "当前已是最新版本"
      });
    });
    autoUpdater.on("download-progress", (progress) => {
      this.patchState({
        phase: "downloading",
        percent: Math.max(0, Math.min(100, Number(progress.percent || 0))),
        transferred: Number(progress.transferred || 0),
        total: Number(progress.total || 0),
        bytesPerSecond: Number(progress.bytesPerSecond || 0),
        message: `正在下载更新 ${Number(progress.percent || 0).toFixed(1)}%`
      });
    });
    autoUpdater.on("update-downloaded", (info) => {
      this.patchState({
        phase: "ready",
        availableVersion: info.version || this.state.availableVersion,
        percent: 100,
        message: `NOrain ${info.version || "新版本"} 已准备好`
      });
    });
    autoUpdater.on("error", (error) => this.handleError(error));
  }

  scheduleAutomaticChecks() {
    clearTimeout(this.autoCheckTimer);
    clearInterval(this.autoCheckInterval);
    this.autoCheckTimer = null;
    this.autoCheckInterval = null;
    if (!this.state.supported || !this.state.autoCheck) return;

    this.autoCheckTimer = setTimeout(() => this.check().catch(() => {}), AUTO_CHECK_DELAY_MS);
    this.autoCheckInterval = setInterval(() => this.check().catch(() => {}), AUTO_CHECK_INTERVAL_MS);
  }

  async readAutoCheckPreference() {
    try {
      const value = JSON.parse(await fs.readFile(this.preferencesPath, "utf8"));
      return value.autoCheck !== false;
    } catch (error) {
      if (error.code !== "ENOENT") console.warn("Unable to read update preferences", error);
      return true;
    }
  }

  handleError(error) {
    const message = String(error?.message || error || "未知错误")
      .replace(/https?:\/\/\S+/g, "更新服务器")
      .slice(0, 220);
    this.patchState({ phase: "error", message: `更新检查失败：${message}` });
  }

  patchState(patch) {
    Object.assign(this.state, patch);
    this.broadcast();
  }

  broadcast() {
    const window = this.getWindow?.();
    if (!window || window.isDestroyed()) return;
    window.webContents.send("update-state", this.getState());
  }
}
