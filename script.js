
/*****************************************************************
 * EMLÉKDOBOZ TERVEZŐ – EXAKT SVG + SZÍNEZÉS + BŐVÍTETT FUNKCIÓK
 * - Felirat drag + sarkos fogantyúval méretezés (mobil + PC)
 * - Felirat magassága cm-ben kiírva (csak kijelzés, readonly)
 * - Minták: icons/*.svg fájlokból (valódi gyártási minták)
 * - Minták drag + resize (nem ugrik)
 * - Minták színe: palettáról állítható (fill/style felülírva)
 * - Doboz: fix natúr fa háttér (NEM színezhető)
 * - Minták törlése: gomb + Delete / Backspace
 * - Ctrl+C / Ctrl+V minta duplikálás
 * - Összecsukható mintakategóriák (nyilas header)
 * - PNG export: fogantyúk és aktív keretek NEM látszanak
 * - CSV export: felirat + minták méretei és színei, színnévvel
 * - TELJESEN MOBILKOMPATIBILIS (touch + mouse)
 *****************************************************************/

const COLORS = [
  "#e6e3dd", "#6e849b", "#0f94a0", "#0f4e8a",
  "#232324", "#7b5a48", "#c6b49a", "#72653b",
  "#9aad8d", "#3b6f3f", "#76b46a", "#c8a229",
  "#c57e86", "#8e6db3"
];

/* Színnevek CSV-hez (hex → név) */
const COLOR_NAMES = {
  "#e6e3dd": "Natúr fehér",
  "#6e849b": "Kék-szürke",
  "#0f94a0": "Türkiz kék",
  "#0f4e8a": "Antik kék",
  "#232324": "Natúr fekete",
  "#7b5a48": "Gesztenyebarna",
  "#c6b49a": "Homok barna",
  "#72653b": "Olívazöld",
  "#9aad8d": "Vintage zöld",
  "#3b6f3f": "Katonazöld",
  "#76b46a": "Zöldalma",
  "#c8a229": "Mustársárga",
  "#c57e86": "Antik rózsaszín",
  "#8e6db3": "Levendula"
};

const MIN_PATTERN = 80;
const MAX_PATTERN = 300;

/* Aktuális színek */
let currentTitleColor   = COLORS[4]; // felirat
let currentPatternColor = COLORS[5]; // minták

/* Minták állapota */
let activePattern    = null;
let patternDrag      = null;
let patternResize    = null;
let clipboardPattern = null;

/* Felirat állapota (drag + resize) */
let titleDrag   = null;
let titleResize = null;

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
  initPalettes();
  initTitle();
  initPatternCategories();
  initPatterns();
  initShortcuts();
  initExport();
  initCsvExport();
});

/*****************************************************************
 * SZÍNPALETTÁK
 *****************************************************************/
function initPalettes() {
  const titlePal   = document.getElementById("title-palette");
  const patternPal = document.getElementById("pattern-palette");

  COLORS.forEach((color) => {
    // felirat
    const t = makeSwatch(color, () => {
      currentTitleColor = color;
      const tText = document.getElementById("title-text");
      if (tText) tText.style.color = color;
    });
    titlePal.appendChild(t);

    // minták
    const p = makeSwatch(color, () => {
      currentPatternColor = color;
      if (activePattern) applyPatternColor(activePattern, color);
    });
    patternPal.appendChild(p);
  });

  // alap feliratszín
  const titleText = document.getElementById("title-text");
  if (titleText) {
    titleText.style.color = currentTitleColor;
  }
}

function makeSwatch(color, onClick) {
  const div = document.createElement("div");
  div.className = "color-swatch";
  div.style.backgroundColor = color;
  div.addEventListener("click", onClick);
  return div;
}

/*****************************************************************
 * FELIRAT – SZÖVEG, DRAG, SARKOS MÉRETEZÉS
 *****************************************************************/
