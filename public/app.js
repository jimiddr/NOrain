const state = {
  mode: "link",
  filter: "all",
  tasks: [],
  health: null,
  defaultDownload: null,
  fastestTaskId: null,
  focusedDockTaskId: null,
  renderedTaskIds: [],
  currentTorrent: null,
  queueDockOpen: false,
  subtitles: [],
  subtitleMode: "task",
  subtitleContext: null,
  limitTaskId: null
};

const elements = {
  quickAdd: document.querySelector("#quickAdd"),
  addTaskButton: document.querySelector("#addTaskButton"),
  refreshButton: document.querySelector("#refreshButton"),
  minimizeWindow: document.querySelector("#minimizeWindow"),
  closeWindow: document.querySelector("#closeWindow"),
  themeToggle: document.querySelector("#themeToggle"),
  toolsButton: document.querySelector("#toolsButton"),
  engineStatus: document.querySelector("#engineStatus"),
  downloadDir: document.querySelector("#downloadDir"),
  globalDown: document.querySelector("#globalDown"),
  globalUp: document.querySelector("#globalUp"),
  homeMetrics: document.querySelector(".home-metrics"),
  homePath: document.querySelector(".home-path"),
  queueSummary: document.querySelector("#queueSummary"),
  queueDock: document.querySelector("#queueDock"),
  tasks: document.querySelector("#tasks"),
  empty: document.querySelector("#emptyState"),
  dialog: document.querySelector("#taskDialog"),
  form: document.querySelector("#taskForm"),
  closeTaskDialog: document.querySelector("#closeTaskDialog"),
  submitTaskButton: document.querySelector("#submitTaskButton"),
  dialogHint: document.querySelector("#dialogHint"),
  urls: document.querySelector("#urls"),
  torrentFile: document.querySelector("#torrentFile"),
  pickTorrentButton: document.querySelector("#pickTorrentButton"),
  sourceSummary: document.querySelector("#sourceSummary"),
  torrentPanel: document.querySelector("#torrentPanel"),
  torrentName: document.querySelector("#torrentName"),
  torrentMeta: document.querySelector("#torrentMeta"),
  torrentFiles: document.querySelector("#torrentFiles"),
  selectAllTorrent: document.querySelector("#selectAllTorrent"),
  selectNoneTorrent: document.querySelector("#selectNoneTorrent"),
  dir: document.querySelector("#dir"),
  pickDirButton: document.querySelector("#pickDirButton"),
  clearDirButton: document.querySelector("#clearDirButton"),
  out: document.querySelector("#out"),
  formatsButton: document.querySelector("#formatsButton"),
  formatDialog: document.querySelector("#formatDialog"),
  formatOutput: document.querySelector("#formatOutput"),
  closeFormats: document.querySelector("#closeFormats"),
  deleteDialog: document.querySelector("#deleteDialog"),
  deleteTarget: document.querySelector("#deleteTarget"),
  cancelDeleteButton: document.querySelector("#cancelDeleteButton"),
  deleteListOnlyButton: document.querySelector("#deleteListOnlyButton"),
  deleteFilesButton: document.querySelector("#deleteFilesButton"),
  toolsDialog: document.querySelector("#toolsDialog"),
  closeToolsButton: document.querySelector("#closeToolsButton"),
  globalDownloadLimit: document.querySelector("#globalDownloadLimit"),
  globalUploadLimit: document.querySelector("#globalUploadLimit"),
  maxConcurrentDownloads: document.querySelector("#maxConcurrentDownloads"),
  notificationsEnabled: document.querySelector("#notificationsEnabled"),
  closeToTray: document.querySelector("#closeToTray"),
  savePolicyButton: document.querySelector("#savePolicyButton"),
  scheduleUrl: document.querySelector("#scheduleUrl"),
  scheduleTime: document.querySelector("#scheduleTime"),
  scheduleRepeat: document.querySelector("#scheduleRepeat"),
  addScheduleButton: document.querySelector("#addScheduleButton"),
  scheduleList: document.querySelector("#scheduleList"),
  subtitleTask: document.querySelector("#subtitleTask"),
  subtitleVideoPath: document.querySelector("#subtitleVideoPath"),
  pickSubtitleVideo: document.querySelector("#pickSubtitleVideo"),
  subtitleTitle: document.querySelector("#subtitleTitle"),
  subtitleYear: document.querySelector("#subtitleYear"),
  subtitleSeason: document.querySelector("#subtitleSeason"),
  subtitleEpisode: document.querySelector("#subtitleEpisode"),
  subtitleRelease: document.querySelector("#subtitleRelease"),
  subtitleLanguages: document.querySelector("#subtitleLanguages"),
  subtitleDirectUrl: document.querySelector("#subtitleDirectUrl"),
  subdlApiKey: document.querySelector("#subdlApiKey"),
  openSubtitlesApiKey: document.querySelector("#openSubtitlesApiKey"),
  openSubtitlesToken: document.querySelector("#openSubtitlesToken"),
  saveSubtitleProviders: document.querySelector("#saveSubtitleProviders"),
  searchSubtitlesButton: document.querySelector("#searchSubtitlesButton"),
  subtitleResults: document.querySelector("#subtitleResults"),
  downloadSubtitlesButton: document.querySelector("#downloadSubtitlesButton"),
  limitDialog: document.querySelector("#limitDialog"),
  limitTarget: document.querySelector("#limitTarget"),
  taskDownloadLimit: document.querySelector("#taskDownloadLimit"),
  closeLimitButton: document.querySelector("#closeLimitButton"),
  saveTaskLimitButton: document.querySelector("#saveTaskLimitButton"),
  currentVersion: document.querySelector("#currentVersion"),
  autoUpdateCheck: document.querySelector("#autoUpdateCheck"),
  updateStatusText: document.querySelector("#updateStatusText"),
  updatePercent: document.querySelector("#updatePercent"),
  updateProgress: document.querySelector("#updateProgress"),
  updateMeta: document.querySelector("#updateMeta"),
  checkUpdateButton: document.querySelector("#checkUpdateButton"),
  installUpdateButton: document.querySelector("#installUpdateButton")
};

const defaultHint = "粘贴链接、磁力链接、视频页面，或选择种子文件";
const demoTaskCount = getDemoTaskCount();
const captureQueueState = new URLSearchParams(window.location.search).get("captureState");
let resizeTimer = null;
let collapseResizeTimer = null;
let dockCollapseResizeTimer = null;
let dockCollapseIntentTimer = null;
let dockRevealToken = 0;
let pendingQueueMode = null;
let dockRowFocusTimer = null;
let pendingDockRowFocusId = null;
let dockPointerPosition = null;
let isPointerInQueueRegion = false;
let taskPanelTransitionTimer = null;
let taskPanelAnimations = [];
let taskPanelMotionToken = 0;
let taskPanelMotionTargets = [];
let queueDockMotion = null;
let pendingDeleteChoice = null;
let toolsResizeFrame = 0;
const TASK_PANEL_ANIMATION_MS = 280;
const TASK_PANEL_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const QUEUE_DOCK_ANIMATION_MS = 240;
const QUEUE_DOCK_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const DOCK_COLLAPSE_GRACE_MS = 420;

elements.quickAdd.addEventListener("click", openTaskDialog);
elements.addTaskButton.addEventListener("click", openTaskDialog);
elements.refreshButton.addEventListener("click", refreshTasks);
elements.minimizeWindow.addEventListener("click", () => window.downloader?.minimizeWindow?.());
elements.closeWindow.addEventListener("click", () => window.downloader?.closeWindow?.());
elements.closeTaskDialog.addEventListener("click", closeTaskPanel);
elements.submitTaskButton.addEventListener("click", submitTask);
elements.pickTorrentButton.addEventListener("click", () => elements.torrentFile.click());
elements.toolsButton.addEventListener("click", openToolsDialog);
elements.closeToolsButton.addEventListener("click", closeToolsDialog);
elements.savePolicyButton.addEventListener("click", savePolicy);
elements.addScheduleButton.addEventListener("click", addSchedule);
elements.searchSubtitlesButton.addEventListener("click", searchSubtitles);
elements.downloadSubtitlesButton.addEventListener("click", downloadSelectedSubtitles);
elements.pickSubtitleVideo.addEventListener("click", pickSubtitleVideo);
elements.saveSubtitleProviders.addEventListener("click", saveSubtitleProviders);
document.querySelectorAll("[data-subtitle-mode]").forEach((button) => button.addEventListener("click", () => setSubtitleMode(button.dataset.subtitleMode)));
elements.closeLimitButton.addEventListener("click", () => elements.limitDialog.close());
elements.saveTaskLimitButton.addEventListener("click", saveTaskLimit);
elements.checkUpdateButton.addEventListener("click", checkForAppUpdate);
elements.installUpdateButton.addEventListener("click", installAppUpdate);
elements.autoUpdateCheck.addEventListener("change", saveAutoUpdatePreference);
document.querySelectorAll("[data-tool-tab]").forEach((button) => button.addEventListener("click", () => switchToolTab(button.dataset.toolTab)));
elements.toolsDialog.addEventListener("close", handleToolsDialogClosed);
elements.scheduleList.addEventListener("click", handleScheduleAction);
elements.scheduleList.addEventListener("change", handleScheduleToggle);

