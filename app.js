const canvas = document.getElementById("preview");
const previewWhite = document.getElementById("previewWhite");
const previewDark = document.getElementById("previewDark");
const previewMobileTransparent = document.getElementById("previewMobileTransparent");
const previewMobileWhite = document.getElementById("previewMobileWhite");
const previewMobileDark = document.getElementById("previewMobileDark");
const ctx = canvas.getContext("2d");
const whiteCtx = previewWhite.getContext("2d");
const darkCtx = previewDark.getContext("2d");
const mobileTransparentCtx = previewMobileTransparent.getContext("2d");
const mobileWhiteCtx = previewMobileWhite.getContext("2d");
const mobileDarkCtx = previewMobileDark.getContext("2d");

const config = window.TEXT_ICON_SENDER_CONFIG || {};
const isLocalMode = location.protocol === "file:";
const STORAGE_KEYS = {
  historyCollapsed: "texticon_sender_history_collapsed",
  styleCollapsed: "texticon_sender_style_collapsed",
};

const els = {
  text: document.getElementById("text"),
  align: document.getElementById("align"),
  autoFit: document.getElementById("autoFit"),
  fontFamily: document.getElementById("fontFamily"),
  fontSize: document.getElementById("fontSize"),
  fontSizeField: document.getElementById("fontSizeField"),
  fontSizeValue: document.getElementById("fontSizeValue"),
  bgColor: document.getElementById("bgColor"),
  fillColor: document.getElementById("fillColor"),
  stroke1Color: document.getElementById("stroke1Color"),
  stroke2Color: document.getElementById("stroke2Color"),
  outlineEnabled: document.getElementById("outlineEnabled"),
  outlineWidth: document.getElementById("outlineWidth"),
  outlineWidthField: document.getElementById("outlineWidthField"),
  outlineWidthValue: document.getElementById("outlineWidthValue"),
  download: document.getElementById("download"),
  saveTest: document.getElementById("saveTest"),
  send: document.getElementById("send"),
  refreshHistory: document.getElementById("refreshHistory"),
  historyList: document.getElementById("historyList"),
  historySection: document.getElementById("historySection"),
  historyBody: document.getElementById("historyBody"),
  historyToggle: document.getElementById("historyToggle"),
  historySummary: document.getElementById("historySummary"),
  styleSection: document.getElementById("styleSection"),
  styleBody: document.getElementById("styleBody"),
  styleToggle: document.getElementById("styleToggle"),
  styleSummary: document.getElementById("styleSummary"),
  localStatusSection: document.getElementById("localStatusSection"),
  localCaption: document.getElementById("localCaption"),
  status: document.getElementById("status"),
};

const EDGE_MARGIN = 6;
const alignButtons = Array.from(document.querySelectorAll(".align-button"));
const swatchButtons = Array.from(document.querySelectorAll(".swatch-button"));
const presetButtons = Array.from(document.querySelectorAll(".preset-button[data-text]"));
const styleTabs = Array.from(document.querySelectorAll(".style-tab"));
const stylePanels = Array.from(document.querySelectorAll(".style-panel"));
const previewTabs = Array.from(document.querySelectorAll(".preview-tab"));
const previewPanels = Array.from(document.querySelectorAll(".preview-mobile-panel"));
const segmenter = typeof Intl !== "undefined" && Intl.Segmenter
  ? new Intl.Segmenter("ja", { granularity: "grapheme" })
  : null;

const state = {
  liffReady: false,
  liffError: "",
  userKey: "",
  historyItems: [],
  historyLoaded: false,
  historyDirty: true,
  sections: {
    historyCollapsed: false,
    styleCollapsed: false,
  },
};

function getEffectiveColorValue(input) {
  return input?.dataset.colorValue || input?.value || "";
}

function syncColorInputState(input) {
  if (!(input instanceof HTMLInputElement) || input.type !== "color") return;
  input.classList.toggle("is-transparent-value", getEffectiveColorValue(input) === "transparent");
}

function getActiveSwatchForTarget(targetId) {
  return swatchButtons.find((button) => button.dataset.target === targetId && button.classList.contains("is-active"));
}

