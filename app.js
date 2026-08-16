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
const debugMode = new URLSearchParams(location.search).get("debug") === "1";
const STORAGE_KEYS = {
  historyCollapsed: "texticon_sender_history_collapsed",
  styleCollapsed: "texticon_sender_style_collapsed",
  styleSettings: "texticon_sender_style_settings",
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
  motionPreset: document.getElementById("motionPreset"),
  motionWrapX: document.getElementById("motionWrapX"),
  flexBubbleSize: document.getElementById("flexBubbleSize"),
  download: document.getElementById("download"),
  saveTest: document.getElementById("saveTest"),
  send: document.getElementById("send"),
  sendModeDialog: document.getElementById("sendModeDialog"),
  sendModeAnimatedNote: document.getElementById("sendModeAnimatedNote"),
  flexConfirmDialog: document.getElementById("flexConfirmDialog"),
  flexConfirmPreviewImg: document.getElementById("flexConfirmPreviewImg"),
  flexConfirmAnimatedNote: document.getElementById("flexConfirmAnimatedNote"),
  flexConfirmNoteToggles: document.getElementById("flexConfirmNoteToggles"),
  flexConfirmAnimatedOnly: document.getElementById("flexConfirmAnimatedOnly"),
  flexConfirmBodyPreview: document.getElementById("flexConfirmBodyPreview"),
  flexIncludeTextNote: document.getElementById("flexIncludeTextNote"),
  flexIncludeCaveatNote: document.getElementById("flexIncludeCaveatNote"),
  flexIncludeLiffLink: document.getElementById("flexIncludeLiffLink"),
  flexIncludeAltTextSuffix: document.getElementById("flexIncludeAltTextSuffix"),
  deleteHistoryDialog: document.getElementById("deleteHistoryDialog"),
  deleteFlexWarning: document.getElementById("deleteFlexWarning"),
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
  const { showOuterGuide = false, transform = {} } = options;
  const {
    offsetX = 0,
    offsetY = 0,
    scale = 1,
    rotation = 0,
    wrapX = false,
  } = transform;
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

  const tileOffsets = wrapX ? [-canvas.width, 0, canvas.width] : [0];
  const centerX = canvas.width / 2 + offsetX;
  const centerY = canvas.height / 2 + offsetY;

  tileOffsets.forEach((tileX) => {
    targetCtx.save();
    targetCtx.translate(centerX + tileX, centerY);
    targetCtx.rotate((rotation * Math.PI) / 180);
    targetCtx.scale(scale, scale);
    targetCtx.translate(-canvas.width / 2, -canvas.height / 2);

    if (fillColor === "transparent") {
      targetCtx.save();
      targetCtx.globalCompositeOperation = "destination-out";
      targetCtx.drawImage(maskCanvas, 0, 0);
      targetCtx.restore();
    }
    drawRasterOutline(targetCtx, maskCanvas, stroke1 + stroke2, getEffectiveColorValue(els.stroke2Color));
    drawRasterOutline(targetCtx, maskCanvas, stroke1, getEffectiveColorValue(els.stroke1Color));
    targetCtx.drawImage(contentCanvas, 0, 0);
    targetCtx.restore();
  });
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
  const lineCount = Math.max(lines.length, 1);
  const heightBound = Math.floor((maxHeight - strokeWidth * 2) / (lineCount * 1.15));
  let size = Math.max(12, Math.min(heightBound, CANVAS_SIZE_MAX));
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

let previewAnimationFrameId = null;
let previewAnimationStart = 0;
const PREVIEW_LOOP_DURATION_MS = 900;

function renderPreviewFrame(transform) {
  renderToContext(ctx, { showOuterGuide: true, transform });
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

function stopPreviewAnimation() {
  if (previewAnimationFrameId !== null) {
    cancelAnimationFrame(previewAnimationFrameId);
    previewAnimationFrameId = null;
  }
}

function startPreviewAnimation() {
  const presetName = els.motionPreset.value;
  const wrapX = els.motionWrapX.checked;
  previewAnimationStart = performance.now();
  const step = (now) => {
    const elapsed = now - previewAnimationStart;
    const t = (elapsed % PREVIEW_LOOP_DURATION_MS) / PREVIEW_LOOP_DURATION_MS;
    renderPreviewFrame({ ...computeMotionTransform(presetName, t), wrapX });
    previewAnimationFrameId = requestAnimationFrame(step);
  };
  previewAnimationFrameId = requestAnimationFrame(step);
}

function generate() {
  stopPreviewAnimation();
  if (els.motionPreset.value !== "none") {
    startPreviewAnimation();
  } else {
    renderPreviewFrame({});
  }
  saveStyleSettings();
}

const canvasWidthInput = document.getElementById("canvasWidth");
const canvasHeightInput = document.getElementById("canvasHeight");
const lockSquareInput = document.getElementById("lockSquare");
const sizePresetButtons = Array.from(document.querySelectorAll(".size-preset-button"));
const CANVAS_SIZE_MIN = 32;
const CANVAS_SIZE_MAX = 1024;
const allCanvases = [
  canvas,
  previewWhite,
  previewDark,
  previewMobileTransparent,
  previewMobileWhite,
  previewMobileDark,
];

function clampCanvasSize(value) {
  const num = Math.round(Number(value) || 256);
  return Math.min(CANVAS_SIZE_MAX, Math.max(CANVAS_SIZE_MIN, num));
}

function applyCanvasSize(width, height) {
  const w = clampCanvasSize(width);
  const h = clampCanvasSize(height);
  allCanvases.forEach((c) => {
    c.width = w;
    c.height = h;
  });
  canvasWidthInput.value = w;
  canvasHeightInput.value = h;
  generate();
}

function handleWidthChange() {
  const w = clampCanvasSize(canvasWidthInput.value);
  const h = lockSquareInput.checked ? w : clampCanvasSize(canvasHeightInput.value);
  applyCanvasSize(w, h);
}

function handleHeightChange() {
  const h = clampCanvasSize(canvasHeightInput.value);
  const w = lockSquareInput.checked ? h : clampCanvasSize(canvasWidthInput.value);
  applyCanvasSize(w, h);
}

canvasWidthInput.addEventListener("input", handleWidthChange);
canvasHeightInput.addEventListener("input", handleHeightChange);
lockSquareInput.addEventListener("change", () => {
  if (lockSquareInput.checked) {
    applyCanvasSize(canvasWidthInput.value, canvasWidthInput.value);
  }
});
sizePresetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const w = Number(button.dataset.width);
    const h = Number(button.dataset.height);
    lockSquareInput.checked = w === h;
    applyCanvasSize(w, h);
  });
});

