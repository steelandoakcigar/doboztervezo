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

// fa textúra a “bázis” színhez
let woodImage = null;
let woodReady = false;

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
    // ha már van alap szín, ráégetjük
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
    // felirat
    const t = makeSwatch(color, () => {
      currentTitleColor = color;
      document.getElementById("title-text").style.color = color;
    });
    titlePal.appendChild(t);

    // minták
    const p = makeSwatch(color, () => {
      currentPatternColor = color;
      if (activePattern) applyPatternColor(activePattern, color);
    });
    patternPal.appendChild(p);

    // doboz – fa textúrára égetett szín
    const b = makeSwatch(color, () => {
      currentBoxTint = color;
      applyBoxTint(color);
    });
    boxPal.appendChild(b);
  });

  // alap feliratszín
  document.getElementById("title-text").style.color = currentTitleColor;
}

function makeSwatch(color, onClick) {
  const div = document.createElement("div");
  div.className = "color-swatch";
  div.style.backgroundColor = color;
  div.addEventListener("click", onClick);
  return div;
}

function hexToRgba(hex, alpha) {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map(x => x + x).join("");
  const n = parseInt(c, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Doboz szín alkalmazása fa textúrára:
 * - canvasra rajzoljuk a wood.png-t
 * - multiply módban ráhúzzuk a választott színt
 * - a végeredmény dataURL-ként a #box backgroundImage-e
 * → html2canvas exportban 1:1-ben ezt látjuk viszont
 */
function applyBoxTint(color) {
  const box = document.getElementById("box");
  if (!box) return;

  // ha még nincs kész a fa kép, kap egy sima fa hátteret
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

  // 1) fa textúra
  ctx.drawImage(woodImage, 0, 0, w, h);

  // 2) szín ráégetése
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;        // intenzitás
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

  // szöveg
  input.addEventListener("input", () => {
    text.textContent = input.value || "Felirat";
  });

  // magasság 3–7 cm között
  size.addEventListener("input", () => {
    let cm = parseFloat(size.value);
    if (isNaN(cm)) cm = 4;
    if (cm < 3) cm = 3;
    if (cm > 7) cm = 7;
    size.value = cm;

    const BOX_CM_HEIGHT = 22.5; // 225 mm
    const box = document.getElementById("box");
    const boxPxHeight = box.getBoundingClientRect().height;

    const pxPerCm = boxPxHeight / BOX_CM_HEIGHT;
    const desiredPx = cm * pxPerCm;

    const FONT_CAP_RATIO = 0.7;
    const fontSizePx = desiredPx / FONT_CAP_RATIO;

    text.style.fontSize = `${fontSizePx}px`;
  });
  size.dispatchEvent(new Event("input"));

  // drag – a teljes title-layer-t visszük, de a szöveget fogod
  let dragState = null;

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
}

/*****************************************************************
 * MINTA KATEGÓRIÁK – NYILAS ÖSSZECSUKÁS
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
 * MINTÁK – SAJÁT SVG FÁJLOKBÓL
 *****************************************************************/
function initPatterns() {
  // Mintagombok: a bennük lévő <img> src az igazi SVG útvonal
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

  // drag / resize indítása
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

  document.addEventListener("mousemove", onPatternMove);
  document.addEventListener("mouseup", onPatternUp);
}

/** SVG betöltése szövegként (ugyanarról a domainről) */
async function loadSvgAsText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Nem sikerült betölteni: ${url}`);
  }
  return await res.text();
}

/** Új minta létrehozása egy SVG szövegből */
function addPatternFromSvg(svgText) {
  const layer = document.getElementById("patterns-layer");
  const layerRect = layer.getBoundingClientRect();

  const el = document.createElement("div");
  el.className = "pattern";
  el.innerHTML = svgText;

  // resize fogantyú
  const handle = document.createElement("div");
  handle.className = "resize-handle";
  el.appendChild(handle);

  // alapméret
  const baseSize = 120;
  el.style.width  = baseSize + "px";
  el.style.height = baseSize + "px";

  // középre
  const left = (layerRect.width  - baseSize) / 2;
  const top  = (layerRect.height - baseSize) / 2;
  el.style.left = `${left}px`;
  el.style.top  = `${top}px`;

  layer.appendChild(el);

  // aktuális mintaszín rákényszerítése
  applyPatternColor(el, currentPatternColor);
  setActivePattern(el);
}

function setActivePattern(el) {
  activePattern = el;
  document.querySelectorAll(".pattern").forEach(p => p.classList.remove("active"));
  if (el) el.classList.add("active");
}

/**
 * Mintaszín alkalmazása az SVG-n belül.
 */
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

/* -------- DRAG -------- */

function startPatternDrag(e, pattern) {
  const layer = pattern.parentElement;
  const layerRect = layer.getBoundingClientRect();
  const rect = pattern.getBoundingClientRect();

  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;

  patternDrag = {
    pattern,
    layerRect,
    offsetX,
    offsetY
  };
}

/* -------- RESIZE -------- */

function startPatternResize(e, pattern) {
  const rect = pattern.getBoundingClientRect();
  patternResize = {
    pattern,
    startX: e.clientX,
    startY: e.clientY,
    startWidth: rect.width,
    startHeight: rect.height,
    aspect: rect.width / rect.height
  };
}

function onPatternMove(e) {
  // drag
  if (patternDrag) {
    const { pattern, layerRect, offsetX, offsetY } = patternDrag;

    let newLeft = e.clientX - layerRect.left - offsetX;
    let newTop  = e.clientY - layerRect.top  - offsetY;

    const maxLeft = layerRect.width  - pattern.offsetWidth;
    const maxTop  = layerRect.height - pattern.offsetHeight;

    newLeft = clamp(newLeft, 0, maxLeft);
    newTop  = clamp(newTop, 0, maxTop);

    pattern.style.left = `${newLeft}px`;
    pattern.style.top  = `${newTop}px`;
  }

  // resize
  if (patternResize) {
    const { pattern, startX, startY, startWidth, aspect } = patternResize;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
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

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
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

    // törlés – Delete / Backspace
    if ((e.key === "Delete" || e.key === "Backspace") && activePattern) {
      e.preventDefault();
      deleteActivePattern();
      return;
    }

    // Ctrl+C – másolás
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && activePattern) {
      e.preventDefault();
      copyActivePattern();
      return;
    }

    // Ctrl+V – beillesztés
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
 * PNG EXPORT – fa textúrával ÉS dobozszínnel együtt (canvas-baked)
 *****************************************************************/
function initExport() {
  const btn = document.getElementById("export-btn");
  const box = document.getElementById("box");

  btn.addEventListener("click", async () => {
    try {
      // 1) Aktív minta keretének elrejtése export idejére
      const prevActive = document.querySelector(".pattern.active");
      document.querySelectorAll(".pattern").forEach(p => p.classList.remove("active"));

      // 2) Render
      const canvas = await html2canvas(box, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false
      });

      // 3) Aktív minta vissza
      if (prevActive) prevActive.classList.add("active");

      // 4) Letöltés
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
