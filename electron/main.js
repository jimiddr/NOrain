import fs from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, Notification, screen, shell, Tray } from "electron";
import { UpdateController } from "./updater.js";

process.env.NORAIN_HOME = path.join(app.getPath("userData"), "runtime");

const WINDOW_WIDTH = 390;
const INITIAL_WINDOW_HEIGHT = 420;
const MIN_WINDOW_HEIGHT = 320;
const RESIZE_DURATION = 440;
const DOWNLOAD_PROTOCOLS = ["norain", "magnet"];
const STARTUP_SCREEN = `data:text/html;charset=utf-8,${encodeURIComponent(`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: #000000;
        -webkit-app-region: drag;
      }
    </style>
  </head>
  <body></body>
</html>
`)}`;

let mainWindow = null;
let splashWindow = null;
let serverInstance = null;
let resizeAnimation = null;
let resizeTargetHeight = null;
let tray = null;
let taskMonitor = null;
let updateController = null;
let isQuitting = false;
const taskStatuses = new Map();

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on("second-instance", () => {
  const targetWindow = mainWindow || splashWindow;
  if (!targetWindow) return;
  if (targetWindow.isMinimized()) targetWindow.restore();
  targetWindow.focus();
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  updateController = new UpdateController({
    getWindow: () => mainWindow,
    beforeInstall: stopServicesForUpdate
  });
  registerIpcHandlers();
  createSplashWindow();

  const { startDownloadServer } = await import("../src/server.js");
  try {
    serverInstance = await startDownloadServer({ port: 4288 });
  } catch (error) {
    if (error.code !== "EADDRINUSE") {
      dialog.showErrorBox("启动失败", error.message || "下载服务启动失败。");
      app.quit();
      return;
    }
    serverInstance = {
      url: "http://127.0.0.1:4288",
      stop: async () => {}
    };
  }
  createTray();
  startTaskMonitor(serverInstance.url);
  await showMainInterface(serverInstance.url);
  await updateController.initialize();
});

app.on("window-all-closed", () => {
  if (process.platform === "darwin") return;
  if (!tray) app.quit();
});

app.on("before-quit", async (event) => {
  isQuitting = true;
  updateController?.dispose();
  if (taskMonitor) clearInterval(taskMonitor);
  if (!serverInstance) return;
  event.preventDefault();
  const instance = serverInstance;
  serverInstance = null;
  await instance.stop();
  app.exit(0);
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (serverInstance?.url) {
      showMainInterface(serverInstance.url);
    } else {
      createSplashWindow();
    }
  }
});

function createSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) return splashWindow;

  splashWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: INITIAL_WINDOW_HEIGHT,
    minWidth: WINDOW_WIDTH,
    maxWidth: WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    title: "NOrain",
    frame: false,
    hasShadow: false,
    resizable: false,
    maximizable: false,
    transparent: false,
    backgroundColor: "#000000",
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadURL(STARTUP_SCREEN).catch(() => {});
  splashWindow.on("closed", () => {
    splashWindow = null;
  });

  return splashWindow;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: INITIAL_WINDOW_HEIGHT,
    minWidth: WINDOW_WIDTH,
    maxWidth: WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    title: "NOrain",
    frame: false,
    hasShadow: false,
    resizable: false,
    maximizable: false,
    transparent: true,
    backgroundColor: "#00000000",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(app.getAppPath(), "electron", "preload.cjs")
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.on("close", async (event) => {
    if (isQuitting) return;
    const settings = await readServerSettings();
    if (settings.closeToTray !== false) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  if (tray) return;
  const icon = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#ff671d"/>
      <path d="M9 8h4l6 10V8h4v16h-4L13 14v10H9z" fill="white"/>
    </svg>
  `)}`).resize({ width: 20, height: 20 });
  tray = new Tray(icon);
  tray.setToolTip("NOrain - 下载引擎运行中");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "打开 NOrain", click: () => showMainInterface(serverInstance?.url || "http://127.0.0.1:4288") },
    { label: "打开下载目录", click: async () => {
      try {
        const health = await fetch(`${serverInstance?.url || "http://127.0.0.1:4288"}/api/health`).then((response) => response.json());
        await shell.openPath(health.downloads || process.env.NORAIN_HOME);
      } catch {
        await shell.openPath(process.env.NORAIN_HOME);
      }
    } },
    { label: "打开浏览器扩展目录", click: async () => {
      const extensionPath = app.isPackaged
        ? path.join(process.resourcesPath, "browser-extension")
        : path.join(app.getAppPath(), "extension");
      await shell.openPath(extensionPath);
    } },
    { label: "检查更新", click: async () => {
      await showMainInterface(serverInstance?.url || "http://127.0.0.1:4288");
      await updateController?.check({ manual: true });
    } },
    { type: "separator" },
    { label: "退出 NOrain", click: () => { isQuitting = true; app.quit(); } }
  ]));
  tray.on("double-click", () => showMainInterface(serverInstance?.url || "http://127.0.0.1:4288"));
}

