
// --- Alap konstansek -------------------------------------------------

const CM_MIN = 2.5;
const CM_MAX = 7;
const PX_PER_CM = 37.8; // kb. 96 DPI-n

// A4 arány – a vászon közepén
const canvas = document.getElementById("designCanvas");
const ctx = canvas.getContext("2d");

// Belső doboz (A4) margóval
const BOX = {
  x: 100,
  y: 70,
  width: canvas.width - 200,
  height: canvas.height - 140,
};

// Pinty Plus Home színpaletta (becsült HEX-ek)
const COLORS = [
  { id: "01", name: "Natúr fehér", hex: "#e5e3dc" },
  { id: "02", name: "Kék-szürke", hex: "#6f7f98" },
  { id: "03", name: "Türkiz kék", hex: "#0f96a0" },
  { id: "04", name: "Antik kék", hex: "#004f8c" },
  { id: "05", name: "Natúr fekete", hex: "#111111" },
  { id: "06", name: "Gesztenyebarna", hex: "#7a5240" },
  { id: "07", name: "Homok barna", hex: "#c9b79a" },
  { id: "08", name: "Olívazöld", hex: "#7a774a" },
  { id: "09", name: "Vintage zöld", hex: "#97a892" },
  { id: "10", name: "Katonazöld", hex: "#3c6b3f" },
  { id: "11", name: "Zöldalma", hex: "#77b95a" },
  { id: "12", name: "Mustársárga", hex: "#cda434" },
  { id: "13", name: "Antik rózsaszín", hex: "#c38282" },
  { id: "14", name: "Levendula", hex: "#8a6fae" },
];

// --- Állapot ----------------------------------------------------------

const woodImage = new Image();
woodImage.src = "assets/textures/wood.png";

const iconSources = {
  star_1: "icons/star_1.svg",
  star_2: "icons/star_2.svg",
  cloud_1: "icons/cloud_1.svg",
  cloud_2: "icons/cloud_2.svg",
};

const iconImages = {};
let assetsLoaded = false;

const decorations = []; // {type, group, x, y, scale, color, tintedCanvas}

let title = {
  text: "Nándi kincsei",
  sizeCm: 4,
  x: BOX.x + BOX.width / 2,
  y: BOX.y + BOX.height * 0.18,
  color: "#111111",
};

let currentBoxColor = COLORS[0].hex;
let currentPatternColor = COLORS[6].hex; // pl. homok barna
let currentPatternGroup = "stars";

let dragState = null; // {type: 'title-move' | 'dec-move' | 'dec-resize', index, offsetX, offsetY}

// --- DOM elemek ------------------------------------------------------

const titleInput = document.getElementById("titleInput");
const titleSizeInput = document.getElementById("titleSize");
const titleSizeLabel = document.getElementById("titleSizeLabel");

const titleColorsContainer = document.getElementById("titleColors");
const patternColorsContainer = document.getElementById("patternColors");
const boxColorsContainer = document.getElementById("boxColors");

const patternPalette = document.getElementById("patternPalette");
const patternGroupSelect = document.getElementById("patternGroup");
const saveBtn = document.getElementById("saveBtn");

// --- Segédfüggvények -------------------------------------------------

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function createTintedCanvas(img, colorHex) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const cctx = c.getContext("2d");
  cctx.drawImage(img, 0, 0);

  const imgData = cctx.getImageData(0, 0, c.width, c.height);
  const data = imgData.data;
  const rgb = hexToRgb(colorHex);

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) continue;
    data[i] = rgb.r;
    data[i + 1] = rgb.g;
    data[i + 2] = rgb.b;
  }

  cctx.putImageData(imgData, 0, 0);
  return c;
}

function cmToPx(cm) {
  return cm * PX_PER_CM;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pointInRect(x, y, rect) {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}

// --- Szín gombok generálása -----------------------------------------

function createColorSwatches(container, onClick, initialHex) {
  container.innerHTML = "";
  COLORS.forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "color-swatch";
    btn.style.backgroundColor = c.hex;
    btn.dataset.hex = c.hex;
    btn.title = `${c.id}: ${c.name}`;
    if (c.hex === initialHex) btn.classList.add("active