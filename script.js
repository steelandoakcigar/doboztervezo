/*****************************************************************
 * EMLÉKDOBOZ TERVEZŐ – EXAKT SVG + SZÍNEZÉS + BŐVÍTETT FUNKCIÓK
 * - 3–7 cm feliratmagasság
 * - Felirat drag & drop (szöveg fogható)
 * - Minták: icons/*.svg fájlokból (valódi gyártási minták)
 * - Minták drag + resize (nem ugrik)
 * - Minták színe: palettáról állítható (fill/style felülírva)
 * - Doboz színezése: FA TEXTÚRA + SZÍN canvasról → #box backgroundImage
 * - Minták törlése: gomb + Delete / Backspace
 * - Ctrl+C / Ctrl+V minta duplikálás
 * - Összecsukható mintakategóriák (nyilas header)
 * - PNG export: fogantyúk és aktív keretek NEM látszanak
 * - TELJESEN MOBILKOMPATIBILIS (touch + mouse)
 *****************************************************************/

const COLORS = [
  "#e6e3dd", "#6e849b", "#0f94a0", "#0f4e8a",
  "#232324", "#7b5a48", "#c6b49a", "#72653b",
  "#9aad8d", "#3b6f3f", "#76b46a", "#c8a229",
  "#c57e86", "#8e6db3"
];

const MIN_PATTERN = 80;
const MAX_PATTERN = 300;

let currentTitleColor   = COLORS[4]; // felirat
let currentPatternColor = COLORS[5]; // minták
let currentBoxTint      = COLORS[6]; // doboz-szín (fa textúrára)

let activePattern    = null;
let patternDrag      = null;
let patternResize    = null;
let clipboardPattern = null;

let woodImage = null;
let woodReady = false;

/*****************************************************************
 * KÖZÖS POINTER KEZELÉS (EGÉR + TOUCH)
 *****************************************************************/
