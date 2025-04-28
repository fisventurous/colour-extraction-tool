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
const themeToggle = document.getElementById('themeToggle');
const removeBgCheckbox = document.getElementById('removeBgCheckbox');
const extractGradientsCheckbox = document.getElementById('extractGradients');
const colorPickerBtn = document.getElementById('colorPickerBtn');

// Dynamically created elements
const colorPickerTooltip = document.createElement('div');
colorPickerTooltip.className = 'color-picker-tooltip';
document.body.appendChild(colorPickerTooltip);

// Global state
let imageDataUrl = null;
let imageStats = null;
let availableCategories = [];
let selectedCategories = new Set();
let extractedColorData = null;
let worker = null;
let analysisInProgress = false;
let extractionInProgress = false;
let isColorPickerActive = false;

// === Event Listeners ===
dropArea.addEventListener('click', () => fileInput.click());
dropArea.addEventListener('dragover', (e) => { e.preventDefault(); dropArea.classList.add('active'); });
dropArea.addEventListener('dragleave', () => { dropArea.classList.remove('active'); });
dropArea.addEventListener('drop', (e) => { e.preventDefault(); dropArea.classList.remove('active'); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });
extractBtn.addEventListener('click', runExtraction);
resetBtn.addEventListener('click', () => resetTool(true));
copyBtn.addEventListener('click', copyResults);
saveBtn.addEventListener('click', saveResults);
vizBtn.addEventListener('click', () => changeTab('visualization'));
backToResultsBtn.addEventListener('click', () => changeTab('results'));
colorThreshold.addEventListener('input', () => { thresholdValue.textContent = colorThreshold.value; });
tabs.forEach(tab => tab.addEventListener('click', () => { if (analysisInProgress || extractionInProgress) { showToast("Please wait..."); return; } changeTab(tab.dataset.tab); }));
selectAllBtn.addEventListener('click', () => toggleAllCategories(true));
deselectAllBtn.addEventListener('click', () => toggleAllCategories(false));
themeToggle.addEventListener('click', toggleTheme);
if (colorPickerBtn) colorPickerBtn.addEventListener('click', toggleColorPicker);

