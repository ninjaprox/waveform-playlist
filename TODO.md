# TODO & Roadmap

Multi-track audio editor roadmap for waveform-playlist.

**Branch:** `main` | **Last Updated:** 2026-02-01

---

## 🎯 Current TODO

### Testing & CI

- [ ] **Unit tests** - Hooks, components, audio processing (Vitest + RTL)
- [ ] **Browser compatibility** - Chrome, Firefox, Safari, Edge
- [ ] **CI/CD pipeline** - Automated builds, tests, publishing

### API Parity

- [ ] Add `renderPlayhead` prop to `MediaElementWaveform` (already exists in `Waveform`)

### Nice to Have

- [ ] Migration guide from v4
- [ ] Contributing guidelines
- [ ] Bundle size monitoring
- [ ] Performance benchmarks
- [ ] Memory leak testing

---

## 🔮 Future Phases

### Phase 3.4-3.5: Copy/Paste & Multi-Select

- Clipboard operations (Cmd+C/X/V)
- Multi-select with Cmd+Click, Shift+Click
- Bulk drag/delete
- Selection toolbar

### Phase 4: Performance & Virtual Scrolling

- Horizontal virtual scrolling (2+ hour timelines)
- Vertical virtual scrolling (20+ tracks)
- RAF batching
- Canvas stitching

### Phase 5: Polish & Usability

- Undo/redo (command pattern)
- Snap to grid
- Keyboard shortcuts help overlay
- Re-render spectrograms on tab visibility change (OffscreenCanvas buffers can be cleared by browser when tab is backgrounded)
- Accessibility (ARIA, focus management)
- Context menus

### Future Considerations

- Clip grouping
- Automation lanes
- Markers and regions
- MIDI/video sync
- Sticky clip header text (Intersection Observer to keep track name visible when scrolling)
- Revamp GitHub Sponsors tiers (via GitHub UI)

---

## ✅ Completed Features

### Core (Phase 1)

- WaveformPlaylistProvider with React Context
- Playback with Tone.js (play, pause, stop, seek)
- Waveform rendering with Canvas
- Track controls (mute, solo, volume, pan)
- Selection and time formatting
- Automatic scrolling
- GPU-accelerated playhead animation
- Theming system

### Recording

- AudioWorklet-based recording
- VU meter with AnalyserNode
- Live waveform during recording
- Integrated multi-track recording (Audacity-style)
- Recording-optimized audio constraints

### Clip-Based Model (Phase 2)

- Multiple clips per track
- Sample-based architecture (integer samples, not float seconds)
- File-reference loading pattern
- Gaps between clips render as silence

### Drag & Trim (Phase 3.1)

- Drag clip headers to move
- Drag boundaries to trim (bidirectional)
- Real-time collision detection
- `useClipDragHandlers` hook

### Splitting (Phase 3.3)

- Split clips at playhead with 'S' key
- `useClipSplitting` hook
- `useKeyboardShortcuts` hook
- Track selection system

### Effects

- 20 Tone.js effects with UI
- Runtime parameter modification
- Effect bypass with wet preservation
- WAV export includes effects
- `useDynamicEffects` / `useTrackDynamicEffects` hooks

### Export

- WAV export via Tone.Offline
- Master + per-track effects support
- Export all tracks as ZIP
- `useExportWav` hook

### Documentation

- Docusaurus site with 16 examples
- Storybook with 31 story files
- Guides: effects, fades, waveform-data
- Dark/light theme support

### Other

- Annotations package (optional)
- Spectrogram package (optional, decoupled via `SpectrogramIntegrationContext`)
- BBC waveform-data.js support (clip-level `waveformData` prop with resample/slice)
- Custom playhead component (`renderPlayhead` prop)
- Annotation keyboard navigation
- Simplified Fade API (`{duration, type?}`)
- Audacity-style loop playback (separate loop region from selection, timescale-only UI)
- Sample-based peaks generation (no floating-point precision errors)
- NPM publishing setup with tree-shaking verification
- Comprehensive README
- TypeScript types validation (no `any` in public APIs)
- E2E tests with Playwright