function getPointerPosition(e) {
  if (e.touches && e.touches.length > 0) {
    return {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  }
  return {
    x: e.clientX,
    y: e.clientY
  };
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/*****************************************************************
 * INIT
 *****************************************************************/
document.addEventListener("DOMContentLoaded", () => {
  preloadWoodTexture();
  initPalettes();
  initTitle();
  initPatternCategories();
  initPatterns();
  initShortcuts();
  initExport();
});

/*****************************************************************
 * FA TEXTÚRA BETÖLTÉSE
 *****************************************************************/
function preloadWoodTexture() {
  woodImage = new Image();
  woodImage.src = "assets/textures/wood.png";
  woodImage.onload = () => {
    woodReady = true;
    applyBoxTint(currentBoxTint);
  };
}

/*****************************************************************
 * SZÍNPALETTÁK
 *****************************************************************/
function initPalettes() {
  const titlePal   = document.getElementById("title-palette");
  const patternPal = document.getElementById("pattern-palette");
  const boxPal     = document.getElementById("box-palette");

  COLORS.forEach(color => {
    const t = makeSwatch(color, () => {
      currentTitleColor = color;
      document.getElementById("title-text").style.color = color;
    });
    titlePal.appendChild(t);

    const p = makeSwatch(color, () => {
      currentPatternColor = color;
      if (activePattern) applyPatternColor(activePattern, color);
    });
    patternPal.appendChild(p);

    const b = makeSwatch(color, () => {
      currentBoxTint = color;
      applyBoxTint(color);
    });
    boxPal.appendChild(b);
  });

  document.getElementById("title-text").style.color = currentTitleColor;
}

function makeSwatch(color, onClick) {
  const div = document.createElement("div");
  div.className = "color-swatch";
  div.style.backgroundColor = color;
  div.addEventListener("click", onClick);
  return div;
}

/*****************************************************************
 * DOBOZ SZÍNE FA TEXTÚRÁN
 *****************************************************************/
function applyBoxTint(color) {
  const box = document.getElementById("box");
  if (!box) return;

  if (!woodReady || !woodImage || !woodImage.naturalWidth) {
    box.style.backgroundImage = "url('assets/textures/wood.png')";
    box.style.backgroundColor = "";
    return;
  }

  const w = woodImage.naturalWidth;
  const h = woodImage.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");

  ctx.drawImage(woodImage, 0, 0, w, h);

  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  const dataURL = canvas.toDataURL("image/png");
  box.style.backgroundImage = `url(${dataURL})`;
  box.style.backgroundColor = "";
}

/*****************************************************************
 * FELIRAT – SZÖVEG, MÉRET, DRAG
 *****************************************************************/
function initTitle() {
  const input = document.getElementById("title-input");
  const size  = document.getElementById("title-size");
  const text  = document.getElementById("title-text");
  const layer = document.getElementById("title-layer");

  input.addEventListener("input", () => {
    text.textContent = input.value || "Felirat";
  });

  size.addEventListener("input", () => {
    let cm = parseFloat(size.value);
    if (isNaN(cm)) cm = 4;
    if (cm < 3) cm = 3;
    if (cm > 7) cm = 7;
    size.value = cm;

    const BOX_CM_HEIGHT = 22.5;
    const box = document.getElementById("box");
    const boxPxHeight = box.getBoundingClientRect().height;

    const pxPerCm = boxPxHeight / BOX_CM_HEIGHT;
    const desiredPx = cm * pxPerCm;

    const FONT_CAP_RATIO = 0.7;
    const fontSizePx = desiredPx / FONT_CAP_RATIO;

    text.style.fontSize = `${fontSizePx}px`;
  });
  size.dispatchEvent(new Event("input"));

  let dragState = null;

  // egér
  text.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();

    const transform = getComputedStyle(layer).transform;
    const matrix = new DOMMatrix(transform === "none" ? undefined : transform);

    dragState = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: matrix.m41,
      baseY: matrix.m42
    };
    text.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    const x = dragState.baseX + dx;
    const y = dragState.baseY + dy;
    layer.style.transform = `translate(${x}px, ${y}px)`;
  });

  document.addEventListener("mouseup", () => {
    if (!dragState) return;
    dragState = null;
    text.style.cursor = "grab";
  });

  // touch
  text.addEventListener("touchstart", (e) => {
    const pos = getPointerPosition(e);
    e.preventDefault();

    const transform = getComputedStyle(layer).transform;
    const matrix = new DOMMatrix(transform === "none" ? undefined : transform);

    dragState = {
      startX: pos.x,
      startY: pos.y,
      baseX: matrix.m41,
      baseY: matrix.m42
    };
    text.style.cursor = "grabbing";
  }, { passive: false });

  document.addEventListener("touchmove", (e) => {
    if (!dragState) return;
    const pos = getPointerPosition(e);
    e.preventDefault();
    const dx = pos.x - dragState.startX;
    const dy = pos.y - dragState.startY;
    const x = dragState.baseX + dx;
    const y = dragState.baseY + dy;
    layer.style.transform = `translate(${x}px, ${y}px)`;
  }, { passive: false });

  document.addEventListener("touchend", () => {
    if (!dragState) return;
    dragState = null;
    text.style.cursor = "grab";
  });
}

/*****************************************************************
 * MINTA KATEGÓRIÁK
 *****************************************************************/
function initPatternCategories() {
  document.querySelectorAll(".pattern-category").forEach(cat => {
    const header = cat.querySelector(".pattern-category-header");
    if (!header) return;
    header.addEventListener("click", () => {
      cat.classList.toggle("collapsed");
    });
  });
}

/*****************************************************************
 * MINTÁK – SVG-BŐL, DRAG + RESIZE (PC + MOBIL)
 *****************************************************************/