function startTaskMonitor(baseUrl) {
  if (taskMonitor) clearInterval(taskMonitor);
  const inspect = async () => {
    try {
      const [tasksResponse, settings] = await Promise.all([
        fetch(`${baseUrl}/api/tasks`).then((response) => response.json()),
        readServerSettings()
      ]);
      for (const task of tasksResponse.tasks || []) {
        const previous = taskStatuses.get(task.id);
        taskStatuses.set(task.id, task.status);
        if (!previous || previous === task.status || settings.notifications === false) continue;
        if (task.status === "complete") showTaskNotification("下载完成", task.name, task);
        if (task.status === "error") showTaskNotification("下载失败", task.name, task);
      }
    } catch {
      // The server may be restarting; the next poll will recover.
    }
  };
  inspect();
  taskMonitor = setInterval(inspect, 1500);
}

async function readServerSettings() {
  try {
    const response = await fetch(`${serverInstance?.url || "http://127.0.0.1:4288"}/api/settings`);
    return response.ok ? response.json() : {};
  } catch {
    return {};
  }
}

function showTaskNotification(title, body, task) {
  if (!Notification.isSupported()) return;
  const notification = new Notification({ title: `NOrain · ${title}`, body: body || "任务状态已更新", silent: false });
  notification.on("click", async () => {
    await showMainInterface(serverInstance?.url || "http://127.0.0.1:4288");
    if (task.filePath && await pathExists(task.filePath)) shell.showItemInFolder(task.filePath);
  });
  notification.show();
}

async function showMainInterface(url) {
  if (!mainWindow) {
    createWindow();
  }

  const splashBounds = splashWindow && !splashWindow.isDestroyed() ? splashWindow.getBounds() : null;
  if (splashBounds) mainWindow.setBounds(splashBounds);

  await mainWindow.loadURL(buildInterfaceUrl(url));
  await waitForWindowPaint(mainWindow);
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  updateController?.broadcast();
  closeSplashWindow();
}

async function stopServicesForUpdate() {
  isQuitting = true;
  if (taskMonitor) {
    clearInterval(taskMonitor);
    taskMonitor = null;
  }
  if (!serverInstance) return;
  const instance = serverInstance;
  serverInstance = null;
  await instance.stop().catch(() => {});
}

function buildInterfaceUrl(url) {
  const demoTaskCount = Number(process.env.NORAIN_DEMO_TASKS || 0);
  if (!Number.isFinite(demoTaskCount) || demoTaskCount <= 0) return url;

  const targetUrl = new URL(url);
  targetUrl.searchParams.set("demoTasks", String(Math.min(12, Math.max(1, Math.round(demoTaskCount)))));
  return targetUrl.toString();
}