function syncColorInputFromActiveSwatch(input) {
  if (!(input instanceof HTMLInputElement) || input.type !== "color") return;
  const activeSwatch = getActiveSwatchForTarget(input.id);
  const activeColor = activeSwatch?.dataset.color;
  if (activeColor) {
    if (activeColor !== "transparent") {
      input.value = activeColor;
    }
    input.dataset.colorValue = activeColor;
  } else {
    input.dataset.colorValue = input.value;
  }
  syncColorInputState(input);
}

function renderToContext(targetCtx, options = {}) {
  const { showOuterGuide = false } = options;
  const text = els.text.value || " ";
  const lines = text.split("\n");
  const outlineWidth = els.outlineEnabled.checked ? Number(els.outlineWidth.value) : 0;
  const stroke1 = outlineWidth;
  const stroke2 = outlineWidth;
  const totalStroke = stroke1 + stroke2;
  const contentPadding = EDGE_MARGIN + totalStroke;
  const backgroundColor = getEffectiveColorValue(els.bgColor);
  const fillColor = getEffectiveColorValue(els.fillColor);

  targetCtx.clearRect(0, 0, canvas.width, canvas.height);
  if (backgroundColor && backgroundColor !== "transparent") {
    targetCtx.fillStyle = backgroundColor;
    targetCtx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (showOuterGuide) {
    targetCtx.save();
    targetCtx.strokeStyle = "rgba(220, 38, 38, 0.85)";
    targetCtx.lineWidth = 1;
    targetCtx.setLineDash([4, 3]);
    targetCtx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
    targetCtx.restore();
  }

  let fontSize = Number(els.fontSize.value);
  const useAutoFit = els.autoFit.checked;
  if (useAutoFit) {
    fontSize = fitFontSize(
      lines,
      canvas.width - contentPadding * 2,
      canvas.height - contentPadding * 2,
      totalStroke
    );
  }

  const textCanvas = document.createElement("canvas");
  textCanvas.width = canvas.width;
  textCanvas.height = canvas.height;
  const textCtx = textCanvas.getContext("2d");
  const textMaskCanvas = document.createElement("canvas");
  textMaskCanvas.width = canvas.width;
  textMaskCanvas.height = canvas.height;
  const textMaskCtx = textMaskCanvas.getContext("2d");
  const emojiCanvas = document.createElement("canvas");
  emojiCanvas.width = canvas.width;
  emojiCanvas.height = canvas.height;
  const emojiCtx = emojiCanvas.getContext("2d");
  const emojiMaskCanvas = document.createElement("canvas");
  emojiMaskCanvas.width = canvas.width;
  emojiMaskCanvas.height = canvas.height;
  const emojiMaskCtx = emojiMaskCanvas.getContext("2d");
  const contentCanvas = document.createElement("canvas");
  contentCanvas.width = canvas.width;
  contentCanvas.height = canvas.height;
  const contentCtx = contentCanvas.getContext("2d");
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = canvas.width;
  maskCanvas.height = canvas.height;
  const maskCtx = maskCanvas.getContext("2d");

  [textCtx, emojiCtx, contentCtx].forEach((renderCtx) => {
    renderCtx.font = getFont(fontSize);
    renderCtx.textBaseline = "middle";
    renderCtx.textAlign = els.align.value;
    renderCtx.fillStyle = getEffectiveColorValue(els.fillColor);
  });
  [textMaskCtx, emojiMaskCtx, maskCtx].forEach((renderCtx) => {
    renderCtx.font = getFont(fontSize);
    renderCtx.textBaseline = "middle";
    renderCtx.textAlign = els.align.value;
    renderCtx.fillStyle = "#ffffff";
  });

  ctx.font = getFont(fontSize);
  const lineHeight = fontSize * 1.15;
  const blockHeight = lines.length * lineHeight;
  let x = canvas.width / 2;
  if (els.align.value === "left") {
    x = contentPadding;
  } else if (els.align.value === "right") {
    x = canvas.width - contentPadding;
  }
  const startY = canvas.height / 2 - blockHeight / 2 + lineHeight / 2;

  lines.forEach((line, index) => {
    const y = startY + index * lineHeight;
    drawSplitLine(line || " ", x, y, textCtx, emojiCtx, fontSize);
    drawSplitLine(line || " ", x, y, textMaskCtx, emojiMaskCtx, fontSize);
  });

  contentCtx.drawImage(textCanvas, 0, 0);
  contentCtx.drawImage(emojiCanvas, 0, 0);
  maskCtx.drawImage(textMaskCanvas, 0, 0);
  maskCtx.drawImage(emojiMaskCanvas, 0, 0);

  if (fillColor === "transparent") {
    targetCtx.save();
    targetCtx.globalCompositeOperation = "destination-out";
    targetCtx.drawImage(maskCanvas, 0, 0);
    targetCtx.restore();
  }

  drawRasterOutline(targetCtx, maskCanvas, stroke1 + stroke2, getEffectiveColorValue(els.stroke2Color));
  drawRasterOutline(targetCtx, maskCanvas, stroke1, getEffectiveColorValue(els.stroke1Color));
  targetCtx.drawImage(contentCanvas, 0, 0);
}

function syncOutputs() {
  els.fontSizeValue.value = els.fontSize.value;
  els.outlineWidthValue.value = els.outlineWidth.value;
  els.fontSizeField.classList.toggle("is-hidden", els.autoFit.checked);
  els.outlineWidthField.classList.toggle("is-hidden", !els.outlineEnabled.checked);
  els.stroke1Color.disabled = !els.outlineEnabled.checked;
  els.stroke2Color.disabled = !els.outlineEnabled.checked;
}

function getFont(size) {
  return `700 ${size}px ${els.fontFamily.value}`;
}

function fitFontSize(lines, maxWidth, maxHeight, strokeWidth) {
  let size = Number(els.fontSize.value);
  for (; size >= 12; size -= 1) {
    ctx.font = getFont(size);
    const widths = lines.map((line) => {
      const m = ctx.measureText(line || " ");
      return m.actualBoundingBoxLeft + m.actualBoundingBoxRight + strokeWidth * 2;
    });
    const width = Math.max(...widths, 0);
    const lineHeight = size * 1.15;
    const height = lines.length * lineHeight + strokeWidth * 2;
    if (width <= maxWidth && height <= maxHeight) {
      return size;
    }
  }
  return 12;
}

function drawSplitLine(line, x, y, textCtx, emojiCtx, fontSize) {
  ctx.font = getFont(fontSize);
  const graphemes = splitGraphemes(line);
  const totalWidth = graphemes.reduce((sum, part) => sum + ctx.measureText(part).width, 0);
  let cursorX = x;

  if (els.align.value === "center") {
    cursorX = x - totalWidth / 2;
  } else if (els.align.value === "right") {
    cursorX = x - totalWidth;
  }

  graphemes.forEach((part) => {
    const targetCtx = isEmojiLike(part) ? emojiCtx : textCtx;
    targetCtx.textAlign = "left";
    targetCtx.fillText(part, cursorX, y);
    cursorX += ctx.measureText(part).width;
  });
}

function splitGraphemes(text) {
  if (!segmenter) return Array.from(text);
  return Array.from(segmenter.segment(text), ({ segment }) => segment);
}

function isEmojiLike(text) {
  return /\p{Extended_Pictographic}/u.test(text);
}

function drawRasterOutline(targetCtx, sourceCanvas, radius, color) {
  if (radius <= 0) return;

  const tinted = document.createElement("canvas");
  tinted.width = sourceCanvas.width;
  tinted.height = sourceCanvas.height;
  const tintedCtx = tinted.getContext("2d");
  const outlineCanvas = document.createElement("canvas");
  outlineCanvas.width = sourceCanvas.width;
  outlineCanvas.height = sourceCanvas.height;
  const outlineCtx = outlineCanvas.getContext("2d");

  tintedCtx.drawImage(sourceCanvas, 0, 0);
  tintedCtx.globalCompositeOperation = "source-in";
  tintedCtx.fillStyle = color;
  tintedCtx.fillRect(0, 0, tinted.width, tinted.height);
  tintedCtx.globalCompositeOperation = "source-over";

  const offsets = getCircleOffsets(radius);
  offsets.forEach(([dx, dy]) => {
    if (dx === 0 && dy === 0) return;
    outlineCtx.drawImage(tinted, dx, dy);
  });

  // Remove the original glyph interior so transparent fill stays transparent.
  outlineCtx.globalCompositeOperation = "destination-out";
  outlineCtx.drawImage(sourceCanvas, 0, 0);
  outlineCtx.globalCompositeOperation = "source-over";
  targetCtx.drawImage(outlineCanvas, 0, 0);
}

function getCircleOffsets(radius) {
  const points = [];
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy <= radius * radius) {
        points.push([dx, dy]);
      }
    }
  }
  return points;
}