elements.pickDirButton.addEventListener("click", async () => {
  try {
    if (!window.downloader?.pickDirectory) {
      showStatus("网页模式使用默认下载目录");
      return;
    }

    const selected = await window.downloader.pickDirectory();
    if (selected) elements.dir.value = selected;
  } catch (error) {
    showStatus(error.message || "目录选择失败");
  }
});

elements.clearDirButton.addEventListener("click", () => {
  elements.dir.value = "";
});

elements.urls.addEventListener("input", () => {
  if (elements.torrentFile.files.length === 0) {
    setMode(inferModeFromText(elements.urls.value));
    updateSourceSummary();
  }
});

elements.torrentFile.addEventListener("change", () => {
  if (elements.torrentFile.files.length > 0) {
    setMode("torrent");
    inspectTorrent().catch((error) => showStatus(error.message));
  } else {
    clearTorrentPanel();
    setMode(inferModeFromText(elements.urls.value));
  }
  updateSourceSummary();
});

elements.selectAllTorrent.addEventListener("click", () => {
  elements.torrentFiles.querySelectorAll("input[type='checkbox']").forEach((input) => {
    input.checked = true;
  });
  updateTorrentSummary();
});

elements.selectNoneTorrent.addEventListener("click", () => {
  elements.torrentFiles.querySelectorAll("input[type='checkbox']").forEach((input) => {
    input.checked = false;
  });
  updateTorrentSummary();
});

elements.torrentFiles.addEventListener("change", (event) => {
  if (event.target.matches("input[type='checkbox']")) updateTorrentSummary();
});

elements.formatsButton.addEventListener("click", showVideoFormats);
elements.closeFormats.addEventListener("click", () => elements.formatDialog.close());
elements.cancelDeleteButton.addEventListener("click", () => resolveDeleteChoice(null));
elements.deleteListOnlyButton.addEventListener("click", () => resolveDeleteChoice("list"));
elements.deleteFilesButton.addEventListener("click", () => resolveDeleteChoice("files"));
elements.deleteDialog.addEventListener("cancel", () => resolveDeleteChoice(null));
elements.deleteDialog.addEventListener("close", () => {
  if (pendingDeleteChoice) resolveDeleteChoice(null);
});
document.addEventListener("pointermove", trackQueueDockPointer, { passive: true });
document.addEventListener("pointerleave", leaveQueueDockRegion);
document.addEventListener("mousedown", handleQueueDockMouseDown, true);
elements.tasks.addEventListener("pointermove", focusDockTaskFromPointer);
elements.tasks.addEventListener("pointerleave", clearFocusedDockTask);

window.downloader?.onUpdateState?.(renderUpdateState);

elements.themeToggle.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme;
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("theme", next);
  updateIcons();
});

elements.tasks.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { id, action } = button.dataset;
  const task = state.tasks.find((item) => item.id === id);

  try {
    if (task?.engine === "demo") {
      showStatus("Demo mode: task buttons are visual only");
      return;
    }

    if (action === "open-location") {
      await openTaskLocation(task);
      return;
    }

    if (action === "limit") {
      openTaskLimit(task);
      return;
    }

    if (action === "subtitles") {
      await openSubtitleForTask(task);
      return;
    }

    if (action === "remove") {
      const choice = await askDeleteChoice(task);
      if (!choice) return;
      const suffix = choice === "files" ? "?files=1" : "";
      await fetchJson(`/api/tasks/${id}${suffix}`, { method: "DELETE" });
      await refreshTasks();
      return;
    }

    const method = "POST";
    const url = `/api/tasks/${id}/${action}`;
    await fetchJson(url, { method });
    await refreshTasks();
  } catch (error) {
    showStatus(error.message);
  }
});

init();

async function init() {
  const storedTheme = localStorage.getItem("theme");
  if (storedTheme) document.documentElement.dataset.theme = storedTheme;
  elements.quickAdd.insertAdjacentElement("afterend", elements.dialog);
  installContentResizeObserver();
  setMode("link");
  updateIcons();

  try {
    const health = await fetchJson("/api/health");
    state.health = health;
    state.defaultDownload = await readDefaultDownloadStatus();
    elements.engineStatus.textContent = health.videoReady ? "全部引擎已就绪" : "下载引擎已就绪";
    elements.downloadDir.textContent = health.downloads || "默认下载目录";
  } catch (error) {
    showStatus(error.message);
  }

  if (state.health) {
    elements.engineStatus.textContent = startupStatusText(state.health, state.defaultDownload);
  }

  await refreshTasks();
  scheduleWindowResize();
  setInterval(refreshTasks, 1000);
}

async function openTaskDialog() {
  if (elements.dialog.classList.contains("is-open")) {
    await closeTaskPanel();
    return;
  }
  if (document.body.classList.contains("is-task-panel-moving")) return;

  resetTaskForm();
  beginTaskPanelTransition(TASK_PANEL_ANIMATION_MS + 80);
  const detected = await fillFromClipboard();
  updateTaskPanelHeight();
  updateIcons();
  await animateTaskPanelOpen();

  if (!elements.dialog.classList.contains("is-open")) return;
  if (detected) {
    elements.pickDirButton.focus();
  } else {
    elements.urls.focus();
  }
}

async function closeTaskPanel() {
  if (!elements.dialog.classList.contains("is-open")) return;
  if (collapseResizeTimer) clearTimeout(collapseResizeTimer);
  cancelTaskPanelAnimations();
  beginTaskPanelTransition();
  updateTaskPanelHeight();

  const followers = getTaskPanelMotionTargets().filter((target) => target !== elements.dialog);
  const panelHeight = Math.ceil(elements.dialog.getBoundingClientRect().height || elements.dialog.scrollHeight);
  const closeDistance = Math.max(20, panelHeight);
  const motionToken = taskPanelMotionToken;

  elements.dialog.classList.add("is-prepared", "is-open");
  document.body.classList.remove("is-task-form-open");
  taskPanelMotionTargets = [elements.dialog, ...followers];
  taskPanelMotionTargets.forEach((target) => {
    target.style.willChange = "transform";
  });
  elements.dialog.style.willChange = "transform, opacity";

  const animations = [
    elements.dialog.animate(
      [
        { transform: "translate3d(0, 0, 0)", opacity: 1 },
        { transform: "translate3d(0, -10px, 0)", opacity: 0 }
      ],
      panelMotionOptions()
    ),
    ...followers.map((target) => target.animate(
      [
        { transform: "translate3d(0, 0, 0)" },
        { transform: `translate3d(0, -${closeDistance}px, 0)` }
      ],
      panelMotionOptions()
    ))
  ];
  taskPanelAnimations = animations;
  await settleAnimations(animations);
  if (motionToken !== taskPanelMotionToken) return;

  elements.dialog.classList.remove("is-prepared", "is-open");
  elements.dialog.setAttribute("aria-hidden", "true");
  animations.forEach((animation) => animation.cancel());
  taskPanelAnimations = [];
  clearTaskPanelMotionStyles();
  await resizeWindowToContent({ includePanel: false, animate: false });
  elements.quickAdd.focus();
}

async function animateTaskPanelOpen() {
  cancelTaskPanelAnimations();
  const motionToken = taskPanelMotionToken;

  const movingTargets = getTaskPanelMotionTargets();
  const followers = movingTargets.filter((target) => target !== elements.dialog);
  const before = new Map(followers.map((target) => [target, target.getBoundingClientRect()]));

  elements.dialog.classList.add("is-prepared");
  elements.dialog.setAttribute("aria-hidden", "false");
  updateTaskPanelHeight();
  elements.dialog.classList.add("is-open");
  document.body.classList.add("is-task-form-open");

  const panelStartY = -10;
  taskPanelMotionTargets = [elements.dialog, ...followers];
  taskPanelMotionTargets.forEach((target) => {
    target.style.willChange = "transform";
  });
  elements.dialog.style.willChange = "transform, opacity";
  elements.dialog.style.transform = `translate3d(0, ${panelStartY}px, 0)`;
  elements.dialog.style.opacity = "0";

  const followerMotions = [];
  followers.forEach((target) => {
    const after = target.getBoundingClientRect();
    const previous = before.get(target);
    const deltaY = previous ? Math.round(previous.top - after.top) : 0;
    followerMotions.push({ target, deltaY });
    if (deltaY !== 0) target.style.transform = `translate3d(0, ${deltaY}px, 0)`;
  });

  await resizeWindowToContent({ includePanel: true, animate: false });
  await waitForViewportToSettle();
  if (motionToken !== taskPanelMotionToken) return;

  const animations = [
    elements.dialog.animate(
      [
        { transform: `translate3d(0, ${panelStartY}px, 0)`, opacity: 0 },
        { transform: "translate3d(0, 0, 0)", opacity: 1 }
      ],
      panelMotionOptions()
    ),
    ...followerMotions
      .filter(({ deltaY }) => deltaY !== 0)
      .map(({ target, deltaY }) => target.animate(
        [
          { transform: `translate3d(0, ${deltaY}px, 0)` },
          { transform: "translate3d(0, 0, 0)" }
        ],
        panelMotionOptions()
      ))
  ];
  taskPanelAnimations = animations;
  elements.dialog.style.transform = "";
  elements.dialog.style.opacity = "";
  followers.forEach((target) => {
    target.style.transform = "";
  });

  await settleAnimations(animations);
  if (motionToken !== taskPanelMotionToken) return;
  animations.forEach((animation) => animation.cancel());
  taskPanelAnimations = [];
  clearTaskPanelMotionStyles();
}