function initTitle() {
  const input     = document.getElementById("title-input");
  const titleText = document.getElementById("title-text");
  const titleBox  = document.getElementById("title-box");
  const sizeInput = document.getElementById("title-size");

  if (!input || !titleText || !titleBox) return;

  // szöveg
  input.addEventListener("input", () => {
    titleText.textContent = input.value || "Felirat";
    updateTitleSizeInput();
  });

  // kezdeti középre igazítás px-ben
  centerTitleBox();

  // Drag – egér
  titleText.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    startTitleDrag(e, titleBox);
  });

  // Drag – touch
  titleText.addEventListener("touchstart", (e) => {
    e.preventDefault();
    startTitleDrag(e, titleBox);
  }, { passive: false });

  // Resize – egér
  const resizeHandle = titleBox.querySelector(".title-resize");
  if (resizeHandle) {
    resizeHandle.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      startTitleResize(e, titleBox);
    });

    // Resize – touch
    resizeHandle.addEventListener("touchstart", (e) => {
      e.preventDefault();
      e.stopPropagation();
      startTitleResize(e, titleBox);
    }, { passive: false });
  }

  // Mozgás – egér
  document.addEventListener("mousemove", (e) => {
    if (!titleDrag && !titleResize) return;
    onTitleMove(e);
  });

  // Mozgás – touch
  document.addEventListener("touchmove", (e) => {
    if (!titleDrag && !titleResize) return;
    onTitleMove(e);
    e.preventDefault();
  }, { passive: false });

  // Felengedés
  document.addEventListener("mouseup", () => {
    if (!titleDrag && !titleResize) return;
    onTitleEnd();
  });
  document.addEventListener("touchend", () => {
    if (!titleDrag && !titleResize) return;
    onTitleEnd();
  });

  // első méret frissítés
  setTimeout(updateTitleSizeInput, 200);
}

/* Felirat középre igazítása */
function centerTitleBox() {
  const box = document.getElementById("box");
  const titleBox = document.getElementById("title-box");
  if (!box || !titleBox) return;

  const boxRect = box.getBoundingClientRect();
  const rect    = titleBox.getBoundingClientRect();

  const left = (boxRect.width  - rect.width)  / 2;
  const top  = (boxRect.height - rect.height) / 2;

  titleBox.style.left = `${left}px`;
  titleBox.style.top  = `${top}px`;
  titleBox.style.transform = "none";
}

/* Drag indítás feliraton */
function startTitleDrag(e, titleBox) {
  const pos     = getPointerPosition(e);
  const box     = document.getElementById("box");
  const boxRect = box.getBoundingClientRect();
  const rect    = titleBox.getBoundingClientRect();

  const offsetX = pos.x - rect.left;
  const offsetY = pos.y - rect.top;

  titleDrag = {
    boxRect,
    titleBox,
    offsetX,
    offsetY
  };
}

/* Resize indítás feliraton (font-size skálázás) */
function startTitleResize(e, titleBox) {
  const pos      = getPointerPosition(e);
  const rect     = titleBox.getBoundingClientRect();
  const titleText = document.getElementById("title-text");
  const startFontSize = parseFloat(window.getComputedStyle(titleText).fontSize) || 64;

  titleResize = {
    startX: pos.x,
    startY: pos.y,
    startWidth: rect.width,
    startFontSize,
    titleText
  };
}

function onTitleMove(e) {
  const pos = getPointerPosition(e);

  // Drag
  if (titleDrag) {
    const { boxRect, titleBox, offsetX, offsetY } = titleDrag;

    const rect = titleBox.getBoundingClientRect();
    let newLeft = pos.x - boxRect.left - offsetX;
    let newTop  = pos.y - boxRect.top  - offsetY;

    const maxLeft = boxRect.width  - rect.width;
    const maxTop  = boxRect.height - rect.height;

    newLeft = clamp(newLeft, 0, maxLeft);
    newTop  = clamp(newTop, 0, maxTop);

    titleBox.style.left = `${newLeft}px`;
    titleBox.style.top  = `${newTop}px`;
  }

  // Resize
  if (titleResize) {
    const { startX, startWidth, startFontSize, titleText } = titleResize;
    const dx     = pos.x - startX;
    const factor = (startWidth + dx) / startWidth;
    const scale  = Math.max(0.3, factor);

    const newFont = clamp(startFontSize * scale, 10, 200);
    titleText.style.fontSize = `${newFont}px`;

    updateTitleSizeInput();
  }
}

