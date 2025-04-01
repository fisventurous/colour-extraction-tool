// DOM Elements
const dropArea = document.getElementById('dropArea');
const fileInput = document.getElementById('fileInput');
const previewImg = document.getElementById('previewImg');
const extractBtn = document.getElementById('extractBtn');
const resetBtn = document.getElementById('resetBtn');
const resultsText = document.getElementById('resultsText');
const copyBtn = document.getElementById('copyBtn');
const saveBtn = document.getElementById('saveBtn');
const vizBtn = document.getElementById('vizBtn');
const backToResultsBtn = document.getElementById('backToResultsBtn');
const colorGrid = document.getElementById('colorGrid');
const colorThreshold = document.getElementById('colorThreshold');
const thresholdValue = document.getElementById('thresholdValue');
const maxColors = document.getElementById('maxColors');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingMessage = document.getElementById('loadingMessage');
const tabs = document.querySelectorAll('.tab');
const toast = document.getElementById('toast');
const analysisSection = document.getElementById('analysisSection');
const totalPixelsEl = document.getElementById('totalPixels');
const rawColorsEl = document.getElementById('rawColors');
const uniqueColorsEl = document.getElementById('uniqueColors');
const colorDistributionEl = document.getElementById('colorDistribution');
const categorySelectionContainer = document.getElementById('categorySelectionContainer');
const categoryItemsContainer = document.getElementById('categoryItems');
const selectAllBtn = document.getElementById('selectAllBtn');
const deselectAllBtn = document.getElementById('deselectAllBtn');
const uploadTab = document.getElementById('uploadTab');
const resultsTab = document.getElementById('resultsTab');
const vizTab = document.getElementById('vizTab');
const tabContentSections = [uploadTab, resultsTab, vizTab];

// Global variables
let imageDataUrl = null;
let imageStats = null;
let availableCategories = [];
let selectedCategories = new Set();
let extractedColorData = null;
let analysisInProgress = false;
let extractionInProgress = false;

// === Event Listeners ===
dropArea.addEventListener('click', () => fileInput.click());
dropArea.addEventListener('dragover', (e) => { e.preventDefault(); dropArea.classList.add('active'); });
dropArea.addEventListener('dragleave', () => { dropArea.classList.remove('active'); });
dropArea.addEventListener('drop', (e) => { e.preventDefault(); dropArea.classList.remove('active'); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });
extractBtn.addEventListener('click', runExtraction); // Calls the wrapper function
resetBtn.addEventListener('click', () => resetTool(true));
copyBtn.addEventListener('click', copyResults);
saveBtn.addEventListener('click', saveResults);
vizBtn.addEventListener('click', () => changeTab('visualization'));
backToResultsBtn.addEventListener('click', () => changeTab('results'));
colorThreshold.addEventListener('input', () => { thresholdValue.textContent = colorThreshold.value; });
tabs.forEach(tab => tab.addEventListener('click', () => { if (analysisInProgress || extractionInProgress) { showToast("Please wait..."); return; } changeTab(tab.dataset.tab); }));
selectAllBtn.addEventListener('click', () => toggleAllCategories(true));
deselectAllBtn.addEventListener('click', () => toggleAllCategories(false));

// === Functions ===

function handleFile(file) {
    if (!file.type.match('image.*')) { alert('Please select an image file.'); return; }
    if (analysisInProgress || extractionInProgress) return;
    resetTool(false); showLoading("Analysing image..."); analysisInProgress = true;
    const reader = new FileReader();
    reader.onload = (e) => {
        imageDataUrl = e.target.result; previewImg.src = imageDataUrl; previewImg.style.display = 'block';
        setTimeout(() => { // Defer analysis slightly
            try { performInitialAnalysis(); } catch(error) { console.error("Analysis failed:", error); showToast("Error during analysis."); resetTool(); }
            finally { hideLoading(); analysisInProgress = false; if (availableCategories.length > 0) extractBtn.disabled = false; }
        }, 50);
    };
     reader.onerror = () => { showToast("Error reading file."); resetTool(); hideLoading(); analysisInProgress = false; };
    reader.readAsDataURL(file);
}