const motionPresetButtons = Array.from(document.querySelectorAll(".motion-preset-button"));
motionPresetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    els.motionPreset.value = button.dataset.motionPreset;
    motionPresetButtons.forEach((other) => {
      other.classList.toggle("is-active", other === button);
    });
    generate();
  });
});

const flexSizeButtons = Array.from(document.querySelectorAll(".flex-size-button"));
flexSizeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    els.flexBubbleSize.value = button.dataset.flexSize;
    flexSizeButtons.forEach((other) => {
      other.classList.toggle("is-active", other.dataset.flexSize === button.dataset.flexSize);
    });
    generate();
  });
});

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

function buildAspectRatio(width, height) {
  const w = Math.max(1, Math.round(Number(width) || 1));
  const h = Math.max(1, Math.round(Number(height) || 1));
  const divisor = gcd(w, h) || 1;
  let ratioW = w / divisor;
  let ratioH = h / divisor;
  const ratio = ratioW / ratioH;
  if (ratio > 3) {
    ratioW = 3;
    ratioH = 1;
  } else if (ratio < 1 / 3) {
    ratioW = 1;
    ratioH = 3;
  }
  return `${ratioW}:${ratioH}`;
}

function buildExportCanvas() {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  const exportCtx = exportCanvas.getContext("2d");
  renderToContext(exportCtx);
  return exportCanvas;
}

async function download() {
  try {
    const safe = (els.text.value || "texticon").replace(/[^\p{L}\p{N}_-]+/gu, "_");
    const blob = els.motionPreset.value !== "none"
      ? await buildAnimationBlob()
      : await canvasToBlob(buildExportCanvas());
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${safe || "texticon_sender"}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`保存に失敗しました: ${message}`, "error");
  }
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

function setButtonLoading(button, loading, idleLabel) {
  if (!button) return;
  button.classList.toggle("is-loading", loading);
  button.setAttribute("aria-busy", String(loading));
  button.innerHTML = loading
    ? '<span class="button-spinner" aria-hidden="true"></span><span>準備中...</span>'
    : idleLabel;
}