// === Colour Picker Event Listeners ===
previewImg.addEventListener('mousemove', (e) => {
    if (!isColorPickerActive || !imageDataUrl || !previewImg.naturalWidth) {
        colorPickerTooltip.style.display = 'none';
        return;
    }

    const rect = previewImg.getBoundingClientRect();
    const scaleX = previewImg.naturalWidth / rect.width;
    const scaleY = previewImg.naturalHeight / rect.height;
    const imageX = Math.max(0, Math.min(Math.floor((e.clientX - rect.left) * scaleX), previewImg.naturalWidth - 1));
    const imageY = Math.max(0, Math.min(Math.floor((e.clientY - rect.top) * scaleY), previewImg.naturalHeight - 1));

    // Use a temporary canvas for pixel data extraction
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = previewImg.naturalWidth;
    canvas.height = previewImg.naturalHeight;

    try {
        ctx.drawImage(previewImg, 0, 0);
        const pixel = ctx.getImageData(imageX, imageY, 1, 1).data;

        if (pixel[3] < 10) {
             colorPickerTooltip.style.display = 'none';
             return;
        }

        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);

        colorPickerTooltip.style.display = 'block';
        colorPickerTooltip.style.left = `${e.clientX + window.scrollX + 15}px`;
        colorPickerTooltip.style.top = `${e.clientY + window.scrollY + 15}px`;
        colorPickerTooltip.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="display:inline-block; width:16px; height:16px; background:${hex}; border:1px solid #888;"></span>
                <span style="font-weight:bold;">${hex}</span>
            </div>
            <div style="font-size: 0.85em; margin-top: 4px;">RGB: ${pixel[0]}, ${pixel[1]}, ${pixel[2]}</div>
            ${pixel[3] < 255 ? `<div style="font-size: 0.85em;">Alpha: ${pixel[3]}</div>` : ''}
        `;
    } catch (error) {
         console.error("Colour picker mousemove error:", error);
         colorPickerTooltip.style.display = 'none';
    }
});

previewImg.addEventListener('click', (e) => {
    if (!isColorPickerActive || !imageDataUrl || !previewImg.naturalWidth) return;

    const rect = previewImg.getBoundingClientRect();
    const scaleX = previewImg.naturalWidth / rect.width;
    const scaleY = previewImg.naturalHeight / rect.height;
    const imageX = Math.max(0, Math.min(Math.floor((e.clientX - rect.left) * scaleX), previewImg.naturalWidth - 1));
    const imageY = Math.max(0, Math.min(Math.floor((e.clientY - rect.top) * scaleY), previewImg.naturalHeight - 1));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = previewImg.naturalWidth;
    canvas.height = previewImg.naturalHeight;

    try {
        ctx.drawImage(previewImg, 0, 0);
        const pixel = ctx.getImageData(imageX, imageY, 1, 1).data;

        if (pixel[3] < 10) {
            showToast("Picked transparent area.");
            return;
        }

        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);

        colorPickerTooltip.innerHTML += `
            <div style="margin-top:5px; font-size:0.9em; color: var(--accent, #7047EB); font-weight:bold;">✔ Copied!</div>
        `;

        navigator.clipboard.writeText(hex).then(() => {
            setTimeout(() => {
                // if you prefer to have the copied tooltip faded, uncomment this
                 // if (colorPickerTooltip.style.display !== 'none') {
                 //    colorPickerTooltip.style.display = 'none';
                 // }
            }, 800);
        }).catch(err => {
            console.error('Picker copy failed:', err);
            showToast("Failed to copy colour.");
            colorPickerTooltip.innerHTML += `
                <div style="margin-top:5px; font-size:0.9em; color: red; font-weight:bold;">❌ Copy Failed</div>
            `;
             setTimeout(() => { colorPickerTooltip.style.display = 'none'; }, 1500);
        });

    } catch (error) {
        console.error("Colour picker click error:", error);
        showToast("Could not pick colour from image.");
        colorPickerTooltip.style.display = 'none';
    }
});

previewImg.addEventListener('mouseleave', () => {
    colorPickerTooltip.style.display = 'none';
});

// === Initialisation ===
initWorker();
applyInitialTheme();
changeTab('upload');

// === Worker Setup ===
function initWorker() {
    if (window.Worker) {
        if (worker) {
            worker.terminate();
        }
        worker = new Worker('colour-worker.js');
        worker.onmessage = handleWorkerMessage;
        worker.onerror = handleWorkerError;
    } else {
        console.error("Web Workers not supported.");
        showToast("Error: Browser doesn't support required features.");
        extractBtn.disabled = true;
    }
}

function handleWorkerMessage(e) {
    const { type, data, error } = e.data;

    if (error) {
        console.error("Worker Error:", error);
        showToast(`Processing Error: ${error}`);
        hideLoading();
        analysisInProgress = false;
        extractionInProgress = false;
        return;
    }

    switch (type) {
        case 'analysisComplete':
            handleAnalysisResults(data);
            break;
        case 'extractionComplete':
            handleExtractionResults(data);
            break;
        case 'analysisProgress':
            loadingMessage.textContent = `Analysing... ${data.progress}%`;
            break;
        default:
            console.warn("Unknown message type from worker:", type);
    }
}

// Need this function to toggle the picker state
function toggleColorPicker() {
    isColorPickerActive = !isColorPickerActive;
    previewImg.classList.toggle('color-picker-active', isColorPickerActive);
    if (!isColorPickerActive) {
        colorPickerTooltip.style.display = 'none';
    }
    showToast(isColorPickerActive ?
        'Colour picker on | Hover image to preview, click to copy' :
        'Colour picker off'
    );
}

function handleWorkerError(error) {
    console.error("Worker Error:", error.message, error);
    showToast("A processing error occurred. Check console.");
    hideLoading();
    analysisInProgress = false;
    extractionInProgress = false;
}

// === File Handling & Analysis ===
function handleFile(file) {
    if (!file.type.match('image.*')) { alert('Please select an image file.'); return; }
    if (analysisInProgress || extractionInProgress || !worker) return;

    resetTool(false);
    showLoading("Reading image...");
    analysisInProgress = true;

    const reader = new FileReader();
    reader.onload = (e) => {
        imageDataUrl = e.target.result;
        previewImg.src = imageDataUrl;
        previewImg.style.display = 'block';

        const img = new Image();
        img.onload = () => {
            showLoading("Analysing image...");
            try {
                 const canvas = document.createElement('canvas');
                 const ctx = canvas.getContext('2d', { willReadFrequently: true });
                 canvas.width = img.naturalWidth;
                 canvas.height = img.naturalHeight;
                 ctx.drawImage(img, 0, 0);
                 const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                worker.postMessage({
                    type: 'analyse',
                    imageData: imageData,
                    options: {
                        removeBg: removeBgCheckbox.checked,
                        threshold: parseInt(colorThreshold.value, 10)
                    }
                });
            } catch (err) {
                console.error("Canvas/Worker Error:", err);
                showToast("Error preparing image for analysis.");
                resetTool();
                hideLoading();
                analysisInProgress = false;
            }
        };
        img.onerror = () => {
            showToast("Error loading image data.");
            resetTool();
            hideLoading();
            analysisInProgress = false;
        };
        img.src = imageDataUrl;
    };
    reader.onerror = () => {
        showToast("Error reading file.");
        resetTool();
        hideLoading();
        analysisInProgress = false;
    };
    reader.readAsDataURL(file);
}

function handleAnalysisResults(data) {
    const { totalPixelCount, rawColorCount, estimatedUniqueCount, categoryCounts } = data;

    totalPixelsEl.textContent = totalPixelCount.toLocaleString();
    rawColorsEl.textContent = rawColorCount.toLocaleString();
    uniqueColorsEl.textContent = estimatedUniqueCount.toLocaleString();

    availableCategories = Object.keys(categoryCounts).sort();
    populateCategorySelection(availableCategories);
    updateColorDistribution(categoryCounts, totalPixelCount);

    imageStats = {
        width: previewImg.naturalWidth,
        height: previewImg.naturalHeight,
        totalPixels: totalPixelCount,
        rawColors: rawColorCount,
        estimatedUnique: estimatedUniqueCount
    };

    analysisSection.style.display = 'block';
    extractBtn.disabled = availableCategories.length === 0;
    if (colorPickerBtn) colorPickerBtn.disabled = false;
    hideLoading();
    analysisInProgress = false;
}


// === Extraction ===
function runExtraction() {
    if (!imageDataUrl || extractionInProgress || analysisInProgress || !worker) return;
    if (selectedCategories.size === 0) { showToast("Please select categories first."); return; }

    showLoading("Extracting selected colours...");
    extractionInProgress = true;

    const img = new Image();
    img.onload = () => {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            worker.postMessage({
                type: 'extract',
                imageData: imageData,
                options: {
                    selectedCategories: Array.from(selectedCategories),
                    threshold: parseInt(colorThreshold.value, 10),
                    maxColorsPerCategory: parseInt(maxColors.value, 10),
                    removeBg: removeBgCheckbox.checked,
                    extractGradients: extractGradientsCheckbox.checked
                }
            });
        } catch (err) {
            console.error("Extraction Canvas/Worker Error:", err);
            showToast("Error preparing image for extraction.");
            hideLoading();
            extractionInProgress = false;
        }
    };
    img.onerror = () => {
        showToast("Error loading image for extraction.");
        hideLoading();
        extractionInProgress = false;
    };
    img.src = imageDataUrl;
}

function handleExtractionResults(data) {
    extractedColorData = data.categorizedResults;
    generateResultsText(data.finalUniqueCount);
    visualizeColors();
    changeTab('results');
    hideLoading();
    extractionInProgress = false;
}

// === UI Updates & State Management ===

function resetTool(fullReset = true) {
    if (fullReset) {
        fileInput.value = '';
        imageDataUrl = null;
        previewImg.src = '';
        previewImg.style.display = 'none';
        previewImg.classList.remove('color-picker-active');
        isColorPickerActive = false;
        if (colorPickerBtn) colorPickerBtn.disabled = true;
        analysisSection.style.display = 'none';
        categoryItemsContainer.innerHTML = '<p class="text-light">Upload an image to see categories.</p>';
        totalPixelsEl.textContent = '-';
        rawColorsEl.textContent = '-';
        uniqueColorsEl.textContent = '-';
        colorDistributionEl.innerHTML = 'Upload image to see distribution...';
    }
    resultsText.value = 'No results yet.';
    resultsText.placeholder = 'No results yet. Upload image, select categories, extract.';
    colorGrid.innerHTML = '<p>No colours extracted yet.</p>';
    extractBtn.disabled = true;
    selectedCategories = new Set();
    extractedColorData = null;
    imageStats = null;
    analysisInProgress = false;
    extractionInProgress = false;
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
        if (tabName === 'visualization') {
             if (extractedColorData) visualizeColors();
             else colorGrid.innerHTML = '<p>No colours extracted yet. Go back to Upload, select categories and extract.</p>';
        } else if (tabName === 'results' && !extractedColorData) {
             resultsText.value = 'No results yet.';
        }
    } else {
        console.error(`Cannot find content section for tab: ${tabName}`);
        if (uploadTab) { uploadTab.style.display = 'block'; tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'upload'));}
    }
}

function updateColorDistribution(categoryCounts, totalPixels) {
    colorDistributionEl.innerHTML = '';
    const sortedEntries = Object.entries(categoryCounts).sort(([, countA], [, countB]) => countB - countA);

    if (sortedEntries.length === 0) {
        colorDistributionEl.textContent = "No significant colour categories found.";
        return;
    }

    let displayedCount = 0;
    const maxItemsToShow = 15;

    sortedEntries.forEach(([category, count]) => {
        if (displayedCount >= maxItemsToShow) return;
        const percentage = (count / totalPixels * 100);
        if (percentage < 0.1 && !['Black', 'White', 'Grey'].includes(category)) return;

        const item = document.createElement('div');
        item.className = 'distribution-item';
        item.title = `${category}: ${count.toLocaleString()} px (${percentage.toFixed(1)}%)`;

        const colourDiv = document.createElement('div');
        colourDiv.className = 'distribution-color';
        colourDiv.style.backgroundColor = getCategoryRepresentativeColor(category);

        const text = document.createTextNode(`${category} (${percentage.toFixed(1)}%)`);
        item.append(colourDiv, text);
        colorDistributionEl.appendChild(item);
        displayedCount++;
    });

    if (sortedEntries.length > maxItemsToShow) {
        const moreItem = document.createElement('div');
        moreItem.className = 'distribution-item';
        moreItem.textContent = `+${sortedEntries.length - maxItemsToShow} more...`;
        colorDistributionEl.appendChild(moreItem);
    }
}

function populateCategorySelection(categories) {
    categoryItemsContainer.innerHTML = '';
    selectedCategories = new Set();

    if (categories.length === 0) {
        categoryItemsContainer.innerHTML = '<p class="text-light">No distinct colour categories detected.</p>';
        extractBtn.disabled = true;
        return;
    }

    categories.forEach(category => {
        const item = document.createElement('div');
        item.className = 'category-select-item';
        item.dataset.category = category;
        item.setAttribute('role', 'checkbox');
        item.setAttribute('aria-checked', 'false');
        item.tabIndex = 0;

        const swatch = document.createElement('span');
        swatch.className = 'category-swatch';
        swatch.style.backgroundColor = getCategoryRepresentativeColor(category);

        const name = document.createElement('span');
        name.className = 'category-name';
        name.textContent = category;

        item.append(swatch, name);
        categoryItemsContainer.appendChild(item);

        item.addEventListener('click', () => toggleCategorySelection(item, category));
        item.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                toggleCategorySelection(item, category);
            }
        });
    });

    toggleAllCategories(true);
    extractBtn.disabled = selectedCategories.size === 0;
}

function toggleCategorySelection(item, category) {
    const isSelected = item.classList.toggle('selected');
    item.setAttribute('aria-checked', String(isSelected));
    if (isSelected) {
        selectedCategories.add(category);
    } else {
        selectedCategories.delete(category);
    }
    extractBtn.disabled = selectedCategories.size === 0;
}

function toggleAllCategories(select) {
    const items = categoryItemsContainer.querySelectorAll('.category-select-item');
    items.forEach(item => {
        const category = item.dataset.category;
        const isSelected = item.classList.contains('selected');
        if (select && !isSelected) {
            item.classList.add('selected');
            item.setAttribute('aria-checked', 'true');
            selectedCategories.add(category);
        } else if (!select && isSelected) {
            item.classList.remove('selected');
            item.setAttribute('aria-checked', 'false');
            selectedCategories.delete(category);
        }
    });
    extractBtn.disabled = selectedCategories.size === 0;
}

function generateResultsText(finalUniqueCount) {
    if (!extractedColorData || !imageStats) {
        resultsText.value = "Error: Missing data for results generation.";
        return;
    }

    let output = `# Colour Extraction Results\n\n`;
    output += `- Image Size: ${imageStats.width}x${imageStats.height} px\n`;
    output += `- Analysed Pixels (after potential bg removal): ${imageStats.totalPixels.toLocaleString()}\n`;
    output += `- Final Unique Colours (after deduplication): ${finalUniqueCount.toLocaleString()}\n`;
    output += `- Categories Selected: ${selectedCategories.size > 0 ? Array.from(selectedCategories).join(', ') : 'None'}\n`;
    output += `- Similarity Threshold: ${colorThreshold.value}\n`;
    output += `- Max Colours Per Category: ${maxColors.value}\n`;
    output += `- Background Removal: ${removeBgCheckbox.checked ? 'Enabled' : 'Disabled'}\n`;
    output += `- Gradient Detection: ${extractGradientsCheckbox.checked ? 'Enabled' : 'Disabled'}\n\n`;

    const categoryOrder = ['White', 'Grey', 'Black', 'Red', 'Pink', 'Pastel Pink', 'Orange', 'Pastel Orange', 'Yellow', 'Pastel Yellow', 'Green', 'Pastel Green', 'Cyan', 'Pastel Cyan', 'Blue', 'Pastel Blue', 'Purple', 'Pastel Purple', 'Magenta', 'Pastel Magenta', 'Brown', 'Gradients'];

    const sortedCategories = Object.keys(extractedColorData).sort((a, b) => {
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);
        const orderA = indexA === -1 ? 999 : indexA;
        const orderB = indexB === -1 ? 999 : indexB;
        if (orderA !== orderB) return orderA - orderB;
        return a.localeCompare(b);
    });

    sortedCategories.forEach(category => {
        const colours = extractedColorData[category];
        if (!colours || colours.length === 0) return;

        output += `## ${category} (${colours.length})\n\n`;
        if (category === 'Gradients') {
            output += `| Hex       | Decimal    | RGB               |\n`;
            output += `| :-------- | :--------- | :---------------- |\n`;
            colours.forEach(c => {
                const h = c.hex.padEnd(9);
                const d = c.decimal.toLocaleString().padEnd(10);
                const r = `(${c.rgb[0]}, ${c.rgb[1]}, ${c.rgb[2]})`.padEnd(18);
                output += `| ${h} | ${d} | ${r} |\n`;
            });
        } else {
            output += `| Hex       | Decimal    | RGB               | Percentage | Count      |\n`;
            output += `| :-------- | :--------- | :---------------- | :--------- | :--------- |\n`;
            colours.forEach(c => {
                const h = c.hex.padEnd(9);
                const d = c.decimal.toLocaleString().padEnd(10);
                const r = `(${c.rgb[0]}, ${c.rgb[1]}, ${c.rgb[2]})`.padEnd(18);
                const p = `${c.percentage}%`.padEnd(10);
                const n = c.count.toLocaleString().padEnd(10);
                output += `| ${h} | ${d} | ${r} | ${p} | ${n} |\n`;
            });
        }
        output += '\n';
    });

    resultsText.value = output;
}