function getTaskPanelMotionTargets() {
  return [elements.dialog, elements.homeMetrics, elements.homePath, elements.queueDock]
    .filter(Boolean)
    .filter((target) => {
      if (target === elements.dialog) return true;
      const style = getComputedStyle(target);
      return style.display !== "none" && !target.classList.contains("hidden");
    });
}

function updateTaskPanelHeight() {
  const height = Math.ceil(elements.dialog.scrollHeight);
  elements.dialog.style.setProperty("--task-panel-open-height", `${height}px`);
}

function installContentResizeObserver() {
  if (!window.ResizeObserver) return;

  const observer = new ResizeObserver(() => {
    if (document.body.classList.contains("is-task-panel-moving")) return;
    scheduleWindowResize(40);
  });
  [elements.form, elements.tasks]
    .filter(Boolean)
    .forEach((target) => observer.observe(target));

  const toolsObserver = new ResizeObserver(() => {
    if (elements.toolsDialog.open) resizeWindowToTools({ animate: true });
  });
  toolsObserver.observe(elements.toolsDialog);
}

function beginTaskPanelTransition(duration = TASK_PANEL_ANIMATION_MS + 40) {
  if (taskPanelTransitionTimer) clearTimeout(taskPanelTransitionTimer);
  document.body.classList.add("is-task-panel-moving");
  taskPanelTransitionTimer = setTimeout(() => {
    taskPanelTransitionTimer = null;
    document.body.classList.remove("is-task-panel-moving");
    scheduleWindowResize(20);
  }, duration);
}

function cancelTaskPanelAnimations() {
  taskPanelMotionToken += 1;
  taskPanelAnimations.forEach((animation) => animation.cancel());
  taskPanelAnimations = [];
  clearTaskPanelMotionStyles();
}

function panelMotionOptions() {
  return {
    duration: TASK_PANEL_ANIMATION_MS,
    easing: TASK_PANEL_EASING,
    fill: "both"
  };
}

function settleAnimations(animations) {
  return Promise.allSettled(animations.map((animation) => animation.finished));
}

function clearTaskPanelMotionStyles() {
  const targets = taskPanelMotionTargets.length > 0 ? taskPanelMotionTargets : getTaskPanelMotionTargets();
  targets.forEach((target) => {
    target.style.transition = "";
    target.style.transform = "";
    target.style.willChange = "";
    if (target === elements.dialog) {
      target.style.opacity = "";
      target.style.clipPath = "";
    }
  });
  taskPanelMotionTargets = [];
}

function scheduleWindowResize(delay = 0, options = {}) {
  if (!window.downloader?.resizeToContent) return;
  if (document.body.classList.contains("is-task-panel-moving") && !options.force) return;
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    resizeTimer = null;
    resizeWindowToContent(options);
  }, delay);
}

function resizeWindowToContent(options = {}) {
  if (!window.downloader?.resizeToContent) return;
  updateTaskPanelHeight();

  const card = document.querySelector(".home-card");
  if (!card) return;

  const styles = getComputedStyle(card);
  const gap = Number.parseFloat(styles.rowGap || styles.gap) || 0;
  const padding =
    (Number.parseFloat(styles.paddingTop) || 0) +
    (Number.parseFloat(styles.paddingBottom) || 0);

  const visibleChildren = [...card.children].filter((child) => {
    if (child === elements.dialog) return options.includePanel || child.classList.contains("is-open");
    const childStyle = getComputedStyle(child);
    return childStyle.display !== "none" && !child.classList.contains("hidden");
  });

  const contentHeight = visibleChildren.reduce((total, child) => {
    if (child === elements.dialog) {
      return total + Math.ceil(child.scrollHeight);
    }
    return total + Math.ceil(child.getBoundingClientRect().height);
  }, padding + Math.max(0, visibleChildren.length - 1) * gap);

  const hasQueue = elements.queueDock.classList.contains("has-tasks");
  const queueMode = options.queueMode
    || pendingQueueMode
    || (state.queueDockOpen ? "expanded" : null)
    || (elements.queueDock.classList.contains("is-expanded")
      ? "expanded"
      : elements.queueDock.classList.contains("is-preview")
        ? "preview"
        : "collapsed");
  const queueHeight = hasQueue ? getQueueDockContribution(queueMode, gap) : 0;
  return window.downloader.resizeToContent(Math.ceil(contentHeight + queueHeight), {
    animate: options.animate === true
  });
}

function getQueueDockContribution(mode, gap) {
  if (mode === "expanded") return measureQueueDockContribution("is-measuring", gap);
  if (mode === "preview") return measureQueueDockContribution("is-measuring-preview", gap);

  const measurement = measureQueueDockSize(null);
  const height = elements.queueDock.getBoundingClientRect().height || measurement.height;
  return Math.max(0, Math.ceil(height + measurement.marginTop + measurement.marginBottom + gap + measurement.edgeAllowance));
}

function measureQueueDockContribution(measureClass, gap) {
  const measurement = measureQueueDockSize(measureClass);
  return Math.max(
    0,
    Math.ceil(measurement.height + measurement.marginTop + measurement.marginBottom + gap + measurement.edgeAllowance)
  );
}

function measureQueueDockSize(measureClass) {
  const shouldMeasureClass = Boolean(measureClass);
  const alreadyMeasuring = shouldMeasureClass && elements.queueDock.classList.contains(measureClass);
  if (shouldMeasureClass && !alreadyMeasuring) elements.queueDock.classList.add(measureClass);

  const styles = getComputedStyle(elements.queueDock);
  const rectHeight = elements.queueDock.getBoundingClientRect().height;
  const scrollHeight = elements.queueDock.scrollHeight;
  const measurement = {
    height: Math.ceil(Math.max(rectHeight, scrollHeight)),
    marginTop: Number.parseFloat(styles.marginTop) || 0,
    marginBottom: Number.parseFloat(styles.marginBottom) || 0,
    edgeAllowance: Number.parseFloat(styles.getPropertyValue("--queue-edge-allowance")) || 0
  };

  if (shouldMeasureClass && !alreadyMeasuring) elements.queueDock.classList.remove(measureClass);
  return measurement;
}

function measureQueueDockExpandedHeight() {
  return measureQueueDockSize("is-measuring").height;
}

function measureQueueDockPreviewHeight() {
  return measureQueueDockSize("is-measuring-preview").height;
}

async function previewQueueDock() {
  if (!elements.queueDock.classList.contains("has-tasks")) return;
  if (dockCollapseIntentTimer) {
    clearTimeout(dockCollapseIntentTimer);
    dockCollapseIntentTimer = null;
  }
  if (dockCollapseResizeTimer) clearTimeout(dockCollapseResizeTimer);
  if (state.queueDockOpen) return;

  cancelQueueDockMotion();
  const beforeRect = elements.queueDock.getBoundingClientRect();
  const revealToken = ++dockRevealToken;
  pendingQueueMode = "preview";
  updateQueueDockHeight();
  await resizeWindowToContent({ queueMode: "preview", animate: false });
  await waitForViewportToSettle();
  if (revealToken !== dockRevealToken || state.queueDockOpen || !isPointerInQueueRegion) {
    pendingQueueMode = null;
    return;
  }

  setQueueDockVisualMode("preview");
  await animateQueueDockReveal(beforeRect);
  pendingQueueMode = null;
}

function trackQueueDockPointer(event) {
  if (!elements.queueDock.classList.contains("has-tasks")) {
    isPointerInQueueRegion = false;
    return;
  }

  const isInside = pointInsideQueueRegion(event.clientX, event.clientY);
  if (isInside) {
    if (dockCollapseIntentTimer) {
      clearTimeout(dockCollapseIntentTimer);
      dockCollapseIntentTimer = null;
    }
    if (isPointerInQueueRegion) return;
    isPointerInQueueRegion = true;
    if (!state.queueDockOpen) previewQueueDock();
    return;
  }

  if (!isPointerInQueueRegion) return;
  isPointerInQueueRegion = false;
  scheduleQueueDockCollapse();
}

function leaveQueueDockRegion() {
  if (!isPointerInQueueRegion) return;
  isPointerInQueueRegion = false;
  scheduleQueueDockCollapse();
}

function pointInsideQueueRegion(x, y) {
  const cardRect = document.querySelector(".home-card")?.getBoundingClientRect();
  const queueRect = elements.queueDock.getBoundingClientRect();
  if (!cardRect || queueRect.width <= 0) return false;

  const top = cardRect.bottom - 12;
  const collapsedBottom = Math.max(queueRect.bottom + 8, cardRect.bottom + 42);
  const expandedBottom = queueRect.bottom + 12;
  const bottom = getQueueDockVisualMode() === "collapsed" ? collapsedBottom : expandedBottom;
  return x >= queueRect.left - 12
    && x <= queueRect.right + 12
    && y >= top
    && y <= bottom;
}