function setSendLoading(loading) {
  setButtonLoading(els.send, loading, "送信");
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

function collectStyleSettings() {
  return {
    align: els.align.value,
    fontFamily: els.fontFamily.value,
    autoFit: els.autoFit.checked,
    fontSize: els.fontSize.value,
    bgColorValue: getEffectiveColorValue(els.bgColor),
    fillColorValue: getEffectiveColorValue(els.fillColor),
    stroke1ColorValue: getEffectiveColorValue(els.stroke1Color),
    stroke2ColorValue: getEffectiveColorValue(els.stroke2Color),
    outlineEnabled: els.outlineEnabled.checked,
    outlineWidth: els.outlineWidth.value,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    lockSquare: lockSquareInput.checked,
    motionPreset: els.motionPreset.value,
    motionWrapX: els.motionWrapX.checked,
    flexBubbleSize: els.flexBubbleSize.value,
    flexIncludeLiffLink: els.flexIncludeLiffLink.checked,
    flexIncludeAltTextSuffix: els.flexIncludeAltTextSuffix.checked,
  };
}

function saveStyleSettings() {
  try {
    window.localStorage.setItem(STORAGE_KEYS.styleSettings, JSON.stringify(collectStyleSettings()));
  } catch (_) {
    // ignore storage errors
  }
}

function loadStyleSettings() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.styleSettings);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function applyStoredColor(input, colorValue) {
  if (!colorValue) return;
  input.dataset.colorValue = colorValue;
  if (colorValue !== "transparent") {
    input.value = colorValue;
  }
  syncColorInputState(input);
  swatchButtons
    .filter((button) => button.dataset.target === input.id)
    .forEach((button) => {
      button.classList.toggle("is-active", button.dataset.color === colorValue);
    });
}

function applyStyleSettings(settings) {
  if (!settings) return false;

  if (settings.align) {
    els.align.value = settings.align;
    alignButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.align === settings.align);
    });
  }
  if (settings.fontFamily) els.fontFamily.value = settings.fontFamily;
  if (typeof settings.autoFit === "boolean") els.autoFit.checked = settings.autoFit;
  if (settings.fontSize) els.fontSize.value = settings.fontSize;

  applyStoredColor(els.bgColor, settings.bgColorValue);
  applyStoredColor(els.fillColor, settings.fillColorValue);
  applyStoredColor(els.stroke1Color, settings.stroke1ColorValue);
  applyStoredColor(els.stroke2Color, settings.stroke2ColorValue);

  if (typeof settings.outlineEnabled === "boolean") els.outlineEnabled.checked = settings.outlineEnabled;
  if (settings.outlineWidth) els.outlineWidth.value = settings.outlineWidth;

  if (settings.canvasWidth && settings.canvasHeight) {
    const w = clampCanvasSize(settings.canvasWidth);
    const h = clampCanvasSize(settings.canvasHeight);
    allCanvases.forEach((c) => {
      c.width = w;
      c.height = h;
    });
    canvasWidthInput.value = w;
    canvasHeightInput.value = h;
  }
  if (typeof settings.lockSquare === "boolean") {
    lockSquareInput.checked = settings.lockSquare;
  }
  if (settings.motionPreset) {
    els.motionPreset.value = settings.motionPreset;
    motionPresetButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.motionPreset === settings.motionPreset);
    });
  }
  if (typeof settings.motionWrapX === "boolean") {
    els.motionWrapX.checked = settings.motionWrapX;
  }
  if (settings.flexBubbleSize) {
    els.flexBubbleSize.value = settings.flexBubbleSize;
    flexSizeButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.flexSize === settings.flexBubbleSize);
    });
  }
  if (typeof settings.flexIncludeLiffLink === "boolean") {
    els.flexIncludeLiffLink.checked = settings.flexIncludeLiffLink;
  }
  if (typeof settings.flexIncludeAltTextSuffix === "boolean") {
    els.flexIncludeAltTextSuffix.checked = settings.flexIncludeAltTextSuffix;
  }

  return true;
}

function updateToggleButton(button, collapsed) {
  if (!button) return;
  const sectionName = button === els.historyToggle ? "History" : "Style";
  button.textContent = collapsed ? "▸" : "▾";
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
  els.refreshHistory.disabled = !hasGasConfig();
  state.historyDirty = true;
  if (!state.sections.historyCollapsed) {
    void ensureHistoryLoadedIfNeeded(true);
  }
}

