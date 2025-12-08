/*****************************************************************
 * EMLÉKDOBOZ TERVEZŐ – GRAVÍR-READY VERZIÓ
 * - Felirat drag + resize (valós 3–7 cm)
 * - Minták: csak „Ünnepek” kategória (icons/Unnepek/)
 * - SVG betöltés, drag, resize, színezés
 * - PNG export (fogantyú nélkül)
 * - CSV export (méretek + színek)
 * - Mobil + PC kompatibilis
 * - Gravír mód előkészítve (maszk + textúraréteg – kommentelve jelölve)
 *****************************************************************/

/* ---------------------- KATEGÓRIÁK -------------------------- */

const ICON_CATEGORIES = [
  {
    id: "unnepek",
    label: "Ünnepek",
    folder: "icons/Unnepek",
    icons: [
      "halloween_tok.svg",
      "husvet_nyuszi.svg",
      "husvet_repa.svg",
      "husvet_tojas.svg",
      "husvet_tojas2.svg",
      "kar_hoember.svg",
      "karacsony_csaladozike.svg",
      "karacsony_diotoro1.svg",
      "karacsony_diotoro2.svg",
      "karacsony_fagyongy.svg",
      "karacsony_kacsak.svg",
      "karacsony_maci.svg",
      "karacsony_mokus.svg",
      "karacsony_nyaloka.svg",
      "karacsony_nyuszi.svg",
      "karacsony_ozike.svg",
      "karacsony_ozikepar.svg",
      "karacsony_roka.svg",
      "karacsony_roka2.svg",
      "karacsony_szan.svg"
    ]
  }
];

/* ---------------------- SZÍNEK -------------------------- */

const COLORS = [
  "#e6e3dd", "#6e849b", "#0f94a0", "#0f4e8a",
  "#232324", "#7b5a48", "#c6b49a", "#72653b",
  "#9aad8d", "#3b6f3f", "#76b46a", "#c8a229",
  "#c57e86", "#8e6db3"
];

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

let currentTitleColor   = COLORS[4];
let currentPatternColor = COLORS[5];

/* ---------------------- MINTA LIMIT -------------------------- */

const MIN_PATTERN = 80;
const MAX_PATTERN = 300;

/* ---------------------- Általános állapot -------------------------- */

let activePattern    = null;
let patternDrag      = null;
let patternResize    = null;
let clipboardPattern = null;

let titleDrag        = null;
let titleResize      = null;

/*****************************************************************
 * POINTER KEZELÉS
 *****************************************************************/