function scheduleQueueDockCollapse() {
  if (!elements.queueDock.classList.contains("has-tasks")) return;
  if (dockCollapseIntentTimer) clearTimeout(dockCollapseIntentTimer);
  dockCollapseIntentTimer = setTimeout(() => {
    dockCollapseIntentTimer = null;
    collapseQueueDock();
  }, DOCK_COLLAPSE_GRACE_MS);
}

async function collapseQueueDock() {
  if (!elements.queueDock.classList.contains("has-tasks")) return;

  if (dockCollapseIntentTimer) {
    clearTimeout(dockCollapseIntentTimer);
    dockCollapseIntentTimer = null;
  }
  const collapseToken = ++dockRevealToken;
  pendingQueueMode = "collapsed";
  state.queueDockOpen = false;
  clearFocusedDockTask();
  await animateQueueDockConceal("collapsed");
  if (collapseToken !== dockRevealToken) return;
  pendingQueueMode = null;
  await resizeWindowToContent({ queueMode: "collapsed", animate: false });
}

function handleQueueDockMouseDown(event) {
  if (!elements.queueDock.classList.contains("has-tasks")) return;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest("button")) return;

  const queueRect = elements.queueDock.getBoundingClientRect();
  const cardRect = document.querySelector(".home-card")?.getBoundingClientRect();
  const insideQueue = target ? elements.queueDock.contains(target) : false;
  const insideBridge = Boolean(cardRect)
    && event.clientX >= queueRect.left - 8
    && event.clientX <= queueRect.right + 8
    && event.clientY >= Math.min(cardRect.bottom - 10, queueRect.top - 10)
    && event.clientY <= queueRect.top + 30;

  if (!insideQueue && !insideBridge) return;
  event.preventDefault();
  toggleQueueDockDetails(event);
}

async function toggleQueueDockDetails(event) {
  if (!elements.queueDock.classList.contains("has-tasks")) return;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest("button")) return;

  const shouldClose = state.queueDockOpen && target?.closest(".queue-head");
  if (shouldClose) {
    const targetMode = isPointerInQueueRegion ? "preview" : "collapsed";
    const closeToken = ++dockRevealToken;
    state.queueDockOpen = false;
    pendingQueueMode = targetMode;
    clearFocusedDockTask();
    await animateQueueDockConceal(targetMode);
    if (closeToken !== dockRevealToken) return;
    pendingQueueMode = null;
    await resizeWindowToContent({ queueMode: targetMode, animate: false });
    return;
  }

  if (state.queueDockOpen) return;

  cancelQueueDockMotion();
  const beforeRect = elements.queueDock.getBoundingClientRect();
  state.queueDockOpen = true;
  const revealToken = ++dockRevealToken;
  pendingQueueMode = "expanded";
  if (dockCollapseIntentTimer) {
    clearTimeout(dockCollapseIntentTimer);
    dockCollapseIntentTimer = null;
  }
  if (dockCollapseResizeTimer) clearTimeout(dockCollapseResizeTimer);
  updateQueueDockHeight();
  await resizeWindowToContent({ queueMode: "expanded", animate: false });
  await waitForViewportToSettle();
  if (revealToken !== dockRevealToken || !state.queueDockOpen) {
    pendingQueueMode = null;
    return;
  }

  setQueueDockVisualMode("expanded");
  await animateQueueDockReveal(beforeRect);
  pendingQueueMode = null;
}

function getQueueDockVisualMode() {
  if (elements.queueDock.classList.contains("is-expanded")) return "expanded";
  if (elements.queueDock.classList.contains("is-preview")) return "preview";
  return "collapsed";
}

function setQueueDockVisualMode(mode) {
  elements.queueDock.classList.toggle("is-preview", mode === "preview");
  elements.queueDock.classList.toggle("is-expanded", mode === "expanded");
  document.body.classList.toggle("is-dock-preview", mode === "preview");
  document.body.classList.toggle("is-dock-expanded", mode === "expanded");
}

function measureQueueDockRectForMode(mode) {
  const currentMode = getQueueDockVisualMode();
  setQueueDockVisualMode(mode);
  const rect = elements.queueDock.getBoundingClientRect();
  const measurement = { top: rect.top, height: rect.height };
  setQueueDockVisualMode(currentMode);
  return measurement;
}

async function animateQueueDockReveal(beforeRect) {
  cancelQueueDockMotion();
  if (prefersReducedMotion()) return;

  const afterRect = elements.queueDock.getBoundingClientRect();
  const deltaY = Math.round(beforeRect.top - afterRect.top);
  const hiddenBottom = Math.max(0, Math.round(afterRect.height - Math.min(beforeRect.height, afterRect.height)));
  if (Math.abs(deltaY) < 1 && hiddenBottom < 1) return;

  elements.queueDock.style.willChange = "transform, clip-path, opacity";
  const animation = elements.queueDock.animate(
    [
      {
        "--queue-motion-y": `${deltaY}px`,
        clipPath: `inset(0 0 ${hiddenBottom}px 0 round 22px)`,
        opacity: 0.98
      },
      {
        "--queue-motion-y": "0px",
        clipPath: "inset(0 0 0 0 round 22px)",
        opacity: 1
      }
    ],
    queueDockMotionOptions(QUEUE_DOCK_ANIMATION_MS)
  );
  queueDockMotion = animation;
  await animation.finished.catch(() => {});
  if (queueDockMotion !== animation) return;
  animation.cancel();
  queueDockMotion = null;
  elements.queueDock.style.willChange = "";
}

async function animateQueueDockConceal(targetMode) {
  cancelQueueDockMotion();
  if (prefersReducedMotion()) {
    setQueueDockVisualMode(targetMode);
    return;
  }

  const currentRect = elements.queueDock.getBoundingClientRect();
  const targetRect = measureQueueDockRectForMode(targetMode);
  const deltaY = Math.round(targetRect.top - currentRect.top);
  const hiddenBottom = Math.max(0, Math.round(currentRect.height - Math.min(targetRect.height, currentRect.height)));
  if (Math.abs(deltaY) < 1 && hiddenBottom < 1) {
    setQueueDockVisualMode(targetMode);
    return;
  }

  elements.queueDock.style.willChange = "transform, clip-path, opacity";
  const animation = elements.queueDock.animate(
    [
      {
        "--queue-motion-y": "0px",
        clipPath: "inset(0 0 0 0 round 22px)",
        opacity: 1
      },
      {
        "--queue-motion-y": `${deltaY}px`,
        clipPath: `inset(0 0 ${hiddenBottom}px 0 round 22px)`,
        opacity: 0.98
      }
    ],
    queueDockMotionOptions(Math.round(QUEUE_DOCK_ANIMATION_MS * 0.78))
  );
  queueDockMotion = animation;
  await animation.finished.catch(() => {});
  if (queueDockMotion !== animation) return;
  setQueueDockVisualMode(targetMode);
  animation.cancel();
  queueDockMotion = null;
  elements.queueDock.style.willChange = "";
}

function queueDockMotionOptions(duration) {
  return {
    duration,
    easing: QUEUE_DOCK_EASING,
    fill: "both"
  };
}

function cancelQueueDockMotion() {
  if (queueDockMotion) queueDockMotion.cancel();
  queueDockMotion = null;
  elements.queueDock.style.willChange = "";
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

function waitForViewportToSettle() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function updateQueueDockHeight() {
  const height = Math.ceil(measureQueueDockExpandedHeight());
  elements.queueDock.style.setProperty("--queue-expanded-height", `${height}px`);
}

function resetTaskForm() {
  elements.form.reset();
  elements.dir.value = "";
  elements.dialogHint.textContent = defaultHint;
  elements.sourceSummary.textContent = "自动识别下载方式";
  clearTorrentPanel();
  setMode("link");
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".video-only").forEach((item) => {
    item.classList.add("hidden");
  });

  elements.formatsButton.classList.add("hidden");
  elements.torrentPanel.classList.toggle("hidden", mode !== "torrent" || !state.currentTorrent);
  updateIcons();
  scheduleWindowResize(20);
}

async function fillFromClipboard() {
  const text = await readClipboardText();
  const detected = analyzeClipboardText(text);
  if (!detected) {
    elements.dialogHint.textContent = defaultHint;
    return false;
  }

  setMode(detected.mode);
  elements.urls.value = detected.urls.join("\n");
  if (detected.fileName) elements.out.value = detected.fileName;
  elements.dialogHint.textContent = detected.message;
  updateSourceSummary();
  return true;
}

async function readClipboardText() {
  try {
    if (window.downloader?.readClipboardText) {
      return await window.downloader.readClipboardText();
    }
    if (navigator.clipboard?.readText) {
      return await navigator.clipboard.readText();
    }
  } catch {
    return "";
  }

  return "";
}

async function readDefaultDownloadStatus() {
  try {
    if (window.downloader?.getDefaultDownloadStatus) {
      return await window.downloader.getDefaultDownloadStatus();
    }
  } catch {
    return null;
  }

  return null;
}

function startupStatusText(health, defaultDownload) {
  const engine = health?.videoReady ? "全部引擎已就绪" : "下载引擎已就绪";
  return `${engine} · 默认下载工具：${defaultDownload?.isDefault ? "是" : "否"}`;
}