function applyLocalModeVisibility() {
  if (els.localStatusSection) {
    const showStatus = debugMode;
    els.localStatusSection.hidden = !showStatus;
    els.localStatusSection.setAttribute("aria-hidden", String(!showStatus));
  }
  if (els.saveTest) {
    els.saveTest.hidden = !(isLocalMode && debugMode);
  }
  if (els.localCaption) {
    els.localCaption.hidden = !(isLocalMode && debugMode);
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
    size: `${canvas.width}x${canvas.height}`,
    motionPreset: els.motionPreset.value,
    motionWrapX: els.motionWrapX.checked,
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
    const sub = [
      formatHistoryDate(item.createdAt),
      item.flexLocked ? "Flex送信済み" : "",
    ].filter(Boolean).join(" / ");
    return `
      <article class="history-item">
        <div class="history-thumb">
          <img src="${escapeHtml(item.previewImageUrl)}" alt="保存済み画像" loading="lazy" />
        </div>
        <div class="history-meta">
          <div class="history-sub-row">
            <div class="history-sub">${escapeHtml(sub)}</div>
            <button class="secondary-action history-delete-pill" type="button" data-history-delete="${index}">削除</button>
          </div>
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

  els.historyList.querySelectorAll("[data-history-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.historyDelete);
      const item = state.historyItems[index];
      if (!item) return;
      const confirmed = await confirmDeleteHistoryItem(Boolean(item.flexLocked));
      if (!confirmed) return;
      button.disabled = true;
      try {
        await deleteHistoryItem(item);
        state.historyItems = state.historyItems.filter((entry) => entry.fileId !== item.fileId);
        renderHistoryList(state.historyItems);
        setStatus("履歴画像を削除しました。", "success");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`履歴画像の削除に失敗しました: ${message}`, "error");
      } finally {
        button.disabled = false;
      }
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

function supportsDialog() {
  return typeof HTMLDialogElement !== "undefined" && els.sendModeDialog instanceof HTMLDialogElement;
}

function chooseSendMode() {
  const isAnimated = els.motionPreset.value !== "none";

  if (!supportsDialog()) {
    const animatedHint = isAnimated
      ? "\n※動きプリセット(APNG)はFlex送信でのみ再生されます。画像送信では静止画になります。"
      : "";
    const useFlex = window.confirm(`Flex送信にしますか？\n「OK」でFlex送信、「キャンセル」で画像送信します。${animatedHint}`);
    return Promise.resolve(useFlex ? "flex" : "image");
  }

  if (els.sendModeAnimatedNote) {
    els.sendModeAnimatedNote.hidden = !isAnimated;
  }

  return new Promise((resolve) => {
    const dialog = els.sendModeDialog;
    const buttons = Array.from(dialog.querySelectorAll("[data-send-mode]"));

    const cleanup = () => {
      buttons.forEach((button) => button.removeEventListener("click", onClick));
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onClose);
    };

    const finish = (mode) => {
      cleanup();
      resolve(mode);
    };

    const onClick = (event) => {
      const target = event.currentTarget;
      const mode = target?.dataset?.sendMode || "cancel";
      dialog.close(mode);
    };

    const onCancel = () => {
      dialog.close("cancel");
    };

    const onClose = () => {
      finish(dialog.returnValue || "cancel");
    };

    buttons.forEach((button) => button.addEventListener("click", onClick));
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onClose);
    dialog.showModal();
  });
}

function renderFlexConfirmBodyPreview(isAnimated, sourceText) {
  if (!els.flexConfirmBodyPreview) return;
  const lines = buildFlexNoteLines(isAnimated, sourceText);
  if (!lines.length) {
    els.flexConfirmBodyPreview.hidden = true;
    els.flexConfirmBodyPreview.innerHTML = "";
    return;
  }
  els.flexConfirmBodyPreview.hidden = false;
  els.flexConfirmBodyPreview.innerHTML = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

let flexConfirmNoteToggleHandler = null;

function confirmFlexSend(previewSrc, isAnimated, sourceText = "") {
  if (els.flexConfirmPreviewImg && previewSrc) {
    els.flexConfirmPreviewImg.src = previewSrc;
  }
  if (els.flexConfirmAnimatedOnly) {
    els.flexConfirmAnimatedOnly.hidden = !isAnimated;
  }
  renderFlexConfirmBodyPreview(isAnimated, sourceText);

  if (flexConfirmNoteToggleHandler) {
    els.flexIncludeTextNote?.removeEventListener("input", flexConfirmNoteToggleHandler);
    els.flexIncludeCaveatNote?.removeEventListener("input", flexConfirmNoteToggleHandler);
  }
  flexConfirmNoteToggleHandler = () => renderFlexConfirmBodyPreview(isAnimated, sourceText);
  els.flexIncludeTextNote?.addEventListener("input", flexConfirmNoteToggleHandler);
  els.flexIncludeCaveatNote?.addEventListener("input", flexConfirmNoteToggleHandler);

  if (!(typeof HTMLDialogElement !== "undefined" && els.flexConfirmDialog instanceof HTMLDialogElement)) {
    return Promise.resolve(window.confirm("プレビュー画像に説明文を添えたカード形式でFlex送信します。よろしいですか？"));
  }

  return new Promise((resolve) => {
    const dialog = els.flexConfirmDialog;
    const buttons = Array.from(dialog.querySelectorAll("[data-flex-confirm]"));

    const cleanup = () => {
      buttons.forEach((button) => button.removeEventListener("click", onClick));
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onClose);
    };

    const finish = (confirmed) => {
      cleanup();
      resolve(confirmed);
    };

    const onClick = (event) => {
      const value = event.currentTarget?.dataset?.flexConfirm || "cancel";
      dialog.close(value);
    };

    const onCancel = () => {
      dialog.close("cancel");
    };

    const onClose = () => {
      finish(dialog.returnValue === "confirm");
    };

    buttons.forEach((button) => button.addEventListener("click", onClick));
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onClose);
    dialog.showModal();
  });
}

function confirmDeleteHistoryItem(isFlexLocked) {
  if (!(typeof HTMLDialogElement !== "undefined" && els.deleteHistoryDialog instanceof HTMLDialogElement)) {
    const warning = isFlexLocked
      ? "履歴画像を削除しますか？\nこの画像はFlex送信済みです。削除すると元に戻せず、送信済みのFlexメッセージの画像も表示・再生できなくなります(タップしてもこのページを開けなくなります)。"
      : "履歴画像を削除しますか？\n削除すると元に戻せません。";
    return Promise.resolve(window.confirm(warning));
  }

  if (els.deleteFlexWarning) {
    els.deleteFlexWarning.hidden = !isFlexLocked;
  }

  return new Promise((resolve) => {
    const dialog = els.deleteHistoryDialog;
    const buttons = Array.from(dialog.querySelectorAll("[data-delete-confirm]"));

    const cleanup = () => {
      buttons.forEach((button) => button.removeEventListener("click", onClick));
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onClose);
    };

    const finish = (confirmed) => {
      cleanup();
      resolve(confirmed);
    };

    const onClick = (event) => {
      const target = event.currentTarget;
      dialog.close(target?.dataset?.deleteConfirm || "cancel");
    };

    const onCancel = () => {
      dialog.close("cancel");
    };

    const onClose = () => {
      finish(dialog.returnValue === "delete");
    };

    buttons.forEach((button) => button.addEventListener("click", onClick));
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onClose);
    dialog.showModal();
  });
}

function getLiffShareUrl() {
  if (typeof liff !== "undefined" && liff?.permanentLink?.createUrl) {
    try {
      return liff.permanentLink.createUrl();
    } catch (_) {
      // fall through
    }
  }
  if (config.liffId) {
    return `https://liff.line.me/${config.liffId}`;
  }
  throw new Error("LIFF のリンク先 URL を作成できませんでした。");
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

const APNG_MAX_BYTES = 300 * 1024;
const APNG_FRAME_DURATION_MS = 70;
const APNG_FRAME_COUNTS = [12, 8, 6, 4];
const APNG_COLOR_LEVELS = [256, 64, 32, 16, 8];

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildPngChunk(type, data) {
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(8 + data.length + 4);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length, false);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)), false);
  return chunk;
}