function getPointer(e) {
  if (e.touches && e.touches.length) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

/*****************************************************************
 * INIT
 *****************************************************************/
document.addEventListener("DOMContentLoaded", () => {
  initPalettes();
  initTitle();
  initPatternSidebar();
  initPatterns();
  initShortcuts();
  initExport();
  initCsvExport();
});

/*****************************************************************
 * SZÍNPALETTÁK INIT
 *****************************************************************/
function initPalettes() {
  const tp = document.getElementById("title-palette");
  const pp = document.getElementById("pattern-palette");

  COLORS.forEach(c => {

    // Felirat
    const t = makeSwatch(c, () => {
      currentTitleColor = c;
      document.getElementById("title-text").style.color = c;
    });
    tp.appendChild(t);

    // Minták
    const p = makeSwatch(c, () => {
      currentPatternColor = c;
      if (activePattern) applyPatternColor(activePattern, c);
    });
    pp.appendChild(p);

  });

  document.getElementById("title-text").style.color = currentTitleColor;
}

function makeSwatch(color, cb) {
  const d = document.createElement("div");
  d.className = "color-swatch";
  d.style.backgroundColor = color;
  d.onclick = cb;
  return d;
}

/*****************************************************************
 * FELIRAT INIT
 *****************************************************************/
function initTitle() {
  const input = document.getElementById("title-input");
  const titleText = document.getElementById("title-text");

  input.value = "Felirat";
  titleText.textContent = "Felirat";

  input.addEventListener("input", () => {
    titleText.textContent = input.value || "Felirat";
    updateTitleSize();
  });

  // Induló beállítás
  requestAnimationFrame(() => {
    setTitleHeightCm(4);
    updateTitleSize();
  });

  // Drag
  titleText.addEventListener("mousedown", (e) => startTitleDrag(e));
  titleText.addEventListener("touchstart", (e) => startTitleDrag(e), { passive: false });

  // Resize
  document.querySelector("#title-box .resize-handle")
    .addEventListener("mousedown", (e) => startTitleResize(e));
  document.querySelector("#title-box .resize-handle")
    .addEventListener("touchstart", (e) => startTitleResize(e), { passive: false });

  // Mozgatás
  document.addEventListener("mousemove", (e) => onTitleMove(e));
  document.addEventListener("touchmove", (e) => { onTitleMove(e); e.preventDefault(); }, { passive: false });

  // Felengedés
  document.addEventListener("mouseup", endTitleMove);
  document.addEventListener("touchend", endTitleMove);
}

/*****************************************************************
 * FELIRAT DRAG / RESIZE
 *****************************************************************/
function startTitleDrag(e) {
  const pos = getPointer(e);
  const box = document.getElementById("box");
  const titleBox = document.getElementById("title-box");
  const r = titleBox.getBoundingClientRect();
  const b = box.getBoundingClientRect();

  titleDrag = {
    offsetX: pos.x - r.left,
    offsetY: pos.y - r.top,
    boxRect: b,
    el: titleBox
  };
}

function startTitleResize(e) {
  const pos = getPointer(e);
  const titleText = document.getElementById("title-text");
  const box = document.getElementById("title-box");
  const r = box.getBoundingClientRect();

  titleResize = {
    startX: pos.x,
    startWidth: r.width,
    startFont: parseFloat(getComputedStyle(titleText).fontSize),
    titleText
  };
}

function onTitleMove(e) {
  const pos = getPointer(e);

  // Drag
  if (titleDrag) {
    const t = titleDrag;
    const newL = pos.x - t.boxRect.left - t.offsetX;
    const newT = pos.y - t.boxRect.top - t.offsetY;

    t.el.style.left = clamp(newL, 0, t.boxRect.width - t.el.offsetWidth) + "px";
    t.el.style.top  = clamp(newT, 0, t.boxRect.height - t.el.offsetHeight) + "px";
  }

  // Resize
  if (titleResize) {
    const r = titleResize;
    const dx = pos.x - r.startX;
    const factor = clamp((r.startWidth + dx) / r.startWidth, 0.3, 3);
    r.titleText.style.fontSize = (r.startFont * factor) + "px";
    updateTitleSize();
  }
}

function endTitleMove() {
  titleDrag = null;
  titleResize = null;
}

function updateTitleSize() {
  const box = document.getElementById("box").getBoundingClientRect();
  const t = document.getElementById("title-box").getBoundingClientRect();

  const cmH = 22.5;
  document.getElementById("title-size").value =
    ((t.height / box.height) * cmH).toFixed(1);
}

function setTitleHeightCm(cm) {
  const box = document.getElementById("box").getBoundingClientRect();
  const t = document.getElementById("title-text");
  const cmH = 22.5;
  const pxPerCm = box.height / cmH;

  const desiredPx = cm * pxPerCm;

  t.style.fontSize = (desiredPx / 1.2) + "px";
}

/*****************************************************************
 * OLDALSÁV – CSAK ÜNNEPEK
 *****************************************************************/
function initPatternSidebar() {
  document.querySelectorAll(".pattern-category").forEach(cat => {
    cat.classList.add("collapsed");
    const h = cat.querySelector(".pattern-category-header");
    h.onclick = () => cat.classList.toggle("collapsed");
  });
}

/*****************************************************************
 * MINTÁK BETÖLTÉSE
 *****************************************************************/
function initPatterns() {
  document.querySelectorAll(".pattern-btn").forEach(btn => {
    btn.addEventListener("click", async () => {

      const img = btn.querySelector("img");
      const src = img.getAttribute("src");
      const alt = img.getAttribute("alt") || "";

      try {
        const svg = await loadSvg(src);
        addPattern(svg, src, alt);
      } catch (e) {
        alert("Hiba az SVG betöltésében: " + src);
      }

    });
  });

  // Közös drag / resize listener
  const layer = document.getElementById("patterns-layer");

  layer.addEventListener("mousedown", e => {
    const p = e.target.closest(".pattern");
    if (!p) return;
    setActivePattern(p);
    if (e.target.classList.contains("resize-handle")) startPatternResize(e, p);
    else startPatternDrag(e, p);
  });

  layer.addEventListener("touchstart", e => {
    const p = e.target.closest(".pattern");
    if (!p) return;
    setActivePattern(p);
    if (e.target.classList.contains("resize-handle")) startPatternResize(e, p);
    else startPatternDrag(e, p);
  }, { passive: false });

  document.addEventListener("mousemove", onPatternMove);
  document.addEventListener("touchmove", e => { onPatternMove(e); e.preventDefault(); }, { passive: false });
  document.addEventListener("mouseup", endPatternMove);
  document.addEventListener("touchend", endPatternMove);
}

async function loadSvg(url) {
  const r = await fetch(url);
  return await r.text();
}

/*****************************************************************
 * ÚJ MINTA LÉTREHOZÁSA
 *****************************************************************/
function addPattern(svgText, src, alt) {
  const layer = document.getElementById("patterns-layer");
  const box = document.getElementById("box");

  const el = document.createElement("div");
  el.className = "pattern";
  el.innerHTML = svgText;
  el.dataset.src = src;
  el.dataset.alt = alt;

  // SVG arány
  const svg = el.querySelector("svg");
  let aspect = 1;
  if (svg && svg.viewBox && svg.viewBox.baseVal.height !== 0) {
    const vb = svg.viewBox.baseVal;
    aspect = vb.width / vb.height;
  }

  const br = box.getBoundingClientRect();
  const pxPerCm = br.height / 22.5;
  const h = 4 * pxPerCm;

  el.style.height = h + "px";
  el.style.width = (h * aspect) + "px";

  el.style.left = (br.width - h * aspect) / 2 + "px";
  el.style.top = (br.height - h) / 2 + "px";

  // Resize fogantyú
  const handle = document.createElement("div");
  handle.className = "resize-handle";
  el.appendChild(handle);

  layer.appendChild(el);

  applyPatternColor(el, currentPatternColor);
  setActivePattern(el);
}

/*****************************************************************
 * MINTA SZÍNEZÉSE
 *****************************************************************/
function applyPatternColor(pattern, color) {
  const svg = pattern.querySelector("svg");
  if (!svg) return;

  svg.querySelectorAll("path,rect,circle,ellipse,polygon,polyline").forEach(n => {
    if (n.getAttribute("fill") !== "none") n.setAttribute("fill", color);
    if (n.getAttribute("stroke")) n.setAttribute("stroke", color);
  });

  pattern.dataset.color = color;
}

/*****************************************************************
 * MINTA DRAG / RESIZE
 *****************************************************************/
function startPatternDrag(e, el) {
  const pos = getPointer(e);
  const r = el.getBoundingClientRect();
  const layer = el.parentElement.getBoundingClientRect();

  patternDrag = {
    el,
    offsetX: pos.x - r.left,
    offsetY: pos.y - r.top,
    layerRect: layer
  };
}

function startPatternResize(e, el) {
  const pos = getPointer(e);
  const r = el.getBoundingClientRect();
  patternResize = {
    el,
    startX: pos.x,
    startWidth: r.width,
    aspect: r.width / r.height
  };
}

function onPatternMove(e) {
  const pos = getPointer(e);

  if (patternDrag) {
    const p = patternDrag;
    let L = pos.x - p.layerRect.left - p.offsetX;
    let T = pos.y - p.layerRect.top - p.offsetY;

    L = clamp(L, 0, p.layerRect.width - p.el.offsetWidth);
    T = clamp(T, 0, p.layerRect.height - p.el.offsetHeight);

    p.el.style.left = L + "px";
    p.el.style.top  = T + "px";
  }

  if (patternResize) {
    const r = patternResize;
    let w = r.startWidth + (pos.x - r.startX);
    w = clamp(w, MIN_PATTERN, MAX_PATTERN);
    r.el.style.width = w + "px";
    r.el.style.height = (w / r.aspect) + "px";
  }
}

function endPatternMove() {
  patternDrag = null;
  patternResize = null;
}

function setActivePattern(el) {
  document.querySelectorAll(".pattern").forEach(p => p.classList.remove("active"));
  el.classList.add("active");
  activePattern = el;
}

/*****************************************************************
 * TÖRLÉS / MÁSOLÁS / BEILLESZTÉS
 *****************************************************************/
function initShortcuts() {
  document.getElementById("delete-pattern-btn").onclick = () => deletePattern();

  document.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT") return;

    if (e.key === "Delete" && activePattern) deletePattern();

    if (e.ctrlKey && e.key === "c" && activePattern) copyPattern();
    if (e.ctrlKey && e.key === "v" && clipboardPattern) pastePattern();
  });
}

