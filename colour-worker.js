/**
 * Colour Worker - Handles heavy image processing off the main thread.
 */

self.addEventListener('message', (e) => {
    const { type, imageData, options } = e.data;

    try {
        if (!imageData || !imageData.data || !imageData.width || !imageData.height) {
             throw new Error("Invalid imageData received in worker.");
        }

        if (type === 'analyse') {
            const result = performAnalysis(imageData, options);
            self.postMessage({ type: 'analysisComplete', data: result });
        } else if (type === 'extract') {
            const result = performExtraction(imageData, options);
            self.postMessage({ type: 'extractionComplete', data: result });
        } else {
            console.warn("Unknown task type received in worker:", type);
        }
    } catch (error) {
        console.error("Error in worker processing:", error);
        self.postMessage({ type: 'error', error: error.message || "An unknown error occurred in the worker." });
    }
});



/**
 * Initial analysis to get counts and categories.
 */
function performAnalysis(imageData, options) {
    const { pixels, totalPixelCount, rawColorCounts, categoryCounts } = countPixels(imageData, options.removeBg);
    const rawUniqueColors = Array.from(rawColorCounts.keys()).map(keyToRgb);
    const estimatedUniqueCount = estimateDeduplicatedColors(rawUniqueColors, options.threshold);

    return {
        totalPixelCount: totalPixelCount,
        rawColorCount: rawColorCounts.size,
        estimatedUniqueCount: estimatedUniqueCount,
        categoryCounts: categoryCounts
    };
}

/**
 * Extracts colours based on selected categories and options.
 */
function performExtraction(imageData, options) {
    const { pixels, totalPixelCount, rawColorCounts } = countPixels(imageData, options.removeBg, options.selectedCategories);

    let colorsToProcess = Array.from(rawColorCounts.entries()).map(([key, count]) => {
        const rgb = keyToRgb(key);
        return {
            rgb: rgb,
            hex: rgbToHex(rgb[0], rgb[1], rgb[2]),
            decimal: rgbToDecimal(rgb[0], rgb[1], rgb[2]),
            count: count
        };
    });

    colorsToProcess.sort((a, b) => b.count - a.count);

    const { deduplicatedColors } = deduplicateAndAggregate(colorsToProcess, options.threshold);

    let categorizedResults = categorizeAndLimit(deduplicatedColors, options.selectedCategories, options.maxColorsPerCategory, totalPixelCount);

    let detectedGradients = [];
    if (options.extractGradients) {
        detectedGradients = detectGradients(imageData, options.threshold);
        if (detectedGradients.length > 0) {
            categorizedResults['Gradients'] = detectedGradients.slice(0, options.maxColorsPerCategory * 2);
        }
    }

    let finalUniqueCount = 0;
    Object.values(categorizedResults).forEach(arr => finalUniqueCount += arr.length);


    return {
        categorizedResults: categorizedResults,
        finalUniqueCount: finalUniqueCount
    };
}



/**
 * Iterates through pixels, counts colours, and optionally categorises.
 * Returns pixel data array, total count, raw counts map, and category counts object.
 */
function countPixels(imageData, removeBg = false, filterCategories = null) {
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const rawColorCounts = new Map();
    const categoryCounts = {};
    let totalPixelCount = 0;
    const selectedCategorySet = filterCategories ? new Set(filterCategories) : null;

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        if (a < 128) continue;
        if (removeBg && r > 240 && g > 240 && b > 240) continue;

        totalPixelCount++;
        const key = `${r},${g},${b}`;

        const category = getColorCategory(r, g, b);

        if (selectedCategorySet) {
            if (selectedCategorySet.has(category)) {
                rawColorCounts.set(key, (rawColorCounts.get(key) || 0) + 1);
            }
        } else {
            rawColorCounts.set(key, (rawColorCounts.get(key) || 0) + 1);
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        }
    }

    return { pixels, totalPixelCount, rawColorCounts, categoryCounts };
}



/**
 * Estimates unique colours after deduplication using sampling.
 */
function estimateDeduplicatedColors(uniqueRawColors, threshold) {
    if (uniqueRawColors.length === 0) return 0;

    const sampleSize = Math.min(uniqueRawColors.length, 500);
    const sample = uniqueRawColors.length <= sampleSize
        ? uniqueRawColors
        : uniqueRawColors.sort(() => 0.5 - Math.random()).slice(0, sampleSize);

    let distinctCountInSample = 0;
    const keptColorsInSample = [];

    for (const color of sample) {
        let isSimilar = false;
        for (const keptColor of keptColorsInSample) {
            if (colorDistance(color, keptColor) < threshold) {
                isSimilar = true;
                break;
            }
        }
        if (!isSimilar) {
            keptColorsInSample.push(color);
            distinctCountInSample++;
        }
    }

    const distinctRatio = sample.length > 0 ? distinctCountInSample / sample.length : 1;
    const estimatedTotalDistinct = Math.round(uniqueRawColors.length * distinctRatio);

    return Math.max(1, estimatedTotalDistinct);
}

/**
 * Merges similar colours based on threshold and aggregates counts.
 */