function resetTool(fullReset = true) {
    if (fullReset) fileInput.value = '';
    previewImg.src = ''; previewImg.style.display = 'none'; extractBtn.disabled = true;
    resultsText.value = 'No results yet.'; resultsText.placeholder = 'No results yet. Upload image, select categories, extract.';
    colorGrid.innerHTML = '<p>No colours extracted yet.</p>'; analysisSection.style.display = 'none';
    totalPixelsEl.textContent = '-'; rawColorsEl.textContent = '-'; uniqueColorsEl.textContent = '-';
    colorDistributionEl.innerHTML = 'Loading distribution...'; categoryItemsContainer.innerHTML = '<p class="text-light">Upload an image to see categories.</p>';
    imageDataUrl = null; imageStats = null; availableCategories = []; selectedCategories = new Set();
    extractedColorData = null; analysisInProgress = false; extractionInProgress = false;
    colorThreshold.value = 10; thresholdValue.textContent = '10'; maxColors.value = 20;
    changeTab('upload');
}

function changeTab(tabName) {
    tabContentSections.forEach(section => { if (section) section.style.display = 'none'; });
    tabs.forEach(tab => { tab.classList.toggle('active', tab.dataset.tab === tabName); });
    let sectionToShow = null;
    if (tabName === 'upload') sectionToShow = uploadTab;
    else if (tabName === 'results') sectionToShow = resultsTab;
    else if (tabName === 'visualization') sectionToShow = vizTab;
    if (sectionToShow) {
        sectionToShow.style.display = 'block';
        if (tabName === 'visualization') { if (extractedColorData) visualizeColors(); else colorGrid.innerHTML = '<p>No colours extracted yet.</p>'; }
        else if (tabName === 'results' && !extractedColorData) { resultsText.value = 'No results yet.'; }
    } else {
        console.error(`Cannot find content section for tab: ${tabName}`);
        if (uploadTab) { uploadTab.style.display = 'block'; tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'upload'));}
    }
}

function performInitialAnalysis() {
    const image = new Image(); image.src = imageDataUrl;
    image.onload = () => { // Use onload for analysis too for consistency
        const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true });
        let { width, height } = calculatePreviewSize(image.naturalWidth, image.naturalHeight);
        canvas.width = width; canvas.height = height; ctx.drawImage(image, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);
        const { rawColorCounts, categoryCounts, totalPixelCount } = processPixelData(imgData.data);
        const rawUniqueColors = Array.from(rawColorCounts.keys()).map(key => key.split(',').map(Number));
        const currentThreshold = parseInt(colorThreshold.value);
        const deduplicatedEstimate = estimateDeduplicatedColors(rawUniqueColors, currentThreshold);
        totalPixelsEl.textContent = totalPixelCount.toLocaleString(); rawColorsEl.textContent = rawColorCounts.size.toLocaleString(); uniqueColorsEl.textContent = deduplicatedEstimate.toLocaleString();
        updateColorDistribution(categoryCounts, totalPixelCount);
        availableCategories = Object.keys(categoryCounts).sort(); populateCategorySelection(availableCategories);
        imageStats = { totalPixels: totalPixelCount, rawColors: rawColorCounts.size, uniqueColors: deduplicatedEstimate, distribution: categoryCounts };
        analysisSection.style.display = 'block';
    };
    image.onerror = () => { throw new Error("Could not load image for initial analysis."); } // Handle error
}

function calculatePreviewSize(width, height, maxPixels = 200 * 200) { if (width * height > maxPixels) { const scale = Math.sqrt(maxPixels / (width * height)); width = Math.floor(width * scale); height = Math.floor(height * scale); } return { width, height }; }
function processPixelData(pixels) { const C = new Map(); const Cat = {}; let p = 0; for (let i = 0; i < pixels.length; i += 4) { const a = pixels[i + 3]; if (a < 128) continue; p++; const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2]; const k = `${r},${g},${b}`; C.set(k, (C.get(k) || 0) + 1); const cat = getColorCategory(r, g, b); Cat[cat] = (Cat[cat] || 0) + 1; } return { rawColorCounts: C, categoryCounts: Cat, totalPixelCount: p }; }