function initPatterns() {
  document.querySelectorAll(".pattern-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const img = btn.querySelector("img");
      if (!img) return;

      try {
        const svgText = await loadSvgAsText(img.src);
        addPatternFromSvg(svgText);
      } catch (err) {
        console.error("SVG betöltési hiba:", err);
        alert(
          "Nem sikerült betölteni a minta SVG-t.\n" +
          "Ellenőrizd, hogy az icons/*.svg fájlok feltöltve vannak, " +
          "és a fájlnevek pontosan megegyeznek az index.html-ben levő src-kkel."
        );
      }
    });
  });

  const layer = document.getElementById("patterns-layer");

  // egér
  layer.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;

    const pattern = e.target.closest(".pattern");
    if (!pattern) return;

    setActivePattern(pattern);

    if (e.target.classList.contains("resize-handle")) {
      startPatternResize(e, pattern);
    } else {
      startPatternDrag(e, pattern);
    }

    e.preventDefault();
  });

  // touch
  layer.addEventListener("touchstart", (e) => {
    const pattern = e.target.closest(".pattern");
    if (!pattern) return;

    setActivePattern(pattern);

    if (e.target.classList.contains("resize-handle")) {
      startPatternResize(e, pattern);
    } else {
      startPatternDrag(e, pattern);
    }

    e.preventDefault();
  }, { passive: false });

  document.addEventListener("mousemove", onPatternMove);
  document.addEventListener("touchmove", (e) => {
    onPatternMove(e);
    if (patternDrag || patternResize) {
      e.preventDefault();
    }
  }, { passive: false });

  document.addEventListener("mouseup", onPatternUp);
  document.addEventListener("touchend", onPatternUp);
}