function deduplicateAndAggregate(sortedColors, threshold) {
    const deduplicated = [];
    const thresholdSq = threshold * threshold;

    for (const currentColor of sortedColors) {
        let foundSimilar = false;
        for (const existingColor of deduplicated) {
            if (colorDistanceSquared(currentColor.rgb, existingColor.rgb) < thresholdSq) {
                existingColor.count += currentColor.count;
                foundSimilar = true;
                break;
            }
        }
        if (!foundSimilar) {
             deduplicated.push({ ...currentColor });
        }
    }

    deduplicated.sort((a, b) => b.count - a.count);

    return { deduplicatedColors: deduplicated };
}

/**
 * Assigns colours to categories and limits the number per category.
 */
function categorizeAndLimit(deduplicatedColors, selectedCategories, maxPerCategory, totalPixelCount) {
    const results = {};
    selectedCategories.forEach(cat => { results[cat] = []; });

    deduplicatedColors.forEach(color => {
        const category = getColorCategory(color.rgb[0], color.rgb[1], color.rgb[2]);
        if (results[category] && results[category].length < maxPerCategory) {
            color.percentage = (color.count / totalPixelCount * 100).toFixed(2);
            results[category].push(color);
        }
    });


    return results;
}

/**
 * Experimental: Detects potential gradient start/end colours.
 * Looks for significant colour changes between adjacent pixels.
 */
function detectGradients(imageData, threshold) {
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const gradients = new Map();
    const thresholdSq = threshold * threshold;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width - 1; x++) {
            const i = (y * width + x) * 4;
            const iNext = (y * width + (x + 1)) * 4;

            const rgb1 = [pixels[i], pixels[i+1], pixels[i+2]];
            const rgb2 = [pixels[iNext], pixels[iNext+1], pixels[iNext+2]];
            const alpha1 = pixels[i+3];
            const alpha2 = pixels[iNext+3];

            if (alpha1 < 128 || alpha2 < 128) continue;

            if (colorDistanceSquared(rgb1, rgb2) > thresholdSq) {
                const key1 = `${rgb1[0]},${rgb1[1]},${rgb1[2]}`;
                const key2 = `${rgb2[0]},${rgb2[1]},${rgb2[2]}`;
                 gradients.set(key1, (gradients.get(key1) || 0) + 1);
                 gradients.set(key2, (gradients.get(key2) || 0) + 1);
            }
        }
    }

    const gradientList = Array.from(gradients.entries())
        .sort(([, countA], [, countB]) => countB - countA)
        .map(([key, count]) => {
            const rgb = keyToRgb(key);
            return {
                rgb: rgb,
                hex: rgbToHex(rgb[0], rgb[1], rgb[2]),
                decimal: rgbToDecimal(rgb[0], rgb[1], rgb[2]),
                count: count,
                percentage: 'N/A'
            };
        });

    return gradientList;
}



function keyToRgb(key) {
    return key.split(',').map(Number);
}

function colorDistance(rgb1, rgb2) {
    if (!rgb1 || !rgb2 || rgb1.length !== 3 || rgb2.length !== 3) return Infinity;
    let dr = rgb1[0] - rgb2[0];
    let dg = rgb1[1] - rgb2[1];
    let db = rgb1[2] - rgb2[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

function colorDistanceSquared(rgb1, rgb2) {
    if (!rgb1 || !rgb2 || rgb1.length !== 3 || rgb2.length !== 3) return Infinity;
    let dr = rgb1[0] - rgb2[0];
    let dg = rgb1[1] - rgb2[1];
    let db = rgb1[2] - rgb2[2];
    return dr * dr + dg * dg + db * db;
}

function rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).padStart(6, '0');
}

function rgbToDecimal(r, g, b) {
    return (r << 16) + (g << 8) + b;
}

function hexToRgb(hex) {
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });

    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : [0, 0, 0];
}


function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h, s, l];
}

function getColorCategory(r, g, b) {
    const [h, s, l] = rgbToHsl(r, g, b);

    if (l < 0.10) return 'Black';
    if (l > 0.95) return 'White';
    if (s < 0.10) return 'Grey';

    const hue = h * 360;

    const isPastel = l > 0.70 && s < 0.65;

    if (l < 0.6 && s < 0.7 && hue >= 15 && hue < 45) return 'Brown';
    if (l < 0.4 && s < 0.7 && (hue < 25 || hue >= 340)) return 'Brown';


    if (hue < 18 || hue >= 340) return isPastel ? 'Pastel Pink' : 'Red';
    if (hue < 45)  return isPastel ? 'Pastel Orange' : 'Orange';
    if (hue < 70)  return isPastel ? 'Pastel Yellow' : 'Yellow';
    if (hue < 160) return isPastel ? 'Pastel Green' : 'Green';
    if (hue < 200) return isPastel ? 'Pastel Cyan' : 'Cyan';
    if (hue < 260) return isPastel ? 'Pastel Blue' : 'Blue';
    if (hue < 300) return isPastel ? 'Pastel Purple' : 'Purple';
    if (hue < 340) return isPastel ? 'Pastel Magenta' : 'Magenta';

    return 'Red';
}