function parsePngChunks(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const chunks = [];
  let offset = 8;
  while (offset < bytes.length) {
    const length = view.getUint32(offset, false);
    const type = new TextDecoder().decode(bytes.subarray(offset + 4, offset + 8));
    chunks.push({ type, data: bytes.subarray(offset + 8, offset + 8 + length) });
    offset += 12 + length;
  }
  return chunks;
}

async function extractPngFrameParts(blob) {
  const buffer = await blob.arrayBuffer();
  const chunks = parsePngChunks(buffer);
  const ihdr = chunks.find((chunk) => chunk.type === "IHDR").data;
  const idatChunks = chunks.filter((chunk) => chunk.type === "IDAT");
  const idatLength = idatChunks.reduce((sum, chunk) => sum + chunk.data.length, 0);
  const idatData = new Uint8Array(idatLength);
  let pos = 0;
  idatChunks.forEach((chunk) => {
    idatData.set(chunk.data, pos);
    pos += chunk.data.length;
  });
  return { ihdr, idatData };
}

function buildFcTLChunk(sequenceNumber, width, height, delayMs) {
  const data = new Uint8Array(26);
  const view = new DataView(data.buffer);
  view.setUint32(0, sequenceNumber, false);
  view.setUint32(4, width, false);
  view.setUint32(8, height, false);
  view.setUint32(12, 0, false);
  view.setUint32(16, 0, false);
  view.setUint16(20, Math.round(delayMs), false);
  view.setUint16(22, 1000, false);
  data[24] = 0;
  data[25] = 0;
  return buildPngChunk("fcTL", data);
}

