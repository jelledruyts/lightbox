# Lightbox Image Viewer

A modern web-based image viewer for browsing, comparing, sorting, and triaging images from your local filesystem. Built with Vue 3, TypeScript, Vite, and Tailwind CSS.

## Features

- 📁 **Local Folder Access** - Open any folder from your computer using the File System Access API
- 🔄 **Reload Support** - Reload the currently opened folder without reopening it
- 🎞️ **Multiple View Modes** - Switch between compare, grid, and detail views
- 🖼️ **Smart Layout** - Selected images are automatically arranged to optimally fill your viewport
- 🔍 **Zoom & Pan** - Zoom and pan individual images for detailed comparison
- ⌨️ **Multi-Select** - Select multiple images with click, Ctrl/Cmd + click, Shift + click, and keyboard navigation
- ↕️ **Resizable Filmstrip** - Adjust the filmstrip height to change thumbnail size
- 🗂️ **Sorting & Filtering** - Sort by date taken or filename, filter by triage state, and filter by camera model when multiple models are present
- ✅ **Image Triage** - Mark images as accepted, rejected, or untriaged with undo/redo support
- 💾 **State Export/Import** - Export sort, filter, camera filter, and triage state to JSON and import it on another machine
- 📐 **Aspect Ratio Aware** - Layout algorithm considers image dimensions for best fit

## Browser Requirements

This application requires the **File System Access API**, which is currently only available in:
- Chrome 86+
- Edge 86+
- Opera 72+

⚠️ **Not supported**: Firefox, Safari

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:5174 in Chrome or Edge.

### Production Build

```bash
npm run build
npm run preview
```

## Usage

1. Click **"Open Folder"** to select a folder containing images
2. Images appear in the filmstrip at the top
3. The first image is selected by default
4. Click images to select them:
    - **Single click** - Select only that image
    - **Ctrl/Cmd + click** - Add/remove from selection
    - **Shift + click** - Select a visible range
5. Use the toolbar to:
    - **Sort** by date taken or filename
    - **Filter** by accepted, untriaged, or rejected state
    - **Filter by camera model** when multiple models exist in the folder
    - **Switch view modes** between compare, grid, and detail
    - **Export or import** folder state as JSON
6. Selected images are displayed in the active view mode
7. Hover over images to see controls:
    - Use **+/−** buttons or **mouse wheel** to zoom
    - **Click and drag** to pan
    - **⟲** to reset view

## Technology Stack

- **Vue 3** - Composition API with TypeScript
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **File System Access API** - Browser API for local file access

## Architecture

The app uses a simple component-based architecture:

- **App.vue** - Main app with state management
- **Toolbar** - Folder actions, import/export, and top-level controls
- **Filmstrip** - Thumbnail strip with selection handling and wheel scrolling
- **ImageThumbnail** - Thumbnail rendering with sequence and triage indicators
- **ImageViewer** - Compare view container for selected images
- **ImagePane** - Individual large-image pane with zoom/pan, metadata, and triage controls
- **ToolbarSelect / ToolbarMultiSelect** - Reusable toolbar inputs for sort and camera-model filters

The smart layout algorithm (`layoutAlgorithm.ts`) calculates optimal grid configurations by testing different row/column combinations and scoring them based on space utilization and aspect ratio preservation.

## Development

This project uses:
- TypeScript in strict mode
- Vue 3 Composition API with `<script setup>`
- Component-level state management (no Pinia)
- Reactive state with `ref()` and `computed()`

See `.github/copilot-instructions.md` for detailed development guidelines.

## License

This project is licensed under the [MIT License](LICENSE).