function deletePattern() {
  if (!activePattern) return;
  activePattern.remove();
  activePattern = null;
}

function copyPattern() {
  const svg = activePattern.querySelector("svg");
  clipboardPattern = {
    svg: svg.outerHTML,
    w: activePattern.offsetWidth,
    h: activePattern.offsetHeight,
    color: activePattern.dataset.color,
    alt: activePattern.dataset.alt
  };
}

function pastePattern() {
  const layer = document.getElementById("patterns-layer");
  const box = document.getElementById("box").getBoundingClientRect();

  const el = document.createElement("div");
  el.className = "pattern";
  el.innerHTML = clipboardPattern.svg;
  el.style.width = clipboardPattern.w + "px";
  el.style.height = clipboardPattern.h + "px";

  el.style.left = (box.width / 2 - clipboardPattern.w / 2) + "px";
  el.style.top  = (box.height / 2 - clipboardPattern.h / 2) + "px";

  const h = document.createElement("div");
  h.className = "resize-handle";
  el.appendChild(h);

  layer.appendChild(el);
  applyPatternColor(el, clipboardPattern.color);
  setActivePattern(el);
}

/*****************************************************************
 * PNG EXPORT
 *****************************************************************/
function initExport() {
  const btn = document.getElementById("export-btn");
  const box = document.getElementById("box");

  btn.onclick = async () => {
    document.querySelectorAll(".pattern").forEach(p => p.classList.remove("active"));
    document.body.classList.add("exporting");

    const canvas = await html2canvas(box, {
      scale: 2,
      backgroundColor: null
    });

    const a = document.createElement("a");
    a.download = "emlekdoboz.png";
    a.href = canvas.toDataURL();
    a.click();

    document.body.classList.remove("exporting");
  };
}