async function buildApngBlob(frameBlobs, width, height, delayMs, numPlays) {
  const parts = await Promise.all(frameBlobs.map(extractPngFrameParts));

  const acTLData = new Uint8Array(8);
  const acTLView = new DataView(acTLData.buffer);
  acTLView.setUint32(0, parts.length, false);
  acTLView.setUint32(4, numPlays, false);

  const outputChunks = [
    buildPngChunk("IHDR", parts[0].ihdr),
    buildPngChunk("acTL", acTLData),
  ];

  let sequenceNumber = 0;
  parts.forEach((part, index) => {
    outputChunks.push(buildFcTLChunk(sequenceNumber, width, height, delayMs));
    sequenceNumber += 1;
    if (index === 0) {
      outputChunks.push(buildPngChunk("IDAT", part.idatData));
    } else {
      const fdatData = new Uint8Array(4 + part.idatData.length);
      new DataView(fdatData.buffer).setUint32(0, sequenceNumber, false);
      sequenceNumber += 1;
      fdatData.set(part.idatData, 4);
      outputChunks.push(buildPngChunk("fdAT", fdatData));
    }
  });
  outputChunks.push(buildPngChunk("IEND", new Uint8Array(0)));

  const totalLength = PNG_SIGNATURE.length + outputChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(totalLength);
  out.set(PNG_SIGNATURE, 0);
  let pos = PNG_SIGNATURE.length;
  outputChunks.forEach((chunk) => {
    out.set(chunk, pos);
    pos += chunk.length;
  });

  return new Blob([out], { type: "image/png" });
}

function computeMotionTransform(presetName, t) {
  const base = Math.min(canvas.width, canvas.height);
  const shakeAmplitude = base * (10 / 180);
  const hopAmplitude = base * (16 / 180);

  if (presetName === "xshake") {
    return {
      offsetX: Math.round(Math.sin(t * Math.PI * 2) * shakeAmplitude),
      rotation: Math.round(Math.sin(t * Math.PI * 2) * 4),
    };
  }
  if (presetName === "yshake") {
    return { offsetY: Math.round(Math.sin(t * Math.PI * 2) * shakeAmplitude) };
  }
  if (presetName === "hop") {
    return {
      offsetY: -Math.round(Math.sin(t * Math.PI) * hopAmplitude),
      scale: 1 + Math.sin(t * Math.PI) * 0.06,
    };
  }
  if (presetName === "zoom") {
    return { scale: 0.9 + Math.sin(t * Math.PI) * 0.16 };
  }
  if (presetName === "flowRight") {
    return { offsetX: Math.round(-canvas.width + canvas.width * 2 * t) };
  }
  if (presetName === "flowLeft") {
    return { offsetX: Math.round(canvas.width - canvas.width * 2 * t) };
  }
  return {};
}

function quantizeImageData(imageData, levels) {
  if (levels >= 256) return imageData;
  const step = 256 / levels;
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.round(data[i] / step) * step);
    data[i + 1] = Math.min(255, Math.round(data[i + 1] / step) * step);
    data[i + 2] = Math.min(255, Math.round(data[i + 2] / step) * step);
    data[i + 3] = Math.min(255, Math.round(data[i + 3] / step) * step);
  }
  return imageData;
}

async function renderMotionFrameBlobs(frameCount, colorLevels = 256) {
  const presetName = els.motionPreset.value;
  const wrapX = els.motionWrapX.checked;
  const blobs = [];
  for (let i = 0; i < frameCount; i += 1) {
    const t = frameCount <= 1 ? 0 : i / (frameCount - 1);
    const isEdgeFrame = i === 0 || i === frameCount - 1;
    const transform = isEdgeFrame ? {} : computeMotionTransform(presetName, t);
    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = canvas.width;
    frameCanvas.height = canvas.height;
    const frameCtx = frameCanvas.getContext("2d");
    renderToContext(frameCtx, { transform: { ...transform, wrapX } });
    if (colorLevels < 256) {
      const imageData = frameCtx.getImageData(0, 0, frameCanvas.width, frameCanvas.height);
      quantizeImageData(imageData, colorLevels);
      frameCtx.putImageData(imageData, 0, 0);
    }
    blobs.push(await canvasToBlob(frameCanvas));
  }
  return blobs;
}