async function loadSvgAsText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Nem sikerült betölteni: ${url}`);
  }
  return await res.text();
}

function addPatternFromSvg(svgText) {
  const layer = document.getElementById("patterns-layer");
  const layerRect = layer.getBoundingClientRect();

  const el = document.createElement("div");
  el.className = "pattern";
  el.innerHTML = svgText;

  const handle = document.createElement("div");
  handle.className = "resize-handle";
  el.appendChild(handle);

  const baseSize = 120;
  el.style.width  = baseSize + "px";
  el.style.height = baseSize + "px";

  const left = (layerRect.width  - baseSize) / 2;
  const top  = (layerRect.height - baseSize) / 2;
  el.style.left = `${left}px`;
  el.style.top  = `${top}px`;

  layer.appendChild(el);

  applyPatternColor(el, currentPatternColor);
  setActivePattern(el);
}

function setActivePattern(el) {
  activePattern = el;
  document.querySelectorAll(".pattern").forEach(p => p.classList.remove("active"));
  if (el) el.classList.add("active");
}

function applyPatternColor(patternEl, color) {
  const svg = patternEl.querySelector("svg");
  if (!svg) return;

  const targets = svg.querySelectorAll(
    "path, rect, circle, ellipse, polygon, polyline"
  );

  targets.forEach(el => {
    const fillAttr = el.getAttribute("fill");
    if (fillAttr !== "none") {
      el.setAttribute("fill", color);
      el.style.fill = color;
    }
    const strokeAttr = el.getAttribute("stroke");
    if (strokeAttr && strokeAttr !== "none") {
      el.setAttribute("stroke", color);
      el.style.stroke = color;
    }
  });

  const styleEl = svg.querySelector("style");
  if (styleEl && styleEl.textContent.includes("fill:")) {
    styleEl.textContent = styleEl.textContent.replace(
      /fill:\s*#[0-9a-fA-F]{3,6}/g,
      `fill:${color}`
    );
  }
}

/* DRAG + RESIZE – közös logika */

function startPatternDrag(e, pattern) {
  const pos = getPointerPosition(e);
  const layer = pattern.parentElement;
  const layerRect = layer.getBoundingClientRect();
  const rect = pattern.getBoundingClientRect();

  const offsetX = pos.x - rect.left;
  const offsetY = pos.y - rect.top;

  patternDrag = {
    pattern,
    layerRect,
    offsetX,
    offsetY
  };
}

function startPatternResize(e, pattern) {
  const pos = getPointerPosition(e);
  const rect = pattern.getBoundingClientRect();
  patternResize = {
    pattern,
    startX: pos.x,
    startY: pos.y,
    startWidth: rect.width,
    startHeight: rect.height,
    aspect: rect.width / rect.height
  };
}

function onPatternMove(e) {
  const pos = getPointerPosition(e);

  if (patternDrag) {
    const { pattern, layerRect, offsetX, offsetY } = patternDrag;

    let newLeft = pos.x - layerRect.left - offsetX;
    let newTop  = pos.y - layerRect.top  - offsetY;

    const maxLeft = layerRect.width  - pattern.offsetWidth;
    const maxTop  = layerRect.height - pattern.offsetHeight;

    newLeft = clamp(newLeft, 0, maxLeft);
    newTop  = clamp(newTop, 0, maxTop);

    pattern.style.left = `${newLeft}px`;
    pattern.style.top  = `${newTop}px`;
  }

  if (patternResize) {
    const { pattern, startX, startY, startWidth, aspect } = patternResize;
    const dx = pos.x - startX;
    const dy = pos.y - startY;
    const delta = Math.max(dx, dy);

    let newWidth = startWidth + delta;
    newWidth = clamp(newWidth, MIN_PATTERN, MAX_PATTERN);
    const newHeight = newWidth / aspect;

    pattern.style.width  = `${newWidth}px`;
    pattern.style.height = `${newHeight}px`;
  }
}

function onPatternUp() {
  patternDrag = null;
  patternResize = null;
}

/*****************************************************************
 * TÖRLÉS, MÁSOLÁS / BEILLESZTÉS
 *****************************************************************/
function initShortcuts() {
  const deleteBtn = document.getElementById("delete-pattern-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      deleteActivePattern();
    });
  }

  document.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    if ((e.key === "Delete" || e.key === "Backspace") && activePattern) {
      e.preventDefault();
      deleteActivePattern();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && activePattern) {
      e.preventDefault();
      copyActivePattern();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" && clipboardPattern) {
      e.preventDefault();
      pastePattern();
      return;
    }
  });
}

function deleteActivePattern() {
  if (!activePattern) return;
  activePattern.remove();
  activePattern = null;
}

function copyActivePattern() {
  if (!activePattern) return;
  const svg = activePattern.querySelector("svg");
  if (!svg) return;
  clipboardPattern = {
    svg: svg.outerHTML,
    width: activePattern.offsetWidth,
    height: activePattern.offsetHeight
  };
}

function pastePattern() {
  if (!clipboardPattern) return;
  const layer = document.getElementById("patterns-layer");
  const layerRect = layer.getBoundingClientRect();

  const el = document.createElement("div");
  el.className = "pattern";
  el.innerHTML = clipboardPattern.svg;

  const handle = document.createElement("div");
  handle.className = "resize-handle";
  el.appendChild(handle);

  el.style.width  = clipboardPattern.width + "px";
  el.style.height = clipboardPattern.height + "px";

  let baseLeft = (layerRect.width  - clipboardPattern.width)  / 2;
  let baseTop  = (layerRect.height - clipboardPattern.height) / 2;

  if (activePattern) {
    baseLeft = activePattern.offsetLeft + 20;
    baseTop  = activePattern.offsetTop  + 20;
  }

  el.style.left = baseLeft + "px";
  el.style.top  = baseTop + "px";

  layer.appendChild(el);
  setActivePattern(el);
}

/*****************************************************************
 * PNG EXPORT
 *****************************************************************/
function initExport() {
  const btn = document.getElementById("export-btn");
  const box = document.getElementById("box");

  btn.addEventListener("click", async () => {
    try {
      const prevActive = document.querySelector(".pattern.active");
      document.querySelectorAll(".pattern").forEach(p => p.classList.remove("active"));

      const canvas = await html2canvas(box, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false
      });

      if (prevActive) prevActive.classList.add("active");

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = "emlekdoboz.png";
      link.click();

    } catch (err) {
      console.error("Export hiba:", err);
      alert("Hiba történt a PNG export során.");
    }
  });
}