function analyzeClipboardText(text) {
  const urls = extractDownloadableUrls(text);
  if (urls.length === 0) return null;

  const first = urls[0];
  const mode = inferModeFromText(first);
  const fileName = mode === "link" ? guessFileName(first) : "";

  return {
    urls,
    mode,
    fileName,
    message: urls.length === 1 ? "已识别剪贴板链接" : `已识别 ${urls.length} 个剪贴板链接`
  };
}

function extractDownloadableUrls(text) {
  const source = String(text || "").trim();
  if (!source) return [];

  const matches = source.match(/magnet:\?[^\s"'<>]+|(?:https?|ftp):\/\/[^\s"'<>]+/gi) || [];
  const cleaned = matches.map(cleanUrl).filter(isDownloadableUrl);
  return [...new Set(cleaned)].slice(0, 50);
}

function cleanUrl(url) {
  return String(url || "").replace(/[),.;，。；）]+$/g, "");
}

function isDownloadableUrl(url) {
  return /^magnet:/i.test(url) || /^(https?|ftp):\/\//i.test(url);
}

function looksLikeVideoUrl(url) {
  return /\.(m3u8|mpd)(\?|#|$)/i.test(url) ||
    /\b(youtube\.com|youtu\.be|bilibili\.com|vimeo\.com|tiktok\.com|douyin\.com|ixigua\.com|youku\.com|iqiyi\.com|qq\.com\/x\/cover)\b/i.test(url);
}

function guessFileName(url) {
  if (/^magnet:/i.test(url)) return "";

  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split("/").filter(Boolean).pop() || "";
    const decoded = decodeURIComponent(last);
    if (decoded && decoded.includes(".")) return decoded.slice(0, 180);
  } catch {
    return "";
  }

  return "";
}

async function submitTask() {
  const form = new FormData(elements.form);

  try {
    if (elements.torrentFile.files.length > 0 || state.mode === "torrent") {
      if (elements.torrentFile.files.length === 0) {
        throw new Error("请先选择 .torrent 文件。");
      }
      if (!state.currentTorrent) await inspectTorrent();

      const selectedFiles = getSelectedTorrentFiles();
      if (selectedFiles.length === 0) throw new Error("至少选择一个种子文件。");

      await fetchJson("/api/torrents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          torrentId: state.currentTorrent.id,
          selectFiles: selectedFiles,
          dir: form.get("dir"),
          threads: form.get("threads"),
          rateLimit: form.get("rateLimit")
        })
      });
    } else {
      const body = Object.fromEntries(form.entries());
      body.mode = inferModeFromText(body.urls);
      body.playlist = elements.form.playlist?.checked || false;
      await fetchJson("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    }

    await closeTaskPanel();
    await refreshTasks();
  } catch (error) {
    showStatus(error.message);
  }
}

async function inspectTorrent() {
  const file = elements.torrentFile.files[0];
  if (!file) throw new Error("请先选择 .torrent 文件。");

  elements.torrentPanel.classList.remove("hidden");
  elements.sourceSummary.textContent = file.name;
  elements.torrentName.textContent = file.name;
  elements.torrentMeta.textContent = "读取中";
  elements.torrentFiles.innerHTML = "";

  const form = new FormData();
  form.append("torrent", file);
  state.currentTorrent = await fetchJson("/api/torrents/inspect", {
    method: "POST",
    body: form
  });
  renderTorrentFiles();
}

function renderTorrentFiles() {
  const torrent = state.currentTorrent;
  if (!torrent) return;

  elements.torrentPanel.classList.toggle("hidden", state.mode !== "torrent");
  elements.torrentName.textContent = torrent.name || "种子文件";
  elements.torrentFiles.innerHTML = torrent.files
    .map((file) => `
      <label class="torrent-file" title="${escapeHtml(file.path)}">
        <input type="checkbox" value="${file.index}" checked />
        <span class="torrent-file-name">${escapeHtml(file.path)}</span>
        <span class="torrent-file-size">${formatBytes(file.length)}</span>
      </label>
    `)
    .join("");
  updateTorrentSummary();
  updateTaskPanelHeight();
  scheduleWindowResize();
}

function updateTorrentSummary() {
  const torrent = state.currentTorrent;
  if (!torrent) return;

  const selected = getSelectedTorrentFiles();
  const selectedSize = torrent.files
    .filter((file) => selected.includes(file.index))
    .reduce((sum, file) => sum + Number(file.length || 0), 0);

  elements.torrentMeta.textContent = `${selected.length}/${torrent.files.length} · ${formatBytes(selectedSize)} / ${formatBytes(torrent.totalSize)}`;
}

function getSelectedTorrentFiles() {
  return [...elements.torrentFiles.querySelectorAll("input[type='checkbox']:checked")]
    .map((input) => Number(input.value))
    .filter(Number.isFinite);
}

function clearTorrentPanel() {
  state.currentTorrent = null;
  elements.torrentPanel.classList.add("hidden");
  elements.sourceSummary.textContent = "自动识别下载方式";
  elements.torrentName.textContent = "未选择种子";
  elements.torrentMeta.textContent = "0 个文件";
  elements.torrentFiles.innerHTML = "";
  updateTaskPanelHeight();
  scheduleWindowResize();
}

function updateSourceSummary() {
  if (elements.torrentFile.files.length > 0) {
    elements.sourceSummary.textContent = elements.torrentFile.files[0].name;
    return;
  }

  const urls = extractDownloadableUrls(elements.urls.value);
  elements.sourceSummary.textContent =
    urls.length > 0
      ? (urls.length === 1 ? "已识别可下载内容" : `已识别 ${urls.length} 个可下载内容`)
      : "自动识别下载方式";
}

function inferModeFromText(text) {
  const urls = extractDownloadableUrls(text);
  if (urls.some(looksLikeVideoUrl)) return "video";
  return "link";
}

async function showVideoFormats() {
  const url = elements.urls.value.split(/\r?\n/).map((item) => item.trim()).find(Boolean);
  if (!url) {
    showStatus("请先输入视频链接");
    return;
  }

  elements.formatOutput.textContent = "读取中...";
  elements.formatDialog.showModal();

  try {
    const response = await fetch(`/api/video/formats?url=${encodeURIComponent(url)}`);
    const text = await response.text();
    if (!response.ok) throw new Error(text);
    elements.formatOutput.textContent = text || "没有返回格式列表。";
  } catch (error) {
    elements.formatOutput.textContent = error.message;
  }
}

async function refreshTasks() {
  try {
    if (demoTaskCount > 0) {
      const data = buildDemoTaskSnapshot(demoTaskCount);
      state.tasks = data.tasks;
      elements.globalDown.textContent = `${formatBytes(Number(data.global?.downloadSpeed || 0))}/s`;
      elements.globalUp.textContent = `${formatBytes(Number(data.global?.uploadSpeed || 0))}/s`;
      renderTasks();
      return;
    }

    const data = await fetchJson("/api/tasks");
    state.tasks = data.tasks || [];
    elements.globalDown.textContent = `${formatBytes(Number(data.global?.downloadSpeed || 0))}/s`;
    elements.globalUp.textContent = `${formatBytes(Number(data.global?.uploadSpeed || 0))}/s`;
    renderTasks();
  } catch (error) {
    showStatus(error.message);
  }
}

function getDemoTaskCount() {
  const count = Number(new URLSearchParams(window.location.search).get("demoTasks") || 0);
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(12, Math.max(1, Math.round(count)));
}

function buildDemoTaskSnapshot(count) {
  const now = Date.now();
  const tasks = Array.from({ length: count }, (_, index) => {
    const total = (48 + index * 7) * 1024 ** 3;
    const phase = (now / (1600 + index * 180) + index * 0.72) % 96;
    const progress = Math.min(98.8, 3 + phase);
    const downloadSpeed = Math.round((7_400_000 - index * 620_000) * (0.76 + Math.sin(now / 950 + index) * 0.12));
    const uploadSpeed = Math.round((1_200_000 + index * 180_000) * (0.7 + Math.cos(now / 1200 + index) * 0.1));

    return {
      id: `demo-${index + 1}`,
      engine: "demo",
      kind: index === 0 ? "torrent" : "link",
      name: demoTaskName(index),
      status: index === count - 1 && count > 4 ? "waiting" : "active",
      total,
      completed: Math.round(total * (progress / 100)),
      progress,
      downloadSpeed: Math.max(0, downloadSpeed),
      uploadSpeed: Math.max(0, uploadSpeed),
      connections: 12 - index,
      seeders: 40 + index,
      dir: state.health?.downloads || "",
      errorMessage: "",
      source: `demo://task-${index + 1}`
    };
  });

  return {
    global: {
      downloadSpeed: tasks.reduce((sum, task) => sum + task.downloadSpeed, 0),
      uploadSpeed: tasks.reduce((sum, task) => sum + task.uploadSpeed, 0)
    },
    tasks
  };
}