function generate() {
  renderToContext(ctx, { showOuterGuide: true });
  whiteCtx.clearRect(0, 0, previewWhite.width, previewWhite.height);
  darkCtx.clearRect(0, 0, previewDark.width, previewDark.height);
  whiteCtx.drawImage(canvas, 0, 0);
  darkCtx.drawImage(canvas, 0, 0);
  mobileTransparentCtx.clearRect(0, 0, previewMobileTransparent.width, previewMobileTransparent.height);
  mobileWhiteCtx.clearRect(0, 0, previewMobileWhite.width, previewMobileWhite.height);
  mobileDarkCtx.clearRect(0, 0, previewMobileDark.width, previewMobileDark.height);
  mobileTransparentCtx.drawImage(canvas, 0, 0);
  mobileWhiteCtx.drawImage(canvas, 0, 0);
  mobileDarkCtx.drawImage(canvas, 0, 0);
}

function buildExportCanvas() {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  const exportCtx = exportCanvas.getContext("2d");
  renderToContext(exportCtx);
  return exportCanvas;
}

function download() {
  const exportCanvas = buildExportCanvas();
  const link = document.createElement("a");
  const safe = (els.text.value || "texticon").replace(/[^\p{L}\p{N}_-]+/gu, "_");
  link.href = exportCanvas.toDataURL("image/png");
  link.download = `${safe || "texticon_sender"}.png`;
  link.click();
}

