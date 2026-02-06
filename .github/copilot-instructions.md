# Copilot Instructions for Lightbox

## Project Overview

Lightbox is a single-page Vue.js application for viewing and comparing images from local folders. It uses the File System Access API (Chromium browsers only) to allow users to open a folder, view images in a filmstrip, and display selected images in a smart layout optimized for comparison.

## Build, Test, and Lint Commands

```bash
# Install dependencies
npm install

# Development server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture

### Component Structure
```
App.vue (main state: images, selection)
├── FolderSelector.vue - Opens folders via File System Access API
├── Filmstrip.vue - Displays thumbnails with multi-select
└── ImageViewer.vue - Shows selected images in smart layout
    └── ImagePane.vue - Individual image with zoom/pan controls
```

### Key Composables
- `useImageLoader` - Loads images from Files, creates object URLs, calculates aspect ratios
- `useSmartLayout` - Calculates optimal grid layout based on viewport and image aspect ratios

### State Management
- Component state only (no Pinia)
- Main state lives in App.vue
- Props/emits for parent-child communication
- Image URLs created with `createObjectURL` and cleaned up on unmount

### Smart Layout Algorithm
Located in `src/utils/layoutAlgorithm.ts`. Algorithm:
1. Tries different grid configurations (1×N, 2×N, 3×N, etc.)
2. For each grid, calculates how images fit while maintaining aspect ratios
3. Scores layouts based on space utilization
4. Returns best-scoring layout with positions for each image

## Key Conventions

### TypeScript
- Strict mode enabled
- Type definitions in `src/types/index.ts`
- Global type augmentations in `src/types/global.d.ts` for File System Access API

### Vue
- Composition API with `<script setup>`
- TypeScript props/emits using type generics
- Reactive state with `ref()` and `computed()`

### Image Selection
- Single click: select only that image
- Ctrl/Cmd + click: toggle image in selection
- Shift + click: select range from last selected to clicked

### Zoom/Pan
- Mouse wheel: zoom in/out
- Click and drag: pan image
- Independent zoom/pan state per image for comparison

## Technology Stack

- **Framework**: Vue 3.5+ (Composition API)
- **Build Tool**: Vite 7.3+
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 4.1+
- **Browser API**: File System Access API (Chrome 86+, Edge 86+)

## Browser Compatibility

**Supported**: Chrome 86+, Edge 86+, Opera 72+

**Not Supported**: Firefox, Safari (File System Access API not available)

The app detects browser support and shows a warning message if the API is unavailable.

## Development Notes

### Performance Considerations
- Object URLs are created for all images in folder (memory usage)
- Layout recalculation is debounced (150ms) on window resize
- Consider adding virtual scrolling if filmstrip has 100+ images

### File System Access API
- Requires user gesture (button click) to trigger `showDirectoryPicker()`
- Only reads files, does not write
- Filters to image MIME types automatically
- Files are sorted alphabetically by name

### Cleanup
- Object URLs must be revoked when images are no longer needed
- Cleanup happens when new folder is opened or on component unmount