function demoTaskName(index) {
  const names = [
    "Ghost.of.Tsushima.Directors.Cut-InsaneRamZes",
    "NOrain.Design.Reference.Pack",
    "Large.Archive.Collection.Part.01",
    "Video.Source.High.Bitrate.Sample",
    "Magnet.Metadata.Expanding.Task",
    "Browser.Captured.Download.Item",
    "Compressed.Project.Backup",
    "Long.File.Name.For.Stack.Hover.Test"
  ];
  return names[index % names.length];
}

function renderTasks() {
  const filtered = state.tasks.filter(shouldShowInDock);
  const hasDockTasks = filtered.length > 0;
  state.fastestTaskId = getFastestTaskId(filtered);
  const visibleTasks = orderTasksForDock(filtered, state.fastestTaskId);
  const peekTask = visibleTasks[0];
  const visibleTaskIds = new Set(visibleTasks.map((task) => task.id));
  if (!visibleTaskIds.has(state.focusedDockTaskId)) {
    state.focusedDockTaskId = null;
  }

  const canPatchRows = canPatchRenderedTasks(visibleTasks);
  if (canPatchRows) {
    updateRenderedTaskRows(visibleTasks);
  } else {
    elements.tasks.innerHTML = visibleTasks.map(renderTask).join("");
    state.renderedTaskIds = visibleTasks.map((task) => task.id);
  }
  elements.tasks.classList.toggle("has-row-focus", Boolean(state.focusedDockTaskId));
  elements.queueDock.classList.toggle("has-tasks", hasDockTasks);
  elements.queueDock.classList.toggle("has-single-task", filtered.length === 1);
  elements.queueDock.classList.toggle("has-many-tasks", filtered.length > 2);
  elements.queueDock.classList.toggle("has-running-task", Number(peekTask?.downloadSpeed || 0) > 0);
  updateQueuePeekProgress(peekTask);
  if (!canPatchRows) updateQueueDockHeight();
  document.body.classList.toggle("has-dock-tasks", hasDockTasks);
  if (demoTaskCount > 0 && captureQueueState !== "collapsed" && hasDockTasks && !state.queueDockOpen) {
    state.queueDockOpen = true;
    elements.queueDock.classList.remove("is-preview");
    elements.queueDock.classList.add("is-expanded");
    document.body.classList.remove("is-dock-preview");
    document.body.classList.add("is-dock-expanded");
  }
  if (!hasDockTasks) {
    state.queueDockOpen = false;
    state.focusedDockTaskId = null;
    isPointerInQueueRegion = false;
    state.renderedTaskIds = [];
    elements.queueDock.classList.remove("is-preview");
    elements.queueDock.classList.remove("is-expanded");
    document.body.classList.remove("is-dock-preview");
    document.body.classList.remove("is-dock-expanded");
  }
  elements.empty.classList.toggle("visible", false);
  elements.tasks.classList.toggle("is-collapsed", filtered.length > 2);
  elements.queueSummary.textContent = queueSummaryText(filtered);
  if (!canPatchRows) {
    updateIcons();
    scheduleWindowResize(40);
  }
}

function updateQueuePeekProgress(task) {
  const rawProgress = Number(task?.progress || 0);
  const speed = Number(task?.downloadSpeed || 0);
  const progress = speed > 0 && rawProgress > 0
    ? Math.max(4, rawProgress)
    : rawProgress;
  elements.queueDock.style.setProperty("--queue-peek-progress", `${Math.max(0, Math.min(100, progress))}%`);
}

function focusDockTaskFromPointer(event) {
  if (!elements.queueDock.classList.contains("has-many-tasks")) return;
  if (!elements.queueDock.classList.contains("is-expanded")) return;

  dockPointerPosition = { x: event.clientX, y: event.clientY };
  const focusedRow = state.focusedDockTaskId
    ? elements.tasks.querySelector(`.task-row[data-task-id="${CSS.escape(state.focusedDockTaskId)}"]`)
    : null;
  if (focusedRow && pointInsideRect(dockPointerPosition, focusedRow.getBoundingClientRect(), 8)) {
    cancelPendingDockRowFocus();
    return;
  }

  const row = event.target.closest(".task-row");
  if (!row || !elements.tasks.contains(row)) return;

  const taskId = row.dataset.taskId;
  if (!taskId || taskId === state.focusedDockTaskId) return;

  if (taskId === pendingDockRowFocusId) return;
  cancelPendingDockRowFocus();
  pendingDockRowFocusId = taskId;
  dockRowFocusTimer = setTimeout(() => {
    const target = dockPointerPosition
      ? document.elementFromPoint(dockPointerPosition.x, dockPointerPosition.y)?.closest(".task-row")
      : null;
    const shouldFocus = target
      && elements.tasks.contains(target)
      && target.dataset.taskId === pendingDockRowFocusId;

    dockRowFocusTimer = null;
    pendingDockRowFocusId = null;
    if (!shouldFocus) return;

    setFocusedDockTask(target.dataset.taskId);
  }, 90);
}

function setFocusedDockTask(taskId) {
  if (!taskId || taskId === state.focusedDockTaskId) return;

  state.focusedDockTaskId = taskId;
  elements.tasks.classList.add("has-row-focus");
  elements.tasks.querySelectorAll(".task-row").forEach((item) => {
    item.classList.toggle("is-row-focus", item.dataset.taskId === taskId);
  });
}

function clearFocusedDockTask() {
  cancelPendingDockRowFocus();
  dockPointerPosition = null;
  if (!state.focusedDockTaskId) return;
  state.focusedDockTaskId = null;
  elements.tasks.classList.remove("has-row-focus");
  elements.tasks.querySelectorAll(".task-row.is-row-focus").forEach((item) => {
    item.classList.remove("is-row-focus");
  });
}

function cancelPendingDockRowFocus() {
  if (dockRowFocusTimer) clearTimeout(dockRowFocusTimer);
  dockRowFocusTimer = null;
  pendingDockRowFocusId = null;
}

function pointInsideRect(point, rect, allowance = 0) {
  return point.x >= rect.left - allowance
    && point.x <= rect.right + allowance
    && point.y >= rect.top - allowance
    && point.y <= rect.bottom + allowance;
}

function getFastestTaskId(tasks) {
  const fastest = tasks
    .filter((task) => isActiveTask(task) && Number(task.downloadSpeed || 0) > 0)
    .sort((a, b) => Number(b.downloadSpeed || 0) - Number(a.downloadSpeed || 0))[0];

  return fastest?.id || null;
}

function orderTasksForDock(tasks, fastestTaskId) {
  if (state.renderedTaskIds.length > 0) {
    const taskMap = new Map(tasks.map((task) => [task.id, task]));
    const keptTasks = state.renderedTaskIds
      .map((id) => taskMap.get(id))
      .filter(Boolean);
    const newTasks = tasks.filter((task) => !state.renderedTaskIds.includes(task.id));
    if (keptTasks.length > 0) return [...keptTasks, ...prioritizeFastestTask(newTasks, fastestTaskId)];
  }

  return prioritizeFastestTask(tasks, fastestTaskId);
}

function prioritizeFastestTask(tasks, fastestTaskId) {
  if (!fastestTaskId) return tasks;
  const fastest = tasks.find((task) => task.id === fastestTaskId);
  if (!fastest) return tasks;
  return [fastest, ...tasks.filter((task) => task.id !== fastestTaskId)];
}

function canPatchRenderedTasks(tasks) {
  const rows = [...elements.tasks.querySelectorAll(".task-row")];
  if (rows.length !== tasks.length) return false;
  return rows.every((row, index) => row.dataset.taskId === tasks[index].id);
}

function updateRenderedTaskRows(tasks) {
  const rows = [...elements.tasks.querySelectorAll(".task-row")];
  rows.forEach((row, index) => updateRenderedTaskRow(row, tasks[index]));
}