/*****************************************************************
 * CSV EXPORT
 *****************************************************************/
function initCsvExport() {
  const btn = document.getElementById("export-csv-btn");

  btn.onclick = () => {
    const rows = [];
    rows.push("Típus;Név;Szélesség(cm);Magasság(cm);Szín(hex);Szín(név)");

    const box = document.getElementById("box").getBoundingClientRect();
    const cmW = 31;
    const cmH = 22.5;

    const pxToCmW = cmW / box.width;
    const pxToCmH = cmH / box.height;

    // Felirat
    const t = document.getElementById("title-box").getBoundingClientRect();
    const name = document.getElementById("title-input").value;

    rows.push([
      "Felirat",
      name,
      (t.width * pxToCmW).toFixed(2),
      (t.height * pxToCmH).toFixed(2),
      currentTitleColor,
      COLOR_NAMES[currentTitleColor]
    ].join(";"));

    // Minták
    document.querySelectorAll(".pattern").forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const col = el.dataset.color;

      rows.push([
        "Minta",
        el.dataset.alt || ("Minta " + (i + 1)),
        (r.width * pxToCmW).toFixed(2),
        (r.height * pxToCmH).toFixed(2),
        col,
        COLOR_NAMES[col]
      ].join(";"));
    });

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "emlekdoboz_meretek.csv";
    a.click();
  };
}

/*****************************************************************
 * GRAVÍR MÓD HELYE (MASZK + TEXTÚRA)
 *****************************************************************
 * Itt fogjuk beépíteni a 3 gravír textúrát:
 *
 * 1) pattern->SVG → mask
 * 2) mögé → gravír texture (finom / közepes / erős)
 * 3) overlay blending
 *
 * NINCS még aktiválva — először a textúrákat generáljuk.
 *****************************************************************/