function onTitleEnd() {
  titleDrag = null;
  titleResize = null;
  updateTitleSizeInput();
}

/* Felirat magasság cm-ben (csak kijelzés + CSV) */
function updateTitleSizeInput() {
  const sizeInput = document.getElementById("title-size");
  const box       = document.getElementById("box");
  const titleBox  = document.getElementById("title-box");
  if (!sizeInput || !box || !titleBox) return;

  const boxRect   = box.getBoundingClientRect();
  const titleRect = titleBox.getBoundingClientRect();

  const BOX_CM_HEIGHT = 22.5; // 225 mm

  const hCm = (titleRect.height / boxRect.height) * BOX_CM_HEIGHT;
  sizeInput.value = hCm.toFixed(1);
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
 * MINTÁK – SAJÁT SVG FÁJLOKBÓL (PC + MOBIL DRAG/RESIZE)
 *****************************************************************/
function initPatterns() {
  // Mintagombok: a bennük lévő <img> src az igazi SVG útvonal
  document.querySelectorAll(".pattern-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const img = btn.querySelector("img");
      if (!img) return;

      try {
        const src = img.getAttribute("src");
        const alt = img.getAttribute("alt") || "";
        const svgText = await loadSvgAsText(src);
        addPatternFromSvg(svgText, { src, alt });
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

  // PC: drag / resize indítása
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

  // MOBIL: drag / resize indítása
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

  // Mozgatás – mindkét inputtípus
  document.addEventListener("mousemove", onPatternMove);
  document.addEventListener("touchmove", (e) => {
    onPatternMove(e);
    if (patternDrag || patternResize) {
      e.preventDefault();
    }
  }, { passive: false });

  // Felengedés – mindkét inputtípus
  document.addEventListener("mouseup", onPatternUp);
  document.addEventListener("touchend", onPatternUp);
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
function addPatternFromSvg(svgText, meta = {}) {
  const layer = document.getElementById("patterns-layer");
  const layerRect = layer.getBoundingClientRect();

  const el = document.createElement("div");
  el.className = "pattern";
  el.innerHTML = svgText;

  // meta adatok CSV-hez
  el.dataset.src = meta.src || "";
  el.dataset.alt = meta.alt || "";

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
 * Mintaszín alkalmazása az SVG-n belül + dataset.color beállítása.
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

  patternEl.dataset.color = color;
}

/* -------- DRAG (EGYBEN PC + MOBILRA) -------- */

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

/* -------- RESIZE (EGYBEN PC + MOBILRA) -------- */

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

  // drag
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

  // resize
  if (patternResize) {
    const { pattern, startX, startWidth, aspect } = patternResize;
    const dx = pos.x - startX;
    const delta = Math.max(dx, 0); // csak növelés, ha akarod bidirekciósat, vedd ki ezt

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
    height: activePattern.offsetHeight,
    alt: activePattern.dataset.alt || "",
    src: activePattern.dataset.src || "",
    color: activePattern.dataset.color || ""
  };
}

function pastePattern() {
  if (!clipboardPattern) return;
  const layer = document.getElementById("patterns-layer");
  const layerRect = layer.getBoundingClientRect();

  const el = document.createElement("div");
  el.className = "pattern";
  el.innerHTML = clipboardPattern.svg;

  el.dataset.alt = clipboardPattern.alt || "";
  el.dataset.src = clipboardPattern.src || "";

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

  if (clipboardPattern.color) {
    applyPatternColor(el, clipboardPattern.color);
  } else {
    applyPatternColor(el, currentPatternColor);
  }

  setActivePattern(el);
}

/*****************************************************************
 * PNG EXPORT – natúr fa háttérrel együtt
 *****************************************************************/
function initExport() {
  const btn = document.getElementById("export-btn");
  const box = document.getElementById("box");
  if (!btn || !box) return;

  btn.addEventListener("click", async () => {
    let prevActive = document.querySelector(".pattern.active");

    // Aktív minta keretének elrejtése export idejére
    document.querySelectorAll(".pattern").forEach(p => p.classList.remove("active"));
    document.body.classList.add("exporting");

    try {
      const canvas = await html2canvas(box, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false
      });

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = "emlekdoboz_terv.png";
      link.click();
    } catch (err) {
      console.error("Export hiba:", err);
      alert("Hiba történt a PNG export során.");
    } finally {
      document.body.classList.remove("exporting");
      if (prevActive) prevActive.classList.add("active");
    }
  });
}

/*****************************************************************
 * CSV EXPORT – felirat + minták méretei, színei
 *****************************************************************/
function initCsvExport() {
  const btn = document.getElementById("export-csv-btn");
  const box = document.getElementById("box");
  if (!btn || !box) return;

  btn.addEventListener("click", () => {
    const boxRect = box.getBoundingClientRect();

    const BOX_CM_WIDTH  = 31.0; // 310 mm
    const BOX_CM_HEIGHT = 22.5; // 225 mm

    const pxToCmW = BOX_CM_WIDTH  / boxRect.width;
    const pxToCmH = BOX_CM_HEIGHT / boxRect.height;

    const rows = [];
    rows.push("Típus;Név;Szélesség (cm);Magasság (cm);Szín (hex);Szín (név)");

    // Felirat
    const titleBox  = document.getElementById("title-box");
    const titleRect = titleBox.getBoundingClientRect();
    const titleInput = document.getElementById("title-input");

    const titleWcm = (titleRect.width  * pxToCmW).toFixed(2);
    const titleHcm = (titleRect.height * pxToCmH).toFixed(2);

    const titleHex = normalizeHex(currentTitleColor);
    const titleName = colorNameFromHex(titleHex);

    rows.push([
      "Felirat",
      csvEscape(titleInput.value || "Felirat"),
      titleWcm.replace(".", ","),
      titleHcm.replace(".", ","),
      titleHex,
      titleName
    ].join(";"));

    // Minták
    const patterns = document.querySelectorAll("#patterns-layer .pattern");
    patterns.forEach((patternEl, idx) => {
      const rect = patternEl.getBoundingClientRect();
      const wCm  = (rect.width  * pxToCmW).toFixed(2);
      const hCm  = (rect.height * pxToCmH).toFixed(2);

      const hexRaw = patternEl.dataset.color || currentPatternColor;
      const hex    = normalizeHex(hexRaw);
      const name   = colorNameFromHex(hex);

      const label  = patternEl.dataset.alt || `Minta ${idx + 1}`;

      rows.push([
        "Minta",
        csvEscape(label),
        wCm.replace(".", ","),
        hCm.replace(".", ","),
        hex,
        name
      ].join(";"));
    });

    const csvContent = rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "emlekdoboz_meretek.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });
}

/* Segédfüggvények CSV-hez */

function normalizeHex(hex) {
  if (!hex) return "";
  let h = String(hex).trim();
  if (!h.startsWith("#")) return h.toLowerCase();
  return h.toLowerCase();
}

function colorNameFromHex(hex) {
  hex = normalizeHex(hex);
  return COLOR_NAMES[hex] || hex;
}

function csvEscape(text) {
  const t = String(text || "");
  if (t.includes(";") || t.includes('"')) {
    return '"' + t.replace(/"/g, '""') + '"';
  }
  return t;
}