function updateColorDistribution(categoryCounts, totalPixels) {
    colorDistributionEl.innerHTML = ''; const S = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]); if (S.length === 0) { colorDistributionEl.textContent = "No colours found."; return; } let disp = 0; const max = 15;
    S.forEach(([cat, cnt]) => { if (disp >= max) return; const p = (cnt / totalPixels * 100); if (p < 0.1 && cat !== 'Black') return; const i = document.createElement('div'); i.className = 'distribution-item'; i.title = `${cat}: ${cnt.toLocaleString()} px (${p.toFixed(1)}%)`; const c = document.createElement('div'); c.className = 'distribution-color'; c.style.backgroundColor = getCategoryRepresentativeColor(cat); const t = document.createTextNode(`${cat} (${p.toFixed(1)}%)`); i.append(c, t); colorDistributionEl.appendChild(i); disp++; });
    if (S.length > max) { const m = document.createElement('div'); m.className = 'distribution-item'; m.textContent = `+${S.length - max} more...`; colorDistributionEl.appendChild(m); }
}

function populateCategorySelection(categories) {
    categoryItemsContainer.innerHTML = ''; selectedCategories = new Set();
    if (categories.length === 0) { categoryItemsContainer.innerHTML = '<p class="text-light">No categories detected.</p>'; extractBtn.disabled = true; return; }
    categories.forEach(category => {
        const item = document.createElement('div'); item.className = 'category-select-item selected'; item.dataset.category = category; item.setAttribute('role', 'checkbox'); item.setAttribute('aria-checked', 'true'); item.tabIndex = 0;
        const swatch = document.createElement('span'); swatch.className = 'category-swatch'; swatch.style.backgroundColor = getCategoryRepresentativeColor(category);
        const name = document.createElement('span'); name.className = 'category-name'; name.textContent = category;
        item.append(swatch, name); categoryItemsContainer.appendChild(item); selectedCategories.add(category);
        item.addEventListener('click', () => { const isSelected = item.classList.toggle('selected'); item.setAttribute('aria-checked', String(isSelected)); if (isSelected) selectedCategories.add(category); else selectedCategories.delete(category); extractBtn.disabled = selectedCategories.size === 0; });
        item.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); item.click(); } });
    });
    extractBtn.disabled = false;
}

function toggleAllCategories(select) {
    const items = categoryItemsContainer.querySelectorAll('.category-select-item');
    items.forEach(item => { const category = item.dataset.category; const isSelected = item.classList.contains('selected'); if (select && !isSelected) { item.classList.add('selected'); item.setAttribute('aria-checked', 'true'); selectedCategories.add(category); } else if (!select && isSelected) { item.classList.remove('selected'); item.setAttribute('aria-checked', 'false'); selectedCategories.delete(category); } });
    extractBtn.disabled = selectedCategories.size === 0;
}

function estimateDeduplicatedColors(uniqueColors, threshold) { if (uniqueColors.length === 0) return 0; const SS = Math.min(uniqueColors.length, 500); const S = uniqueColors.length <= SS ? uniqueColors : uniqueColors.sort(() => 0.5 - Math.random()).slice(0, SS); let c = 0; const K = []; for (const C of S) { if (!K.some(E => colorDistance(C, E) < threshold)) { K.push(C); c++; } } const R = S.length > 0 ? c / S.length : 1; return Math.max(1, Math.round(uniqueColors.length * R)); }

function runExtraction() {
    if (!imageDataUrl || extractionInProgress) return;
    if (selectedCategories.size === 0) { showToast("Please select categories first."); return; }
    showLoading("Extracting selected colours..."); extractionInProgress = true;

    // Use a Promise to handle the asynchronous image loading within extraction
    extractColorsAsync()
        .then(() => {
            changeTab('results'); // Move to results only after successful extraction
        })
        .catch(error => {
            console.error("Extraction failed:", error);
            showToast("Error during extraction. Check console.");
        })
        .finally(() => {
            hideLoading();
            extractionInProgress = false;
        });
}