async function saveHistoryItem(item) {
  const imageUrl = item.originalContentUrl || item.previewImageUrl;
  if (!imageUrl) {
    throw new Error("保存する画像が見つかりません。");
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`画像の取得に失敗しました (${response.status})`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safe = (item.text || "texticon").replace(/[^\p{L}\p{N}_-]+/gu, "_");
  link.href = objectUrl;
  link.download = `${safe || "texticon_sender"}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function setStatus(message, tone = "info") {
  els.status.textContent = message;
  els.status.className = `status-box is-${tone}`;
}

function setSendDisabled(disabled) {
  els.send.disabled = disabled;
}

function setSendLoading(loading) {
  els.send.classList.toggle("is-loading", loading);
  els.send.setAttribute("aria-busy", String(loading));
  els.send.innerHTML = loading
    ? '<span class="button-spinner" aria-hidden="true"></span><span>準備中...</span>'
    : "送信";
}

function setSaveTestDisabled(disabled) {
  els.saveTest.disabled = disabled;
}

function loadStoredBoolean(key, fallback = false) {
  try {
    const value = window.localStorage.getItem(key);
    if (value === "true") return true;
    if (value === "false") return false;
  } catch (_) {
    return fallback;
  }
  return fallback;
}

function saveStoredBoolean(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch (_) {
    // ignore storage errors
  }
}

function updateToggleButton(button, collapsed) {
  if (!button) return;
  const sectionName = button === els.historyToggle ? "History" : "Style";
  button.textContent = collapsed ? "▶" : "▼";
  button.setAttribute("aria-expanded", String(!collapsed));
  button.setAttribute("aria-label", collapsed ? `${sectionName} を開く` : `${sectionName} を閉じる`);
  button.classList.toggle("is-collapsed", collapsed);
}

async function ensureHistoryLoadedIfNeeded(force = false) {
  if (!hasGasConfig() || state.sections.historyCollapsed) return;
  if (!force && state.historyLoaded && !state.historyDirty) return;
  renderHistoryLoading();
  await refreshHistory();
}

function setSectionCollapsed(name, collapsed, options = {}) {
  const { persist = true, skipLoad = false } = options;

  if (name === "history") {
    state.sections.historyCollapsed = collapsed;
    if (els.historyBody) {
      els.historyBody.hidden = collapsed;
      els.historyBody.setAttribute("aria-hidden", String(collapsed));
    }
    if (els.historySection) {
      els.historySection.dataset.collapsed = String(collapsed);
    }
    if (els.historySummary) {
      els.historySummary.hidden = collapsed;
    }
    updateToggleButton(els.historyToggle, collapsed);
    if (persist) {
      saveStoredBoolean(STORAGE_KEYS.historyCollapsed, collapsed);
    }
    if (!collapsed && !skipLoad) {
      void ensureHistoryLoadedIfNeeded();
    }
    return;
  }

  state.sections.styleCollapsed = collapsed;
  if (els.styleBody) {
    els.styleBody.hidden = collapsed;
    els.styleBody.setAttribute("aria-hidden", String(collapsed));
  }
  if (els.styleSection) {
    els.styleSection.dataset.collapsed = String(collapsed);
  }
  if (els.styleSummary) {
    els.styleSummary.hidden = collapsed;
  }
  updateToggleButton(els.styleToggle, collapsed);
  if (persist) {
    saveStoredBoolean(STORAGE_KEYS.styleCollapsed, collapsed);
  }
}

function initializeSectionState() {
  state.sections.historyCollapsed = loadStoredBoolean(STORAGE_KEYS.historyCollapsed, true);
  state.sections.styleCollapsed = loadStoredBoolean(STORAGE_KEYS.styleCollapsed, false);
  setSectionCollapsed("history", state.sections.historyCollapsed, { persist: false, skipLoad: true });
  setSectionCollapsed("style", state.sections.styleCollapsed, { persist: false });
}

function applyLocalModeVisibility() {
  if (els.localStatusSection) {
    els.localStatusSection.hidden = !isLocalMode;
  }
  if (els.saveTest) {
    els.saveTest.hidden = !isLocalMode;
  }
  if (els.localCaption) {
    els.localCaption.hidden = !isLocalMode;
  }
}

function sanitizeIdentityKey(value) {
  return String(value || "")
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, "_")
    .slice(0, 120);
}

function getEffectiveUserKey() {
  return state.userKey
    || sanitizeIdentityKey(config.testUserKey || config.localTestUserKey || "")
    || "local_debug";
}

function buildAssetKey() {
  return JSON.stringify({
    text: els.text.value || "",
    align: els.align.value,
    autoFit: els.autoFit.checked,
    fontFamily: els.fontFamily.value,
    fontSize: Number(els.fontSize.value),
    bgColor: getEffectiveColorValue(els.bgColor),
    fillColor: getEffectiveColorValue(els.fillColor),
    outlineEnabled: els.outlineEnabled.checked,
    outlineWidth: Number(els.outlineWidth.value),
    stroke1Color: getEffectiveColorValue(els.stroke1Color),
    stroke2Color: getEffectiveColorValue(els.stroke2Color),
    size: "256x256",
  });
}

function formatHistoryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHistoryLoading() {
  els.historyList.innerHTML = '<p class="sender-help loading-note">履歴を読み込んでいます。</p>';
}

function renderHistoryList(items) {
  state.historyItems = items;
  if (!items.length) {
    els.historyList.innerHTML = '<p class="sender-help">履歴がまだありません。</p>';
    return;
  }

  els.historyList.innerHTML = items.map((item, index) => {
    const sub = [formatHistoryDate(item.createdAt)].filter(Boolean).join(" / ");
    return `
      <article class="history-item">
        <div class="history-thumb">
          <img src="${escapeHtml(item.previewImageUrl)}" alt="保存済み画像" loading="lazy" />
        </div>
        <div class="history-meta">
          <div class="history-sub">${escapeHtml(sub)}</div>
        </div>
        <div class="history-controls">
          <button class="secondary-action history-button" type="button" data-history-save="${index}">保存</button>
          <button class="secondary-action history-button" type="button" data-history-send="${index}" ${state.liffReady ? "" : "disabled"}>送信</button>
        </div>
      </article>
    `;
  }).join("");

  els.historyList.querySelectorAll("[data-history-save]").forEach((button) => {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.historySave);
      const item = state.historyItems[index];
      if (!item) return;
      button.disabled = true;
      try {
        await saveHistoryItem(item);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`履歴画像の保存に失敗しました: ${message}`, "error");
      } finally {
        button.disabled = false;
      }
    });
  });

  els.historyList.querySelectorAll("[data-history-send]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.historySend);
      const item = state.historyItems[index];
      if (!item) return;
      void sendHistoryItem(item);
    });
  });
}

function activateStyleTab(tabName) {
  styleTabs.forEach((tab) => {
    const isActive = tab.dataset.styleTab === tabName;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  stylePanels.forEach((panel) => {
    const isActive = panel.dataset.stylePanel === tabName;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
}

function activatePreviewTab(tabName) {
  previewTabs.forEach((tab) => {
    const isActive = tab.dataset.previewTab === tabName;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  previewPanels.forEach((panel) => {
    const isActive = panel.dataset.previewPanel === tabName;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
}

function hasSenderConfig() {
  return Boolean(config.liffId && config.gasWebAppUrl);
}

function hasGasConfig() {
  return Boolean(config.gasWebAppUrl);
}

async function initLiff() {
  if (!config.liffId) {
    setStatus("`config.js` の `liffId` が未設定です。PNG書き出しは使えます。", "warn");
    setSendDisabled(true);
    setSaveTestDisabled(!hasGasConfig());
    return;
  }

  if (location.protocol === "file:") {
    setStatus("`file://` では LIFF を初期化できません。GitHub Pages など HTTPS で開いてください。", "warn");
    setSendDisabled(true);
    setSaveTestDisabled(!hasGasConfig());
    return;
  }

  if (typeof liff === "undefined") {
    setStatus("LIFF SDK の読み込みに失敗しました。", "error");
    setSendDisabled(true);
    setSaveTestDisabled(!hasGasConfig());
    return;
  }

  try {
    await liff.init({
      liffId: config.liffId,
      withLoginOnExternalBrowser: true,
    });

    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }

    state.liffReady = true;
    const decoded = typeof liff.getDecodedIDToken === "function" ? liff.getDecodedIDToken() : null;
    state.userKey = sanitizeIdentityKey(decoded?.sub || "");
    setSaveTestDisabled(!hasGasConfig());
    if (config.gasWebAppUrl) {
      setStatus("LIFF の初期化が完了しました。Google Drive 保存と共有を実行できます。", "success");
      setSendDisabled(false);
    } else {
      setStatus("LIFF は初期化できましたが、`gasWebAppUrl` が未設定です。", "warn");
      setSendDisabled(true);
    }
  } catch (error) {
    state.liffError = error instanceof Error ? error.message : String(error);
    setStatus(`LIFF 初期化に失敗しました: ${state.liffError}`, "error");
    setSendDisabled(true);
    setSaveTestDisabled(!hasGasConfig());
  }
}

