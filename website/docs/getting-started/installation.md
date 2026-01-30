---
sidebar_position: 1
description: "Install Waveform Playlist packages via npm or pnpm for React multitrack audio editing"
---

# Installation

## Package Manager

Install the main package and its required peer dependencies:

```bash npm2yarn
npm install @waveform-playlist/browser tone @dnd-kit/core @dnd-kit/modifiers
```

If you already have React and styled-components in your project, you're ready to go!

## Peer Dependencies

Waveform Playlist requires the following peer dependencies:

```bash npm2yarn
npm install react react-dom styled-components tone @dnd-kit/core @dnd-kit/modifiers
```

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.0.0 | UI framework |
| `react-dom` | ^18.0.0 | React DOM rendering |
| `styled-components` | ^6.0.0 | CSS-in-JS styling |
| `tone` | ^15.0.0 | Web Audio framework |
| `@dnd-kit/core` | ^6.0.0 | Drag and drop for clip/annotation editing |
| `@dnd-kit/modifiers` | ^9.0.0 | Drag modifiers (horizontal axis constraint) |

## Additional Packages

Depending on your needs, you may want to install additional packages:

### Annotations

For time-synchronized annotations:

```bash npm2yarn
npm install @waveform-playlist/annotations
```

### Recording

For microphone recording:

```bash npm2yarn
npm install @waveform-playlist/recording
```

## TypeScript

All packages include TypeScript definitions. No additional `@types` packages are needed.

## CDN Usage

For quick prototyping, you can use the UMD build from a CDN:

```html
<script src="https://unpkg.com/@waveform-playlist/browser/dist/index.umd.js"></script>
```

Note: CDN usage is not recommended for production applications.

## Next Steps

- [Basic Usage](/docs/getting-started/basic-usage) - Create your first playlist