// === UPDATED extractColorsAsync function ===
function extractColorsAsync() {
    return new Promise((resolve, reject) => {
        if (!imageDataUrl || selectedCategories.size === 0) {
            return reject(new Error("No image data or no categories selected."));
        }

        const image = new Image();
        image.src = imageDataUrl;

        image.onload = () => {
            try {
                // --- All canvas operations are now safely inside onload ---
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;
                ctx.drawImage(image, 0, 0);
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const { rawColorCounts, totalPixelCount } = processPixelDataForExtraction(imgData.data);
                const threshold = parseInt(colorThreshold.value);
                const maxPerCategory = parseInt(maxColors.value);
                let colorsToProcess = Array.from(rawColorCounts.entries()).map(([key, count]) => {
                    const [r, g, b] = key.split(',').map(Number);
                    return { rgb: [r, g, b], hex: rgbToHex(r, g, b), decimal: rgbToDecimal(r, g, b), count: count };
                });
                colorsToProcess.sort((a, b) => b.count - a.count);
                const { deduplicatedColors } = deduplicateAndAggregate(colorsToProcess, threshold);
                const categorizedResults = categorizeAndLimit(deduplicatedColors, maxPerCategory, totalPixelCount);

                extractedColorData = categorizedResults; // Store results globally
                generateResultsText(image.naturalWidth, image.naturalHeight, totalPixelCount, deduplicatedColors.length);

                resolve(); // Signal successful completion
                // --- End of canvas operations ---
            } catch (error) {
                reject(error); // Propagate any errors during processing
            }
        };

        image.onerror = () => {
            reject(new Error("Could not load image data for extraction."));
        };
    });
}


// These functions remain synchronous as they don't interact with image loading directly
function processPixelDataForExtraction(pixels) { const C = new Map(); let p = 0; for (let i = 0; i < pixels.length; i += 4) { const a = pixels[i + 3]; if (a < 128) continue; p++; const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2]; const cat = getColorCategory(r, g, b); if (selectedCategories.has(cat)) { const k = `${r},${g},${b}`; C.set(k, (C.get(k) || 0) + 1); } } return { rawColorCounts: C, totalPixelCount: p }; }
function deduplicateAndAggregate(sortedColors, threshold) { const D = []; for (const C of sortedColors) { let S = false; for (const K of D) { if (colorDistance(C.rgb, K.rgb) < threshold) { K.count += C.count; S = true; break; } } if (!S) { D.push({ ...C }); } } D.sort((a,b) => b.count - a.count); return { deduplicatedColors: D }; }
function categorizeAndLimit(deduplicatedColors, maxPerCategory, totalPixelCount) { const R = {}; selectedCategories.forEach(cat => { R[cat] = []; }); deduplicatedColors.forEach(color => { const cat = getColorCategory(color.rgb[0], color.rgb[1], color.rgb[2]); if (R[cat]) { color.percentage = (color.count / totalPixelCount * 100).toFixed(2); R[cat].push(color); } }); Object.keys(R).forEach(cat => { R[cat].sort((a, b) => b.count - a.count); R[cat] = R[cat].slice(0, maxPerCategory); }); return R; }

function generateResultsText(imgWidth, imgHeight, totalPixels, finalUniqueCount) {
    let O = `# Colour Extraction Results\n\n- Image Size: ${imgWidth}x${imgHeight} px\n- Analysed Pixels: ${totalPixels.toLocaleString()}\n- Final Unique Colours: ${finalUniqueCount.toLocaleString()}\n- Categories: ${Array.from(selectedCategories).join(', ')}\n- Threshold: ${colorThreshold.value}\n- Max/Category: ${maxColors.value}\n\n`;
    const CO = ['White', 'Grey', 'Black', 'Red', 'Pink', 'Pastel Pink', 'Orange', 'Pastel Orange', 'Yellow', 'Pastel Yellow', 'Green', 'Pastel Green', 'Pastel Cyan', 'Cyan', 'Blue', 'Pastel Blue', 'Purple', 'Pastel Purple', 'Magenta', 'Pastel Magenta', 'Brown'];
    const SC = Object.keys(extractedColorData).sort((a, b) => { const iA = CO.indexOf(a), iB = CO.indexOf(b); const oA = iA === -1 ? 999 : iA, oB = iB === -1 ? 999 : iB; return oA !== oB ? oA - oB : a.localeCompare(b); });
    SC.forEach(cat => { const C = extractedColorData[cat]; if (!C || C.length === 0) return; O += `## ${cat} (${C.length})\n\n| Hex       | Decimal    | RGB               | Percentage | Count      |\n| :-------- | :--------- | :---------------- | :--------- | :--------- |\n`; C.forEach(c => { const h = c.hex.padEnd(9); const d = c.decimal.toLocaleString().padEnd(10); const r = `(${c.rgb[0]}, ${c.rgb[1]}, ${c.rgb[2]})`.padEnd(18); const p = `${c.percentage}%`.padEnd(10); const n = c.count.toLocaleString().padEnd(10); O += `| ${h} | ${d} | ${r} | ${p} | ${n} |\n`; }); O += '\n'; }); resultsText.value = O;
}