function updateRenderedTaskRow(row, task) {
  row.className = getTaskRowClass(task);
  row.dataset.taskId = task.id;

  const name = row.querySelector(".task-name");
  if (name) name.title = task.source || task.name || "";
  const title = row.querySelector(".task-name strong");
  if (title) title.textContent = task.name || task.id;
  const meta = row.querySelector(".task-name span");
  if (meta) meta.textContent = `${statusText(task.status)} 路 ${formatBytes(task.completed)} / ${formatBytes(task.total)}`;

  const speed = row.querySelector(".task-speed > span");
  if (speed) speed.textContent = `${formatBytes(task.downloadSpeed)}/s`;
  updateSpeedSurge(row, task.id === state.fastestTaskId);

  const fill = row.querySelector(".progress-fill");
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, task.progress || 0))}%`;
  const progressText = row.querySelector(".progress-text");
  if (progressText) progressText.textContent = formatProgress(task.progress);

  setTaskButtonDisabled(row, "open-location", !(task.filePath || task.dir));
  setTaskButtonDisabled(row, "pause", !["active", "waiting", "processing"].includes(task.status));
  setTaskButtonDisabled(row, "resume", task.status !== "paused");
}

function updateSpeedSurge(row, shouldShow) {
  const speedCell = row.querySelector(".task-speed");
  if (!speedCell) return;

  const existing = speedCell.querySelector(".speed-surge");
  if (shouldShow && !existing) {
    speedCell.insertAdjacentHTML("beforeend", renderSpeedSurgeClean());
    return;
  }

  if (!shouldShow && existing) existing.remove();
}

function setTaskButtonDisabled(row, action, disabled) {
  const button = row.querySelector(`button[data-action="${action}"]`);
  if (button) button.disabled = disabled;
}

function renderTask(task) {
  const canPause = ["active", "waiting", "processing"].includes(task.status);
  const canResume = task.status === "paused";
  const isFastest = task.id === state.fastestTaskId;
  const rowClass = getTaskRowClass(task);

  return `
    <article class="${rowClass}" data-task-id="${escapeHtml(task.id)}">
      <div class="task-name" title="${escapeHtml(task.source || task.name)}">
        <strong>${escapeHtml(task.name || task.id)}</strong>
        <span>${statusText(task.status)} · ${formatBytes(task.completed)} / ${formatBytes(task.total)}</span>
      </div>
      <div class="task-speed">
        <span>${formatBytes(task.downloadSpeed)}/s</span>
        ${isFastest ? renderSpeedSurgeClean() : ""}
      </div>
      <div class="progress-cell">
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.max(0, Math.min(100, task.progress || 0))}%"></div></div>
        <span class="progress-text">${formatProgress(task.progress)}</span>
      </div>
      <div class="row-actions">
        <button class="icon-button" data-action="open-location" data-id="${task.id}" title="打开下载位置" ${task.dir ? "" : "disabled"}>
          <i data-lucide="folder-open"></i>
        </button>
        <button class="icon-button" data-action="pause" data-id="${task.id}" title="暂停" ${canPause ? "" : "disabled"}>
          <i data-lucide="pause"></i>
        </button>
        <button class="icon-button" data-action="resume" data-id="${task.id}" title="继续" ${canResume ? "" : "disabled"}>
          <i data-lucide="play"></i>
        </button>
        <button class="icon-button" data-action="limit" data-id="${task.id}" title="任务限速">
          <i data-lucide="gauge"></i>
        </button>
        <button class="icon-button" data-action="subtitles" data-id="${task.id}" title="查找字幕">
          <i data-lucide="captions"></i>
        </button>
        <button class="icon-button" data-action="remove" data-id="${task.id}" title="删除">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    </article>
  `;
}

async function openToolsDialog() {
  document.body.classList.add("tools-open");
  elements.toolsDialog.showModal();
  updateIcons();
  resizeWindowToTools({ animate: true });
  const next = new Date(Date.now() + 5 * 60 * 1000);
  elements.scheduleTime.value = toLocalDateTime(next);
  try {
    const [settings, , updateState] = await Promise.all([
      loadPolicy(),
      loadSchedules(),
      window.downloader?.getUpdateState?.()
    ]);
    if (updateState) renderUpdateState(updateState);
    populateSubtitleTasks();
    resizeWindowToTools({ animate: true });
    return settings;
  } catch (error) {
    showStatus(error.message);
    resizeWindowToTools({ animate: true });
  }
}

function switchToolTab(name) {
  document.querySelectorAll("[data-tool-tab]").forEach((item) => item.classList.toggle("active", item.dataset.toolTab === name));
  document.querySelectorAll("[data-tool-pane]").forEach((item) => item.classList.toggle("active", item.dataset.toolPane === name));
  resizeWindowToTools({ animate: true });
}

function resizeWindowToTools({ animate = true } = {}) {
  if (!elements.toolsDialog.open || !window.downloader?.resizeToContent) return;
  if (toolsResizeFrame) cancelAnimationFrame(toolsResizeFrame);
  toolsResizeFrame = requestAnimationFrame(() => {
    toolsResizeFrame = 0;
    const dialogHeight = Math.ceil(elements.toolsDialog.scrollHeight);
    window.downloader.resizeToContent(dialogHeight, {
      animate,
      anchor: "top",
      motion: "stretch"
    });
  });
}

function closeToolsDialog() {
  if (elements.toolsDialog.open) elements.toolsDialog.close();
}

function handleToolsDialogClosed() {
  if (toolsResizeFrame) cancelAnimationFrame(toolsResizeFrame);
  toolsResizeFrame = 0;
  document.body.classList.remove("tools-open");
  scheduleWindowResize(20, { force: true, animate: true });
}

async function checkForAppUpdate() {
  if (!window.downloader?.checkForUpdates) {
    renderUpdateState({ supported: false, phase: "unsupported", message: "网页版不支持软件更新" });
    return;
  }
  const updateState = await window.downloader.checkForUpdates();
  if (updateState) renderUpdateState(updateState);
}

async function saveAutoUpdatePreference() {
  if (!window.downloader?.setAutoUpdateCheck) return;
  const updateState = await window.downloader.setAutoUpdateCheck(elements.autoUpdateCheck.checked);
  if (updateState) renderUpdateState(updateState);
}

async function installAppUpdate() {
  elements.installUpdateButton.disabled = true;
  try {
    await window.downloader?.installUpdate?.();
  } catch (error) {
    elements.installUpdateButton.disabled = false;
    showStatus(error.message || "无法安装更新");
  }
}

function renderUpdateState(updateState = {}) {
  const phase = updateState.phase || "idle";
  const percent = Math.max(0, Math.min(100, Number(updateState.percent || 0)));
  const isBusy = ["checking", "available", "downloading", "installing"].includes(phase);
  const showProgress = ["downloading", "ready"].includes(phase);

  elements.currentVersion.textContent = updateState.currentVersion || elements.currentVersion.textContent;
  elements.autoUpdateCheck.checked = updateState.autoCheck !== false;
  elements.autoUpdateCheck.disabled = updateState.supported === false;
  elements.updateStatusText.textContent = updateState.message || "尚未检查更新";
  elements.updatePercent.textContent = phase === "downloading" ? `${percent.toFixed(1)}%` : "";
  elements.updateProgress.hidden = !showProgress;
  elements.updateProgress.querySelector("span").style.width = `${phase === "ready" ? 100 : percent}%`;
  elements.checkUpdateButton.disabled = isBusy || updateState.supported === false;
  elements.installUpdateButton.classList.toggle("hidden", phase !== "ready");
  elements.installUpdateButton.disabled = phase !== "ready";

  if (phase === "downloading") {
    const transferred = formatBytes(updateState.transferred);
    const total = formatBytes(updateState.total);
    const speed = formatBytes(updateState.bytesPerSecond);
    elements.updateMeta.textContent = `${transferred} / ${total} · ${speed}/s`;
  } else if (updateState.availableVersion) {
    elements.updateMeta.textContent = `可用版本 ${updateState.availableVersion}`;
  } else {
    elements.updateMeta.textContent = updateState.supported === false ? "请使用已安装的桌面版本" : "稳定通道";
  }
}

async function loadPolicy() {
  const settings = await fetchJson("/api/settings");
  elements.globalDownloadLimit.value = settings.speed?.downloadLimit || "0";
  elements.globalUploadLimit.value = settings.speed?.uploadLimit || "0";
  elements.maxConcurrentDownloads.value = settings.speed?.maxConcurrentDownloads || 10;
  elements.notificationsEnabled.checked = settings.notifications !== false;
  elements.closeToTray.checked = settings.closeToTray !== false;
  elements.subdlApiKey.value = settings.subtitles?.subdlApiKey || "";
  elements.openSubtitlesApiKey.value = settings.subtitles?.openSubtitlesApiKey || "";
  elements.openSubtitlesToken.value = settings.subtitles?.openSubtitlesToken || "";
  elements.subtitleLanguages.value = (settings.subtitles?.preferredLanguages || ["zh-CN", "zh-TW", "en"]).join(",");
  return settings;
}

async function savePolicy() {
  try {
    await fetchJson("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        speed: {
          downloadLimit: elements.globalDownloadLimit.value,
          uploadLimit: elements.globalUploadLimit.value,
          maxConcurrentDownloads: Number(elements.maxConcurrentDownloads.value)
        },
        notifications: elements.notificationsEnabled.checked,
        closeToTray: elements.closeToTray.checked
      })
    });
    showStatus("下载策略已保存");
  } catch (error) {
    showStatus(error.message);
  }
}

async function loadSchedules() {
  const data = await fetchJson("/api/schedules");
  elements.scheduleList.innerHTML = data.schedules.length ? data.schedules.map((item) => `
    <div class="schedule-item" data-schedule-id="${escapeHtml(item.id)}">
      <input type="checkbox" data-schedule-toggle ${item.enabled ? "checked" : ""} title="启用计划" />
      <div><strong title="${escapeHtml(item.task?.url || item.task?.urls || "")}">${escapeHtml(item.name)}</strong><span>${formatScheduleTime(item.nextRun)} · ${item.repeat === "daily" ? "每天" : item.enabled ? "一次" : "已执行"}</span></div>
      <button class="icon-button" data-schedule-delete title="删除计划"><i data-lucide="trash-2"></i></button>
    </div>`).join("") : '<span>还没有计划任务。</span>';
  updateIcons();
}

async function addSchedule() {
  const url = elements.scheduleUrl.value.trim();
  if (!isDownloadableUrl(url)) return showStatus("请输入可下载链接");
  try {
    await fetchJson("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: guessFileName(url) || "计划下载",
        startAt: new Date(elements.scheduleTime.value).toISOString(),
        repeat: elements.scheduleRepeat.value,
        task: { url, mode: inferModeFromText(url) }
      })
    });
    elements.scheduleUrl.value = "";
    await loadSchedules();
  } catch (error) {
    showStatus(error.message);
  }
}

async function handleScheduleAction(event) {
  const button = event.target.closest("[data-schedule-delete]");
  if (!button) return;
  const item = button.closest("[data-schedule-id]");
  await fetchJson(`/api/schedules/${encodeURIComponent(item.dataset.scheduleId)}`, { method: "DELETE" });
  await loadSchedules();
}

async function handleScheduleToggle(event) {
  if (!event.target.matches("[data-schedule-toggle]")) return;
  const item = event.target.closest("[data-schedule-id]");
  await fetchJson(`/api/schedules/${encodeURIComponent(item.dataset.scheduleId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: event.target.checked })
  });
}