function canvasToBlob(exportCanvas) {
  return new Promise((resolve, reject) => {
    exportCanvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("PNG の生成に失敗しました。"));
    }, "image/png");
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("画像の Base64 変換に失敗しました。"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("画像の読み取りに失敗しました。"));
    reader.readAsDataURL(blob);
  });
}

async function uploadToGas(blob) {
  const safe = (els.text.value || "texticon").replace(/[^\p{L}\p{N}_-]+/gu, "_");
  const payload = {
    fileName: `${safe || "texticon_sender"}.png`,
    mimeType: "image/png",
    folderLabel: config.defaultFolderLabel || "TextIconSender",
    text: els.text.value || "",
    userKey: getEffectiveUserKey(),
    assetKey: buildAssetKey(),
    imageBase64: await blobToBase64(blob),
  };

  const response = await fetch(config.gasWebAppUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`アップロードに失敗しました (${response.status})`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || "GAS がエラーを返しました。");
  }
  return data;
}

async function fetchHistory() {
  if (!hasGasConfig()) {
    throw new Error("`config.js` の `gasWebAppUrl` が未設定です。");
  }

  const url = new URL(config.gasWebAppUrl);
  url.searchParams.set("action", "history");
  url.searchParams.set("userKey", getEffectiveUserKey());
  url.searchParams.set("limit", "12");

  const response = await fetch(url.toString(), {
    method: "GET",
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`履歴取得に失敗しました (${response.status})`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || "履歴取得で GAS がエラーを返しました。");
  }
  return data.items || [];
}

