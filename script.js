// ----------- ALAP BEÁLLÍTÁSOK -------------

const colors = ["#ffffff", "#e9d7b0", "#ffbcd1", "#000000"];

const textElement = document.getElementById("textElement");
const textInput   = document.getElementById("textInput");
const textSize    = document.getElementById("textSize");
const boardColorOverlay = document.getElementById("boardColorOverlay");
const designArea  = document.getElementById("designArea");
const groupSelect = document.getElementById("groupSelect");

// aktuális minta-színek
let starColor  = "#e9d7b0";
let cloudColor = "#e9d7b0";


// ----------- SZÍNVÁLASZTÓK FELTÖLTÉSE -------------

function fillColorRow(id, onPick) {
    const row = document.getElementById(id);
    row.innerHTML = "";
    colors.forEach(col => {
        const swatch = document.createElement("div");
        swatch.style.background = col;
        swatch.addEventListener("click", () => onPick(col));
        row.appendChild(swatch);
    });
}

// felirat színek
fillColorRow("textColors", col => {
    textElement.style.color = col;
});

// doboz színek
fillColorRow("boardColors", col => {
    boardColorOverlay.style.background = col;
});

// minták színek – csoportosan
fillColorRow("patternColors", col => {
    const group = groupSelect.value;
    if (group === "stars") {
        starColor = col;
    } else {
        cloudColor = col;
    }
    recolorPatterns();
});


// ----------- FELIRAT KEZELÉS -------------

textInput.addEventListener("input", e => {
    textElement.textContent = e.target.value || "Felirat";
});

textSize.addEventListener("input", e => {
    const cm = parseFloat(e.target.value);
    textElement.style.fontSize = cm + "cm";
});

// kezdeti érték
textInput.value = "Nándi kincsei";
textInput.dispatchEvent(new Event("input"));


// ----------- DRAGGELHETŐ ELEMEK (FELIRAT + MINTÁK) -------------

function makeDraggable(el) {
    el.addEventListener("mousedown", e => {
        e.preventDefault();
        let startX = e.clientX;
        let startY = e.clientY;
        const rect = el.getBoundingClientRect();
        const parentRect = designArea.getBoundingClientRect();
        let offsetX = rect.left - parentRect.left;
        let offsetY = rect.top - parentRect.top;

        function onMove(ev) {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            el.style.left = (offsetX + dx) + "px";
            el.style.top  = (offsetY + dy) + "px";
        }

        function onUp() {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        }

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    });
}

makeDraggable(textElement);


// ----------- MINTÁK DRAG & DROP -------------

// ikonról induló drag
document.querySelectorAll(".icon").forEach(icon => {
    icon.addEventListener("dragstart", e => {
        e.dataTransfer.setData("src", e.target.src);
    });
});

// dobozra húzás
designArea.addEventListener("dragover", e => e.preventDefault());

designArea.addEventListener("drop", e => {
    e.preventDefault();
    const src = e.dataTransfer.getData("src");
    if (!src) return;

    const isStar  = src.includes("star");
    const isCloud = src.includes("cloud");

    const item = document.createElement("div");
    item.classList.add("pattern-item");
    if (isStar)  item.classList.add("star");
    if (isCloud) item.classList.add("cloud");

    // maszk beállítása
    item.style.webkitMaskImage = `url(${src})`;
    item.style.maskImage       = `url(${src})`;

    // kezdő szín
    item.style.backgroundColor = isStar ? starColor : cloudColor;

    // hely a drop pontján
    const areaRect = designArea.getBoundingClientRect();
    item.style.left = (e.clientX - areaRect.left - 40) + "px";
    item.style.top  = (e.clientY - areaRect.top  - 40) + "px";

    makeDraggable(item);
    designArea.appendChild(item);
});


// minta-színek frissítése, ha változik a paletta
function recolorPatterns() {
    document.querySelectorAll(".pattern-item.star").forEach(el => {
        el.style.backgroundColor = starColor;
    });
    document.querySelectorAll(".pattern-item.cloud").forEach(el => {
        el.style.backgroundColor = cloudColor;
    });
}


// ----------- PNG MENTÉS -------------

// html2canvas kell hozzá – CDN-ről:
const script = document.createElement("script");
script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
document.head.appendChild(script);

document.getElementById("saveBtn").addEventListener("click", () => {
    if (typeof html2canvas === "undefined") {
        alert("Várj egy pillanatot, míg betölt a mentéshez szükséges könyvtár.");
        return;
    }
    html2canvas(document.getElementById("board")).then(canvas => {
        const link = document.createElement("a");
        link.download = "doboz.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
    });
});