async function buildAnimationBlob() {
  const fullFrameCount = APNG_FRAME_COUNTS[0];
  let lastBlob = null;

  // 1. まずコマ数はそのままに、色数(階調)を段階的に落として収める。
  for (const levels of APNG_COLOR_LEVELS) {
    const frameBlobs = await renderMotionFrameBlobs(fullFrameCount, levels);
    lastBlob = await buildApngBlob(frameBlobs, canvas.width, canvas.height, APNG_FRAME_DURATION_MS, 0);
    if (lastBlob.size <= APNG_MAX_BYTES) {
      return lastBlob;
    }
  }

  // 2. 最大限色数を落としても収まらない場合のみ、最後の手段としてコマ数を減らす。
  const minLevels = APNG_COLOR_LEVELS[APNG_COLOR_LEVELS.length - 1];
  for (const frameCount of APNG_FRAME_COUNTS.slice(1)) {
    const frameBlobs = await renderMotionFrameBlobs(frameCount, minLevels);
    lastBlob = await buildApngBlob(frameBlobs, canvas.width, canvas.height, APNG_FRAME_DURATION_MS, 0);
    if (lastBlob.size <= APNG_MAX_BYTES) {
      return lastBlob;
    }
  }

  const sizeKb = Math.ceil(lastBlob.size / 1024);
  setStatus(
    `色数・コマ数を最小まで減らしても${sizeKb}KBでLINEの300KB上限を超えています。LINEでは1フレーム目のみの静止画表示になります。テキストを短くするなどして収めてください。`,
    "warn"
  );
  return lastBlob;
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

async function uploadToGasWithOptions(blob, options = {}) {
  const safe = (els.text.value || "texticon").replace(/[^\p{L}\p{N}_-]+/gu, "_");
  const payload = {
    fileName: `${safe || "texticon_sender"}.png`,
    mimeType: "image/png",
    folderLabel: config.defaultFolderLabel || "TextIconSender",
    text: els.text.value || "",
    userKey: getEffectiveUserKey(),
    assetKey: buildAssetKey(),
    keepHistory: true,
    width: canvas.width,
    height: canvas.height,
    animated: Boolean(options.animated),
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

async function markFlexHistoryItem(fileId) {
  const response = await fetch(config.gasWebAppUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      action: "markFlex",
      userKey: getEffectiveUserKey(),
      fileId: fileId,
    }),
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Flex履歴の更新に失敗しました (${response.status})`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || "GAS が Flex履歴更新エラーを返しました。");
  }
  return data;
}

async function deleteHistoryItem(item) {
  if (!hasGasConfig()) {
    throw new Error("`config.js` の `gasWebAppUrl` が未設定です。");
  }

  const response = await fetch(config.gasWebAppUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      action: "delete",
      userKey: getEffectiveUserKey(),
      fileId: item.fileId,
    }),
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`削除に失敗しました (${response.status})`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || "GAS が削除エラーを返しました。");
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
    const mode = await chooseSendMode();
    if (mode === "cancel") {
      setStatus("送信はキャンセルされました。", "warn");
      return;
    }

    const isFlex = mode === "flex";
    // LINEの通常画像メッセージはanimatedプロパティを持たないため、Flex以外ではアニメーションが再生されない。
    const isAnimated = isFlex && els.motionPreset.value !== "none";

    let blob = null;
    if (isFlex) {
      setStatus("プレビューを準備しています。", "info");
      blob = isAnimated ? await buildAnimationBlob() : await canvasToBlob(buildExportCanvas());
      const previewObjectUrl = URL.createObjectURL(blob);
      const confirmSourceText = (els.text.value || "").replace(/\r?\n/g, " ").trim();
      const confirmed = await confirmFlexSend(previewObjectUrl, isAnimated, confirmSourceText);
      URL.revokeObjectURL(previewObjectUrl);
      if (!confirmed) {
        setStatus("送信はキャンセルされました。", "warn");
        return;
      }
    }

    setStatus(`保存しています。${isFlex ? "Flex送信した画像は履歴に残ります(削除すると送信済みメッセージも見れなくなります)。" : ""}`, "info");

    if (!blob) {
      blob = await canvasToBlob(buildExportCanvas());
    }
    const upload = await uploadToGasWithOptions(blob, {
      animated: isAnimated,
    });
    const message = isFlex
      ? buildFlexImageMessage(upload)
      : {
          type: "image",
          originalContentUrl: upload.originalContentUrl,
          previewImageUrl: upload.previewImageUrl,
        };

    setStatus(`LINE の送信先を選択してください。${isFlex ? "Flex送信" : "画像送信"}します。`, "info");
    const result = await liff.shareTargetPicker([message], {
      isMultiple: true,
    });

    if (result) {
      if (isFlex) {
        await markFlexHistoryItem(upload.fileId);
      }
      setStatus(`${isFlex ? "Flex送信" : "画像送信"}できました。${upload.folderName} に${upload.reused ? "再利用" : "保存"}済みです。`, "success");
    } else {
      setStatus(`${isFlex ? "Flex送信" : "画像送信"}はキャンセルされました。画像は ${upload.folderName} に${upload.reused ? "再利用" : "保存"}されています。`, "warn");
    }
    refreshHistorySilently();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`送信に失敗しました: ${message}`, "error");
  } finally {
    setSendLoading(false);
    setSendDisabled(!state.liffReady || !config.gasWebAppUrl);
  }
}

function buildFlexNoteLines(isAnimated, sourceText) {
  const lines = [];
  if (els.flexIncludeTextNote?.checked !== false) {
    const suffix = isAnimated ? "を動く画像で送信しました。" : "を送信しました。";
    lines.push(`「${sourceText || "(未入力)"}」${suffix}`);
  }
  if (isAnimated && els.flexIncludeCaveatNote?.checked !== false) {
    lines.push("※ご利用端末によっては、動く画像が取得されない場合があります。");
  }
  return lines;
}

function buildFlexBodyNotes(isAnimated, sourceText) {
  return buildFlexNoteLines(isAnimated, sourceText).map((text) => ({
    type: "text",
    text,
    size: "xxs",
    color: "#999999",
    wrap: true,
  }));
}

function buildFlexImageMessage(upload) {
  const isAnimated = Boolean(upload.animated);
  const flexImageUrl = isAnimated
    ? (upload.originalContentUrl || upload.previewImageUrl)
    : (upload.previewImageUrl || upload.originalContentUrl);
  const aspectRatio = buildAspectRatio(upload.width || canvas.width, upload.height || canvas.height);
  const sourceText = (upload.text ?? els.text.value ?? "").replace(/\r?\n/g, " ").trim();
  const bodyNotes = buildFlexBodyNotes(isAnimated, sourceText);
  const includeLiffLink = els.flexIncludeLiffLink?.checked !== false;
  const includeAltTextSuffix = els.flexIncludeAltTextSuffix?.checked !== false;
  const altText = includeAltTextSuffix ? `${sourceText || "画像"} - 💬TextIconSender` : (sourceText || "画像");
  return {
    type: "flex",
    altText,
    contents: {
      type: "bubble",
      size: els.flexBubbleSize.value || "giga",
      hero: {
        type: "image",
        url: flexImageUrl,
        size: "full",
        aspectRatio,
        aspectMode: "fit",
        animated: isAnimated,
        backgroundColor: "#00000000",
        ...(includeLiffLink
          ? {
              action: {
                type: "uri",
                label: "TextIconSender を開く",
                uri: getLiffShareUrl(),
              },
            }
          : {}),
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: bodyNotes,
        paddingAll: bodyNotes.length ? "12px" : "0px",
        spacing: "none",
        backgroundColor: "#00000000",
      },
      styles: {
        hero: {
          backgroundColor: "#00000000",
        },
        body: {
          backgroundColor: "#00000000",
        },
      },
    },
  };
}

async function sendHistoryItem(item) {
  if (!state.liffReady) {
    setStatus("LIFF の初期化完了後に再度お試しください。", "warn");
    return;
  }

  try {
    const mode = await chooseSendMode();
    if (mode === "cancel") {
      setStatus("送信はキャンセルされました。", "warn");
      return;
    }
    const isFlex = mode === "flex";

    if (isFlex) {
      const confirmSourceText = (item.text || els.text.value || "").replace(/\r?\n/g, " ").trim();
      const isItemAnimated = Boolean(item.animated);
      const previewSrc = isItemAnimated
        ? (item.originalContentUrl || item.previewImageUrl)
        : (item.previewImageUrl || item.originalContentUrl);
      const confirmed = await confirmFlexSend(previewSrc, isItemAnimated, confirmSourceText);
      if (!confirmed) {
        setStatus("送信はキャンセルされました。", "warn");
        return;
      }
    }

    const message = isFlex
      ? buildFlexImageMessage(item)
      : {
          type: "image",
          originalContentUrl: item.originalContentUrl,
          previewImageUrl: item.previewImageUrl,
        };

    setSendDisabled(true);
    setStatus(`履歴画像の送信先を選択してください。${isFlex ? "Flex送信" : "画像送信"}します。`, "info");
    const result = await liff.shareTargetPicker([message], {
      isMultiple: true,
    });

    if (result) {
      if (isFlex && !item.flexLocked) {
        await markFlexHistoryItem(item.fileId);
      }
      setStatus(`履歴画像を${isFlex ? "Flex送信" : "画像送信"}できました。`, "success");
    } else {
      setStatus(`履歴画像の${isFlex ? "Flex送信" : "画像送信"}はキャンセルされました。`, "warn");
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
    setStatus("保存テストを実行しています。", "info");

    const isAnimated = els.motionPreset.value !== "none";
    const blob = isAnimated ? await buildAnimationBlob() : await canvasToBlob(buildExportCanvas());
    const upload = await uploadToGasWithOptions(blob, { animated: isAnimated });
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
const restoredStyleSettings = applyStyleSettings(loadStyleSettings());
if (!restoredStyleSettings) {
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
}
syncOutputs();
generate();
applyLocalModeVisibility();
initializeSectionState();
setSendDisabled(true);
setSaveTestDisabled(!hasGasConfig());
setStatus("`config.js` を確認しながら初期化しています。", "info");
activateStyleTab("color");
activatePreviewTab("transparent");
void initLiff().finally(() => {
  void ensureHistoryLoadedIfNeeded();
});