async function refreshHistory() {
  if (!hasGasConfig()) {
    setStatus("`config.js` の `gasWebAppUrl` が未設定です。", "warn");
    return;
  }

  els.refreshHistory.disabled = true;
  try {
    setStatus("履歴を読み込んでいます。", "info");
    const items = await fetchHistory();
    renderHistoryList(items);
    state.historyLoaded = true;
    state.historyDirty = false;
    setStatus(`履歴を更新しました。${items.length}件あります。`, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`履歴取得に失敗しました: ${message}`, "error");
  } finally {
    els.refreshHistory.disabled = !hasGasConfig();
  }
}

function refreshHistorySilently() {
  if (!hasGasConfig()) return;
  state.historyDirty = true;
  if (state.sections.historyCollapsed) return;
  void fetchHistory()
    .then((items) => {
      renderHistoryList(items);
      state.historyLoaded = true;
      state.historyDirty = false;
    })
    .catch(() => {});
}

async function sendToLine() {
  if (!hasSenderConfig()) {
    setStatus("`config.js` の `liffId` または `gasWebAppUrl` が未設定です。", "warn");
    return;
  }
  if (!state.liffReady) {
    setStatus("LIFF の初期化完了後に再度お試しください。", "warn");
    return;
  }

  try {
    setSendDisabled(true);
    setSendLoading(true);
    setStatus("Google Drive へ保存しています。", "info");

    const exportCanvas = buildExportCanvas();
    const blob = await canvasToBlob(exportCanvas);
    const upload = await uploadToGas(blob);

    setStatus("LINE の送信先を選択してください。", "info");
    const result = await liff.shareTargetPicker(
      [
        {
          type: "image",
          originalContentUrl: upload.originalContentUrl,
          previewImageUrl: upload.previewImageUrl,
        },
      ],
      {
        isMultiple: true,
      }
    );

    if (result) {
      setStatus(`送信できました。${upload.folderName} に${upload.reused ? "再利用" : "保存"}済みです。`, "success");
    } else {
      setStatus(`送信はキャンセルされました。画像は ${upload.folderName} に${upload.reused ? "再利用" : "保存"}されています。`, "warn");
    }
    refreshHistorySilently();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`送信処理に失敗しました: ${message}`, "error");
  } finally {
    setSendLoading(false);
    setSendDisabled(!state.liffReady || !config.gasWebAppUrl);
  }
}

