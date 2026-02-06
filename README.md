# Lightbox Image Viewer

A modern web-based image viewer for browsing and comparing images from your local filesystem. Built with Vue 3, TypeScript, and Tailwind CSS.

## Features

- 📁 **Local Folder Access** - Open any folder from your computer using the File System Access API
- 🎞️ **Filmstrip View** - Browse all images in a convenient horizontal filmstrip
- 🖼️ **Smart Layout** - Selected images are automatically arranged to optimally fill your viewport
- 🔍 **Zoom & Pan** - Zoom and pan individual images for detailed comparison
- ⌨️ **Multi-Select** - Select multiple images with click, Ctrl+click, and Shift+click
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

Open http://localhost:5173 in Chrome or Edge.

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
   - **Shift + click** - Select a range
5. Selected images are displayed below with smart layout
6. Hover over images to see controls:
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
- **FolderSelector** - Folder picker using File System Access API
- **Filmstrip** - Thumbnail view with selection handling
- **ImageViewer** - Container for selected images
- **ImagePane** - Individual image with zoom/pan controls

The smart layout algorithm (`layoutAlgorithm.ts`) calculates optimal grid configurations by testing different row/column combinations and scoring them based on space utilization and aspect ratio preservation.

## Development

This project uses:
- TypeScript in strict mode
- Vue 3 Composition API with `<script setup>`
- Component-level state management (no Pinia)
- Reactive state with `ref()` and `computed()`

See `.github/copilot-instructions.md` for detailed development guidelines.

## License

ISC