function visualizeColors() {
    if (!colorGrid) return; colorGrid.innerHTML = '';
    if (!extractedColorData || Object.keys(extractedColorData).length === 0) { colorGrid.innerHTML = '<p>No colours extracted or selected.</p>'; return; }
    const CO = ['White', 'Grey', 'Black', 'Red', 'Pink', 'Pastel Pink', 'Orange', 'Pastel Orange', 'Yellow', 'Pastel Yellow', 'Green', 'Pastel Green', 'Pastel Cyan', 'Cyan', 'Blue', 'Pastel Blue', 'Purple', 'Pastel Purple', 'Magenta', 'Pastel Magenta', 'Brown'];
    const SC = Object.keys(extractedColorData).sort((a, b) => { const iA = CO.indexOf(a), iB = CO.indexOf(b); const oA = iA === -1 ? 999 : iA, oB = iB === -1 ? 999 : iB; return oA !== oB ? oA - oB : a.localeCompare(b); });
    let found = false;
    SC.forEach(cat => { const C = extractedColorData[cat]; if (!C || C.length === 0) return; found = true;
        const catDiv = document.createElement('div'); catDiv.className = 'category';
        const title = document.createElement('div'); title.className = 'category-title'; title.textContent = `${cat} (${C.length})`; catDiv.appendChild(title);
        const grid = document.createElement('div'); grid.className = 'color-grid';
        C.forEach(c => {
            const box = document.createElement('div'); box.className = 'color-box';
            const sample = document.createElement('div'); sample.className = 'color-sample'; sample.style.backgroundColor = c.hex;
            const overlay = document.createElement('div'); overlay.className = 'hover-overlay';
            const hexDiv = document.createElement('div'); hexDiv.textContent = 'Copy HEX'; hexDiv.className = 'copy-hex-area';
            const decDiv = document.createElement('div'); decDiv.textContent = 'Copy DEC';
            overlay.append(hexDiv, decDiv); sample.appendChild(overlay);
            sample.addEventListener('click', (event) => { const R = sample.getBoundingClientRect(); const cX = event.clientX - R.left; const W = sample.offsetWidth; if (cX < W / 2) { navigator.clipboard.writeText(c.hex).then(() => showToast(`Copied HEX: ${c.hex}!`)).catch(err => { showToast('Copy failed.'); console.error(err); }); } else { navigator.clipboard.writeText(c.decimal.toString()).then(() => showToast(`Copied DEC: ${c.decimal}!`)).catch(err => { showToast('Copy failed.'); console.error(err); }); } });
            const info = document.createElement('div'); info.className = 'color-info';
            const hexVal = document.createElement('div'); hexVal.className = 'color-hex'; hexVal.textContent = c.hex;
            const details = document.createElement('div'); details.className = 'color-details';
            details.textContent = `DEC: ${c.decimal.toLocaleString()} | RGB(${c.rgb.join(', ')}) | ${c.percentage}%`;
            info.append(hexVal, details); box.append(sample, info); grid.appendChild(box);
        });
        catDiv.appendChild(grid); colorGrid.appendChild(catDiv); });
    if (!found) colorGrid.innerHTML = '<p>No colours found in selected categories.</p>';
}