async function sendHistoryItem(item) {
  if (!state.liffReady) {
    setStatus("LIFF の初期化完了後に再度お試しください。", "warn");
    return;
  }

  try {
    setSendDisabled(true);
    setStatus("履歴画像の送信先を選択してください。", "info");
    const result = await liff.shareTargetPicker(
      [
        {
          type: "image",
          originalContentUrl: item.originalContentUrl,
          previewImageUrl: item.previewImageUrl,
        },
      ],
      {
        isMultiple: true,
      }
    );

    if (result) {
      setStatus("履歴画像を送信できました。", "success");
    } else {
      setStatus("履歴画像の送信はキャンセルされました。", "warn");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`履歴画像の送信に失敗しました: ${message}`, "error");
  } finally {
    setSendDisabled(!state.liffReady || !config.gasWebAppUrl);
  }
}

async function saveToDriveTest() {
  if (!hasGasConfig()) {
    setStatus("`config.js` の `gasWebAppUrl` が未設定です。", "warn");
    return;
  }

  try {
    setSaveTestDisabled(true);
    setStatus("Google Drive への保存テストを実行しています。", "info");

    const exportCanvas = buildExportCanvas();
    const blob = await canvasToBlob(exportCanvas);
    const upload = await uploadToGas(blob);
    setStatus(`保存テスト成功: ${upload.folderName} / ${upload.fileName}${upload.reused ? " を再利用" : ""}`, "success");
    refreshHistorySilently();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`Drive 保存テストに失敗しました: ${message}`, "error");
  } finally {
    setSaveTestDisabled(!hasGasConfig());
  }
}