async function searchSubtitles() {
  elements.subtitleResults.innerHTML = "<span>正在查找字幕...</span>";
  elements.downloadSubtitlesButton.classList.add("hidden");
  try {
    const body = {
      query: {
        languages: elements.subtitleLanguages.value.split(",").map((item) => item.trim()).filter(Boolean)
      }
    };
    if (state.subtitleMode === "task") body.taskId = elements.subtitleTask.value;
    if (state.subtitleMode === "local") body.videoPath = elements.subtitleVideoPath.value;
    if (state.subtitleMode === "specific") {
      Object.assign(body.query, {
        title: elements.subtitleTitle.value.trim(),
        year: elements.subtitleYear.value.trim(),
        season: Number(elements.subtitleSeason.value || 0),
        episode: Number(elements.subtitleEpisode.value || 0),
        release: elements.subtitleRelease.value.trim()
      });
      body.directUrl = elements.subtitleDirectUrl.value.trim();
    }
    const data = await fetchJson("/api/subtitle-center/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    state.subtitles = data.results;
    state.subtitleContext = { targetVideo: data.targetVideo, outputDir: data.outputDir };
    elements.subtitleResults.innerHTML = state.subtitles.length ? state.subtitles.map((item, index) => `
      <label class="subtitle-item subtitle-result">
        <input type="radio" name="subtitleResult" value="${index}" ${index === 0 ? "checked" : ""} />
        <span><strong>${escapeHtml(item.name || item.release || item.language)}</strong><small>${escapeHtml(subtitleProviderName(item.provider))} · ${escapeHtml(item.language || "und")}${item.automatic ? " · 自动" : ""}</small></span>
        <em>${Math.round(item.score || 0)}%</em>
      </label>
    `).join("") : `<span>没有找到字幕。${data.errors?.length ? escapeHtml(data.errors.join("；")) : "可配置在线字幕源后重试。"}</span>`;
    elements.downloadSubtitlesButton.classList.toggle("hidden", state.subtitles.length === 0);
  } catch (error) {
    elements.subtitleResults.innerHTML = `<span>${escapeHtml(error.message)}</span>`;
  }
}

async function downloadSelectedSubtitles() {
  const selected = elements.subtitleResults.querySelector("input[name='subtitleResult']:checked");
  if (!selected) return showStatus("请选择一个字幕结果");
  const result = state.subtitles[Number(selected.value)];
  try {
    const acquired = await fetchJson("/api/subtitle-center/acquire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result, targetVideo: state.subtitleContext?.targetVideo, outputDir: state.subtitleContext?.outputDir })
    });
    showStatus(acquired.existing ? "字幕文件已经在视频旁边" : `字幕已保存：${acquired.filePath || "下载目录"}`);
  } catch (error) {
    showStatus(error.message);
  }
}

function setSubtitleMode(mode) {
  state.subtitleMode = mode;
  document.querySelectorAll("[data-subtitle-mode]").forEach((item) => item.classList.toggle("active", item.dataset.subtitleMode === mode));
  document.querySelectorAll("[data-subtitle-source]").forEach((item) => item.classList.toggle("active", item.dataset.subtitleSource === mode));
  resizeWindowToTools({ animate: true });
}

function populateSubtitleTasks() {
  const tasks = state.tasks.filter((task) => ["video", "torrent", "magnet"].includes(task.kind) || /\.(mkv|mp4|avi|mov|webm|m4v|ts)$/i.test(task.name || ""));
  elements.subtitleTask.innerHTML = tasks.length
    ? tasks.map((task) => `<option value="${escapeHtml(task.id)}">${escapeHtml(task.name)} · ${statusText(task.status)}</option>`).join("")
    : '<option value="">没有可分析的视频任务</option>';
}

async function pickSubtitleVideo() {
  if (!window.downloader?.pickVideoFile) return showStatus("桌面版才能选择本地视频");
  const selected = await window.downloader.pickVideoFile();
  if (selected) elements.subtitleVideoPath.value = selected;
}

async function saveSubtitleProviders() {
  try {
    await fetchJson("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subtitles: {
        subdlApiKey: elements.subdlApiKey.value.trim(),
        openSubtitlesApiKey: elements.openSubtitlesApiKey.value.trim(),
        openSubtitlesToken: elements.openSubtitlesToken.value.trim(),
        preferredLanguages: elements.subtitleLanguages.value.split(",").map((item) => item.trim()).filter(Boolean)
      } })
    });
    showStatus("字幕源设置已保存到本机");
  } catch (error) {
    showStatus(error.message);
  }
}

async function openSubtitleForTask(task) {
  await openToolsDialog();
  switchToolTab("subtitle");
  setSubtitleMode("task");
  elements.subtitleTask.value = task.id;
}

function subtitleProviderName(provider) {
  return { sidecar: "同目录", embedded: "内嵌", source: "视频页面", subdl: "SubDL", opensubtitles: "OpenSubtitles", direct: "指定链接" }[provider] || provider;
}

function openTaskLimit(task) {
  state.limitTaskId = task.id;
  elements.limitTarget.textContent = task.name || task.id;
  elements.taskDownloadLimit.value = "0";
  elements.limitDialog.showModal();
  updateIcons();
}

async function saveTaskLimit() {
  try {
    await fetchJson(`/api/tasks/${encodeURIComponent(state.limitTaskId)}/limit`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ downloadLimit: elements.taskDownloadLimit.value })
    });
    elements.limitDialog.close();
    showStatus("任务限速已应用");
  } catch (error) {
    showStatus(error.message);
  }
}

function toLocalDateTime(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatScheduleTime(value) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function getTaskRowClass(task) {
  const statusClass =
    task.status === "complete"
      ? "status-complete"
      : task.status === "error"
        ? "status-error"
        : "";
  const isFastest = task.id === state.fastestTaskId;
  const isFocused = task.id === state.focusedDockTaskId;
  return ["task-row", statusClass, isFastest ? "is-fastest" : "", isFocused ? "is-row-focus" : ""]
    .filter(Boolean)
    .join(" ");
}

function renderSpeedSurgeClean() {
  return `
    <span class="speed-surge" title="Fastest task" aria-label="Fastest task">
      <span></span>
      <span></span>
      <span></span>
    </span>
  `;
}

async function openTaskLocation(task) {
  const target = task?.filePath || task?.filePaths?.[0] || task?.dir || state.health?.downloads;
  const fallback = task?.dir || state.health?.downloads;
  if (!target) {
    showStatus("没有可打开的下载位置");
    return;
  }

  if (!window.downloader?.openDownloadLocation) {
    showStatus(target);
    return;
  }

  await window.downloader.openDownloadLocation(target, fallback);
}

function askDeleteChoice(task) {
  return new Promise((resolve) => {
    pendingDeleteChoice = resolve;
    elements.deleteTarget.textContent = task?.name || "选择删除方式";
    elements.deleteDialog.showModal();
    updateIcons();
  });
}

function resolveDeleteChoice(choice) {
  if (elements.deleteDialog.open) elements.deleteDialog.close();
  const resolve = pendingDeleteChoice;
  pendingDeleteChoice = null;
  if (resolve) resolve(choice);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(typeof payload === "string" ? payload : payload.error || "请求失败。");
  }

  return payload;
}

function isActiveTask(task) {
  return ["active", "waiting", "processing"].includes(task.status);
}

function shouldShowInDock(task) {
  return ["active", "waiting", "processing", "paused", "error"].includes(task.status);
}

function queueSummaryText(tasks) {
  if (tasks.length === 0) return "没有正在进行的任务";
  if (tasks.length <= 2) return `${tasks.length} 个任务`;
  return `${tasks.length} 个任务，悬停展开`;
}

function statusText(status) {
  const map = {
    active: "下载中",
    waiting: "等待",
    paused: "暂停",
    complete: "完成",
    error: "错误",
    removed: "已移除",
    processing: "处理"
  };
  return map[status] || status || "未知";
}

function kindText(kind) {
  const map = {
    link: "链接",
    torrent: "BT",
    magnet: "磁力",
    video: "视频"
  };
  return map[kind] || kind || "任务";
}

function formatProgress(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatBytes(value) {
  const number = Number(value || 0);
  if (!number) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(number) / Math.log(1024)), units.length - 1);
  return `${(number / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showStatus(message) {
  elements.engineStatus.textContent = message;
}

function updateIcons() {
  if (window.lucide) window.lucide.createIcons();
}