// === Utility Functions ===
function colorDistance(rgb1, rgb2) { if (!rgb1 || !rgb2 || rgb1.length !== 3 || rgb2.length !== 3) return Infinity; return Math.sqrt( Math.pow(rgb1[0] - rgb2[0], 2) + Math.pow(rgb1[1] - rgb2[1], 2) + Math.pow(rgb1[2] - rgb2[2], 2) ); }
function rgbToHex(r, g, b) { return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join(''); }
function rgbToDecimal(r, g, b) { return (r << 16) + (g << 8) + b; }
function rgbToHsl(r, g, b) { r /= 255; g /= 255; b /= 255; const M=Math.max(r,g,b), m=Math.min(r,g,b); let h,s,l=(M+m)/2; if(M===m) {h=s=0;} else {const d=M-m; s=l>0.5?d/(2-M-m):d/(M+m); switch(M){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;} h/=6;} return [h,s,l]; }
function getColorCategory(r, g, b) { const [h, s, l] = rgbToHsl(r, g, b); if (l < 0.15 && s < 0.25) return 'Black'; if (l > 0.92) return 'White'; if (s < 0.18) return 'Grey'; const hue = h * 360; if (l < 0.6 && s < 0.6 && (hue >= 15 && hue < 45)) return 'Brown'; if (l < 0.5 && s < 0.7 && (hue < 15 || hue >= 340)) return 'Brown'; if (l > 0.75 && s < 0.5) { if (hue < 25 || hue >= 340) return 'Pastel Pink'; if (hue < 50) return 'Pastel Orange'; if (hue < 75) return 'Pastel Yellow'; if (hue < 160) return 'Pastel Green'; if (hue < 200) return 'Pastel Cyan'; if (hue < 260) return 'Pastel Blue'; if (hue < 300) return 'Pastel Purple'; if (hue < 340) return 'Pastel Magenta'; return 'Pastel Pink'; } if (hue < 20 || hue >= 330) return 'Red'; if (hue < 45) return 'Orange'; if (hue < 70) return 'Yellow'; if (hue < 165) return 'Green'; if (hue < 200) return 'Cyan'; if (hue < 260) return 'Blue'; if (hue < 290) return 'Purple'; if (hue < 330) return 'Magenta'; return 'Red'; }
function getCategoryRepresentativeColor(cat) { const C = { 'Red': '#FF0000', 'Pink': '#FFC0CB', 'Orange': '#FFA500', 'Yellow': '#FFFF00', 'Green': '#008000', 'Cyan': '#00FFFF', 'Blue': '#0000FF', 'Purple': '#800080', 'Magenta': '#FF00FF', 'Brown': '#A52A2A', 'White': '#FFFFFF', 'Grey': '#808080', 'Black': '#000000', 'Pastel Pink': '#FFD1DC', 'Pastel Orange': '#FFD8B1', 'Pastel Yellow': '#FFFACD', 'Pastel Green': '#98FB98', 'Pastel Cyan': '#AFEEEE', 'Pastel Blue': '#ADD8E6', 'Pastel Purple': '#D8BFD8', 'Pastel Magenta': '#FFB6C1' }; return C[cat] || '#CCC'; }
function copyResults() { if (!resultsText.value || resultsText.value.startsWith('No results')) { showToast("Nothing to copy!"); return; } navigator.clipboard.writeText(resultsText.value).then(() => showToast("Results copied!")).catch(err => { console.error('Copy failed:', err); showToast("Copy failed."); }); }
function saveResults() { if (!resultsText.value || resultsText.value.startsWith('No results')) { showToast("Nothing to save!"); return; } const blob = new Blob([resultsText.value], {type: 'text/markdown;charset=utf-8'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; let filename = 'colour_results.md'; const F=document.getElementById('fileInput'); if (F && F.files.length > 0) { const B = F.files[0].name.replace(/\.[^/.]+$/, ""); filename = `${B}_colours.md`; } a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); showToast("Results saved."); }
function showToast(message) { toast.textContent = message; toast.className = 'show'; setTimeout(() => { toast.className = toast.className.replace('show', ''); }, 3000); }
function showLoading(message = "Processing...") { loadingMessage.textContent = message; loadingOverlay.style.display = 'flex'; }
function hideLoading() { loadingOverlay.style.display = 'none'; }

// Initialize
changeTab('upload');