function visualizeColors() {
    if (!colorGrid) return;
    colorGrid.innerHTML = '';

    if (!extractedColorData || Object.keys(extractedColorData).length === 0) {
        colorGrid.innerHTML = '<p>No colours extracted or selected. Go back to Upload, select categories and extract.</p>';
        return;
    }

    const categoryOrder = ['White', 'Grey', 'Black', 'Red', 'Pink', 'Pastel Pink', 'Orange', 'Pastel Orange', 'Yellow', 'Pastel Yellow', 'Green', 'Pastel Green', 'Cyan', 'Pastel Cyan', 'Blue', 'Pastel Blue', 'Purple', 'Pastel Purple', 'Magenta', 'Pastel Magenta', 'Brown', 'Gradients'];

    const sortedCategories = Object.keys(extractedColorData).sort((a, b) => {
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);
        const orderA = indexA === -1 ? 999 : indexA;
        const orderB = indexB === -1 ? 999 : indexB;
        if (orderA !== orderB) return orderA - orderB;
        return a.localeCompare(b);
    });

    let foundColours = false;
    sortedCategories.forEach(category => {
        const colours = extractedColorData[category];
        if (!colours || colours.length === 0) return;
        foundColours = true;

        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category';

        const title = document.createElement('div');
        title.className = 'category-title';
        title.textContent = `${category} (${colours.length})`;
        categoryDiv.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'color-grid';

        colours.forEach(c => {
            const box = document.createElement('div');
            box.className = 'color-box';

            const sample = document.createElement('div');
            sample.className = 'color-sample';
            sample.style.backgroundColor = c.hex;

            const overlay = document.createElement('div');
            overlay.className = 'hover-overlay';
            const hexDiv = document.createElement('div');
            hexDiv.textContent = 'Copy HEX';
            hexDiv.className = 'copy-hex-area';
            const decDiv = document.createElement('div');
            decDiv.textContent = 'Copy DEC';
            overlay.append(hexDiv, decDiv);
            sample.appendChild(overlay);

            sample.addEventListener('click', (event) => {
                const rect = sample.getBoundingClientRect();
                const clickX = event.clientX - rect.left;
                const width = sample.offsetWidth;

                if (clickX < width / 2) {
                    navigator.clipboard.writeText(c.hex)
                        .then(() => showToast(`Copied HEX: ${c.hex}!`))
                        .catch(err => { showToast('Copy failed.'); console.error(err); });
                } else {
                    navigator.clipboard.writeText(c.decimal.toString())
                        .then(() => showToast(`Copied DEC: ${c.decimal}!`))
                        .catch(err => { showToast('Copy failed.'); console.error(err); });
                }
            });

            const info = document.createElement('div');
            info.className = 'color-info';

            const hexVal = document.createElement('div');
            hexVal.className = 'color-hex';
            hexVal.textContent = c.hex;

            const details = document.createElement('div');
            details.className = 'color-details';
            if (category === 'Gradients') {
                details.textContent = `DEC: ${c.decimal.toLocaleString()} | RGB(${c.rgb.join(', ')})`;
            } else {
                details.textContent = `DEC: ${c.decimal.toLocaleString()} | RGB(${c.rgb.join(', ')}) | ${c.percentage}%`;
            }

            info.append(hexVal, details);
            box.append(sample, info);
            grid.appendChild(box);
        });

        categoryDiv.appendChild(grid);
        colorGrid.appendChild(categoryDiv);
    });

    if (!foundColours) {
        colorGrid.innerHTML = '<p>No colours found in the selected categories matching the criteria.</p>';
    }
}

