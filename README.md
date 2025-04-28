# Colour Extraction Tool

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md) <!-- Links to your LICENSE file -->

An enhanced web-based tool to extract, analyse, and visualise colours from images using Web Workers for improved performance.

**Live Demo:** [https://fisventurous.github.io/colour-extraction-tool/](https://fisventurous.github.io/colour-extraction-tool/)

---

https://github.com/user-attachments/assets/b686b04d-30e1-4621-9179-0ae6fa925abf

---

## Features

*   **Image Upload:** Drag & drop or browse for local image files (JPG, PNG, GIF, etc.).
*   **Initial Analysis:** Quickly view total pixels, raw unique colours, and an *estimated* unique count after basic deduplication.
*   **Colour Distribution:** See a visual breakdown of the main colour categories present.
*   **Extraction Options:**
    *   Adjust the **Colour Similarity Threshold** to control how similar colours are merged.
    *   Set the **Maximum Colours Per Category** to limit results.
    *   Optionally **remove near-white/transparent backgrounds**.
    *   Experimentally **detect colours at sharp transitions** (edges/gradients).
*    **Category Selection:** Choose which specific colour categories (Reds, Blues, Pastels, etc.) you want to extract.
*    **Detailed Results:** Get extracted colours listed in Markdown format, including HEX, Decimal, RGB, Pixel Count, and Percentage.
*    **Visualisation Grid:** View extracted colours neatly organised by category in an interactive grid.
*    **Interactive Colour Picker:** Hover over the preview image to see live colour details (HEX/RGB) in a tooltip and click to copy the HEX code.
*    **Dark/Light Mode:** Toggle between themes for your viewing preference.
*    **Copy & Save:** Easily copy the Markdown results or save them as a `.md` file.
*    **Web Worker Powered:** Image analysis and extraction run in the background for a smoother UI experience.

## How to Use

1.  **Upload:** Drag an image onto the drop zone or click to browse.
2.  **Analyse:** Wait for the initial analysis (pixel counts, distribution).
3.  **(Optional) Toggle Picker:** Click the "Toggle Colour Picker" button to enable hover/click colour copying on the preview.
4.  **Configure:** Adjust the Threshold, Max Colours, and other options as needed. Select/deselect colour categories to extract.
5.  **Extract:** Click "Extract Selected Colours".
6.  **View:** Check the "Results" tab for the Markdown output or the "Colour Grid" tab for the visual display. Use the Copy/Save buttons as needed.

## Running Locally

Because this tool uses Web Workers for processing, you need to run it from a local web server due to browser security restrictions (`file:///` protocol won't work).

1.  Clone the repository:
    ```bash
    git clone https://github.com/fisventurous/colour-extraction-tool.git
    cd colour-extraction-tool
    ```
2.  Start a simple local server. Examples:
    *   **Using Python 3:**
        ```bash
        python -m http.server
        ```
    *   **Using VS Code Live Server:** Install the **Live Server** extension from the VS Code marketplace, then right-click on `index.html` and select "Open with Live Server". This will launch the project on a local server for easy testing and viewing directly in your browser.
    *   **Using Node.js `http-server`:**
        ```bash
        npm install --global http-server # If not already installed
        http-server
        ```
3.  Open your browser to the local address provided (e.g., `http://localhost:8000` or `http://127.0.0.1:8080`).

## Technology Stack

*   HTML5
*   CSS3 (including CSS Variables for theming)
*   Vanilla JavaScript (ES6+)
*   Web Workers API

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
