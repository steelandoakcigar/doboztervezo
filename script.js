/*****************************************************************
 * EMLÉKDOBOZ TERVEZŐ – V3
 * - 3–7 cm feliratmagasság
 * - Felirat drag & drop (szöveg fogható)
 * - Minták: saját SVG fájlokból, drag + resize
 * - PintyPlus színpaletták (felirat + minta + doboz árnyalat)
 * - PNG export (html2canvas, 2×)
 *****************************************************************/

const COLORS = [
  "#e6e3dd", "#6e849b", "#0f94a0", "#0f4e8a",
  "#232324", "#7b5a48", "#c6b49a", "#72653b",
  "#9aad8d", "#3b6f3f", "#76b46a", "#c8a229",
  "#c57e86", "#8e6db3"
];

const MIN_PATTERN = 80;
const MAX_PATTERN = 300;

let currentTitleColor   = COLORS[4];
let currentPatternColor = COLORS[5];
let currentBoxTint      = null;

let activePattern = null;
let patternDrag   = null;
let patternResize = null;

/*****************************************************************
 * INIT
 *****************************************************************/
document.addEventListener("DOMContentLoaded", () => {
  initPalettes();
  initTitle();
  initPatterns();
  initExport();
});

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

    // doboz
    const b = makeSwatch(color, () => {
      currentBoxTint = color;
      document.getElementById("box-tint-layer").style.background = hexToRgba(color, 0.45);
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

  // magasság 3–7 cm
  size.addEventListener("input", () => {
    let cm = parseFloat(size.value);
    if (isNaN(cm)) cm = 4;
    if (cm < 3) cm = 3;
    if (cm > 7) cm = 7;
    size.value = cm;

    const BOX_CM_HEIGHT = 22.5;                  // 225 mm = 22,5 cm
    const box = document.getElementById("box");
    const boxPxHeight = box.getBoundingClientRect().height;

    const pxPerCm = boxPxHeight / BOX_CM_HEIGHT;
    const desiredPx = cm * pxPerCm;

    const FONT_CAP_RATIO = 0.7;
    const fontSizePx = desiredPx / FONT_CAP_RATIO;

    text.style.fontSize = `${fontSizePx}px`;
  });
  size.dispatchEvent(new Event("input"));

  // drag – csak a szöveg fogható
  let dragState = null;

  text.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();

    const matrix = new DOMMatrix(getComputedStyle(layer).transform);
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
 * MINTÁK – SAJÁT SVG-K, DRAG, RESIZE
 *****************************************************************/
function initPatterns() {
  // Gombok: a bennük lévő <img> src-jét használjuk
  document.querySelectorAll(".pattern-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const img = btn.querySelector("img");
      if (!img) return;

      try {
        const svgText = await loadSvgAsText(img.src);
        addPatternFromSvg(svgText);
      } catch (err) {
        console.error("SVG betöltési hiba:", err);
        alert("Nem sikerült betölteni a minta SVG-t. Futtasd a projektet helyi szerverről (http://localhost...), ne közvetlenül fájlból.");
      }
    });
  });

  const layer = document.getElementById("patterns-layer");

  // Egyetlen mousedown handler – vagy drag, vagy resize indul
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

/**
 * SVG fájl betöltése szövegként.
 * FONTOS: file:// alatt a fetch sokszor hibára fut – ezért kell a http://localhost szerver.
 */
async function loadSvgAsText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Nem sikerült betölteni: ${url}`);
  }
  return await res.text();
}

/**
 * Új minta létrehozása egy SVG szövegből.
 */
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

  // aktuális mintaszín
  applyPatternColor(el, currentPatternColor);
  setActivePattern(el);
}

function setActivePattern(el) {
  activePattern = el;
  document.querySelectorAll(".pattern").forEach(p => p.classList.remove("active"));
  if (el) el.classList.add("active");
}

/**
 * Kitöltésszín cseréje az SVG-n belül.
 */
function applyPatternColor(patternEl, color) {
  const svg = patternEl.querySelector("svg");
  if (!svg) return;

  // 1) minden rajzelemre ráírjuk a fill-t
  const targets = svg.querySelectorAll(
    "path, rect, circle, ellipse, polygon, polyline"
  );

  targets.forEach(el => {
    if (el.getAttribute("fill") !== "none") {
      el.setAttribute("fill", color);   // attribútum
      el.style.fill = color;            // inline style – erősebb, mint a class
    }
  });

  // 2) ha van <style> blokk, abban is cseréljük a fill színeket (pl. .cls-1{fill:#xxxxxx})
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

  // hogy ne ugorjon: eltároljuk, hol fogtad meg a mintát
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
 * PNG EXPORT
 *****************************************************************/
function initExport() {
  const btn = document.getElementById("export-btn");
  const box = document.getElementById("box");

  btn.addEventListener("click", async () => {
    try {
      const canvas = await html2canvas(box, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false
      });

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = "emlekdoboz.png";
      link.click();
    } catch (err) {
      console.error("Export hiba:", err);
      alert(
        "Hiba történt a PNG export során.\n" +
        "Nagyon gyakran ez azért van, mert a fájlt közvetlenül megnyitod (file://...). " +
        "Indíts egy egyszerű helyi webszervert, és onnan nyisd meg (http://localhost/...)."
      );
    }
  });
}