async function waitForWindowPaint(window) {
  try {
    await window.webContents.executeJavaScript(
      "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
    );
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
}

function closeSplashWindow() {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  splashWindow.close();
  splashWindow = null;
}

function registerIpcHandlers() {
  ipcMain.handle("read-clipboard-text", async () => clipboard.readText());

  ipcMain.handle("default-download-client-status", async () => {
    const protocols = DOWNLOAD_PROTOCOLS.map((scheme) => ({
      scheme,
      isDefault: app.isDefaultProtocolClient(scheme)
    }));

    return {
      isDefault: protocols.some((protocol) => protocol.isDefault),
      protocols
    };
  });

  ipcMain.handle("window-minimize", async () => {
    mainWindow?.minimize();
  });

  ipcMain.handle("window-close", async () => {
    mainWindow?.close();
  });

  ipcMain.handle("update-get-state", async () => {
    if (!updateController) return null;
    return updateController.initialize();
  });

  ipcMain.handle("update-check", async () => {
    return updateController?.check({ manual: true }) ?? null;
  });

  ipcMain.handle("update-set-auto-check", async (_event, enabled) => {
    return updateController?.setAutoCheck(Boolean(enabled)) ?? null;
  });

  ipcMain.handle("update-install", async () => {
    return updateController?.install() ?? false;
  });

  ipcMain.handle("window-resize-to-content", async (_event, height, options = {}) => {
    return resizeMainWindowToHeight(height, options);
  });

  ipcMain.handle("pick-download-directory", async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      title: "选择保存目录",
      properties: ["openDirectory", "createDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle("pick-video-file", async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      title: "选择需要匹配字幕的视频",
      properties: ["openFile"],
      filters: [{ name: "视频文件", extensions: ["mkv", "mp4", "avi", "mov", "webm", "m4v", "ts"] }]
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });

  ipcMain.handle("open-download-location", async (_event, targetPath, fallbackPath) => {
    const directLocation = String(targetPath || "").trim();
    const fallback = String(fallbackPath || "").trim();
    let location = String(targetPath || fallbackPath || "").trim();
    if (directLocation) {
      const resolvedLocation = path.resolve(directLocation);
      if (await pathExists(resolvedLocation)) {
        shell.showItemInFolder(resolvedLocation);
        return { selected: true };
      }

      location = fallback || path.dirname(resolvedLocation);
    }
    if (!location) throw new Error("没有可打开的下载位置。");
    const error = await shell.openPath(path.resolve(location));
    if (error) throw new Error(error);
    return true;
  });
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function resizeMainWindowToHeight(height, options = {}) {
  if (!mainWindow) return false;

  const requestedHeight = Math.ceil(Number(height || 0));
  if (!Number.isFinite(requestedHeight) || requestedHeight <= 0) return false;

  const bounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const anchorToTop = options.anchor === "top";
  const anchoredTop = Math.max(display.workArea.y, bounds.y);
  const availableBelowTop = display.workArea.y + display.workArea.height - anchoredTop - 8;
  const maxHeight = Math.max(
    MIN_WINDOW_HEIGHT,
    anchorToTop ? availableBelowTop : display.workArea.height - 16
  );
  const targetHeight = Math.max(MIN_WINDOW_HEIGHT, Math.min(requestedHeight, maxHeight));

  if (Math.abs(bounds.height - targetHeight) < 2) return targetHeight;
  if (options.animate === false) {
    if (resizeAnimation) {
      clearInterval(resizeAnimation);
      resizeAnimation = null;
      resizeTargetHeight = null;
    }

    mainWindow.setBounds({
      x: bounds.x,
      y: anchorToTop
        ? anchoredTop
        : Math.max(display.workArea.y, Math.min(bounds.y, display.workArea.y + display.workArea.height - targetHeight)),
      width: WINDOW_WIDTH,
      height: targetHeight
    });
    return targetHeight;
  }

  if (resizeAnimation && resizeTargetHeight === targetHeight) return targetHeight;
  if (resizeAnimation) clearInterval(resizeAnimation);
  resizeTargetHeight = targetHeight;

  const startHeight = bounds.height;
  const startTime = Date.now();

  resizeAnimation = setInterval(() => {
    if (!mainWindow) {
      clearInterval(resizeAnimation);
      resizeAnimation = null;
      return;
    }

    const progress = Math.min((Date.now() - startTime) / RESIZE_DURATION, 1);
    const eased = options.motion === "stretch"
      ? stretchEase(progress)
      : pressureReleaseEase(progress);
    const nextHeight = Math.round(startHeight + (targetHeight - startHeight) * eased);
    const nextY = anchorToTop
      ? anchoredTop
      : Math.min(bounds.y, display.workArea.y + display.workArea.height - nextHeight);

    mainWindow.setBounds({
      x: bounds.x,
      y: Math.max(display.workArea.y, nextY),
      width: WINDOW_WIDTH,
      height: nextHeight
    });

    if (progress >= 1) {
      clearInterval(resizeAnimation);
      resizeAnimation = null;
      resizeTargetHeight = null;
    }
  }, 16);

  return targetHeight;
}

function stretchEase(progress) {
  const t = Math.max(0, Math.min(progress, 1));
  return 1 - Math.pow(1 - t, 4);
}

function pressureReleaseEase(progress) {
  const t = Math.max(0, Math.min(progress, 1));
  if (t < 0.18) {
    const held = t / 0.18;
    return 0.04 * held * held;
  }

  const released = (t - 0.18) / 0.82;
  return 0.04 + 0.96 * (1 - Math.pow(1 - released, 2));
}