Object.values(els).forEach((el) => {
  if (!(el instanceof HTMLElement)) return;
  const eventName = el.tagName === "BUTTON" ? "click" : "input";
  el.addEventListener(eventName, () => {
    if (el instanceof HTMLInputElement && el.type === "color") {
      el.dataset.colorValue = el.value;
      syncColorInputState(el);
      swatchButtons
        .filter((other) => other.dataset.target === el.id)
        .forEach((other) => {
          other.classList.toggle("is-active", other.dataset.color === el.value);
        });
    }
    syncOutputs();
    if (el === els.download || el === els.saveTest || el === els.send) return;
    generate();
  });
});

alignButtons.forEach((button) => {
  button.addEventListener("click", () => {
    els.align.value = button.dataset.align;
    alignButtons.forEach((other) => {
      other.classList.toggle("is-active", other === button);
    });
    generate();
  });
});

swatchButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.target;
    const color = button.dataset.color;
    if (!target || !color || !els[target]) return;
    if (els[target] instanceof HTMLInputElement && els[target].type === "color") {
      if (color !== "transparent") {
        els[target].value = color;
      }
      els[target].dataset.colorValue = color;
      syncColorInputState(els[target]);
    } else {
      els[target].value = color;
    }
    swatchButtons
      .filter((other) => other.dataset.target === target)
      .forEach((other) => {
        other.classList.toggle("is-active", other === button);
      });
    generate();
  });
});

styleTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const tabName = tab.dataset.styleTab;
    if (!tabName) return;
    activateStyleTab(tabName);
  });
});

previewTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const tabName = tab.dataset.previewTab;
    if (!tabName) return;
    activatePreviewTab(tabName);
  });
});

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    els.text.value = button.dataset.text || "";
    presetButtons.forEach((other) => {
      other.classList.toggle("is-active", other === button);
    });
    generate();
  });
});

els.download.addEventListener("click", download);
els.saveTest.addEventListener("click", saveToDriveTest);
els.send.addEventListener("click", sendToLine);
els.historyToggle.addEventListener("click", () => {
  setSectionCollapsed("history", !state.sections.historyCollapsed);
});
els.styleToggle.addEventListener("click", () => {
  setSectionCollapsed("style", !state.sections.styleCollapsed);
});
els.refreshHistory.addEventListener("click", () => {
  renderHistoryLoading();
  void refreshHistory();
});

syncOutputs();
[
  els.bgColor,
  els.fillColor,
  els.stroke1Color,
  els.stroke2Color,
].forEach((input) => {
  if (input instanceof HTMLInputElement) {
    syncColorInputFromActiveSwatch(input);
  }
});
generate();
applyLocalModeVisibility();
initializeSectionState();
setSendDisabled(true);
setSaveTestDisabled(!hasGasConfig());
els.refreshHistory.disabled = !hasGasConfig();
setStatus("`config.js` を確認しながら初期化しています。", "info");
activateStyleTab("color");
activatePreviewTab("transparent");
void initLiff().finally(() => {
  void ensureHistoryLoadedIfNeeded();
});