// === Dark Mode ===
function applyInitialTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️';
    } else {
        document.documentElement.removeAttribute('data-theme');
        themeToggle.textContent = '🌙';
    }
}

function toggleTheme() {
    const isDark = document.documentElement.hasAttribute('data-theme');
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        themeToggle.textContent = '🌙';
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️';
        localStorage.setItem('theme', 'dark');
    }
}

// === Utility Functions ===
function copyResults() {
    if (!resultsText.value || resultsText.value.startsWith('No results') || resultsText.value.startsWith('Error:')) {
        showToast("Nothing to copy!");
        return;
    }
    navigator.clipboard.writeText(resultsText.value)
        .then(() => showToast("Results copied!"))
        .catch(err => { console.error('Copy failed:', err); showToast("Copy failed."); });
}

function saveResults() {
     if (!resultsText.value || resultsText.value.startsWith('No results') || resultsText.value.startsWith('Error:')) {
        showToast("Nothing to save!");
        return;
    }
    const blob = new Blob([resultsText.value], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    let filename = 'colour_results.md';
    if (fileInput && fileInput.files.length > 0) {
        const originalName = fileInput.files[0].name.replace(/\.[^/.]+$/, "");
        filename = `${originalName}_colours.md`;
    }
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Results saved as " + filename);
}

function showToast(message) {
    toast.textContent = message;
    toast.className = 'show';
    setTimeout(() => { toast.className = toast.className.replace('show', ''); }, 3000);
}

function showLoading(message = "Processing...") {
    loadingMessage.textContent = message;
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function getCategoryRepresentativeColor(cat) {
    const C = {
        'Red': '#FF0000', 'Pink': '#FFC0CB', 'Orange': '#FFA500', 'Yellow': '#FFFF00',
        'Green': '#008000', 'Cyan': '#00FFFF', 'Blue': '#0000FF', 'Purple': '#800080',
        'Magenta': '#FF00FF', 'Brown': '#A52A2A', 'White': '#FFFFFF', 'Grey': '#808080',
        'Black': '#000000', 'Pastel Pink': '#FFD1DC', 'Pastel Orange': '#FFD8B1',
        'Pastel Yellow': '#FFFACD', 'Pastel Green': '#98FB98', 'Pastel Cyan': '#AFEEEE',
        'Pastel Blue': '#ADD8E6', 'Pastel Purple': '#D8BFD8', 'Pastel Magenta': '#FFB6C1',
        'Gradients': '#CCCCCC'
    };
    return C[cat] || '#CCC';
}
