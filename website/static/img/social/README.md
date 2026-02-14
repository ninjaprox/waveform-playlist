# Social Sharing Images

Place screenshots here for social media sharing (Open Graph / Twitter Cards).

## Required Images

All images are **2400x1260 pixels** (2x Retina, 2:1 aspect ratio) for optimal display on social platforms.

### Main Site
- `waveform-playlist-social.png` - Main site social card (used as default for homepage and docs)

### Examples Index Page
- `waveform-playlist-examples.png` - Examples gallery page

### Individual Example Pages
| Filename | Page |
|----------|------|
| `example-minimal.png` | Minimal - Basic waveform display |
| `example-styling.png` | Styling - Custom colors and gradients |
| `example-newtracks.png` | New Tracks - Dynamic track management |
| `example-stem-tracks.png` | Stem Tracks - Multi-track with controls |
| `example-fades.png` | Fades - Fade curve types comparison |
| `example-effects.png` | Effects - 20+ audio effects demo |
| `example-recording.png` | Recording - Live microphone recording |
| `example-multi-clip.png` | Multi-Clip - Drag & drop editing |
| `example-annotations.png` | Annotations - Time-synced text labels |
| `example-waveform-data.png` | BBC Waveform - Pre-computed peaks |
| `example-flexible-api.png` | Flexible API - Custom UI hooks |
| `example-stereo.png` | Stereo - L/R channel waveforms |
| `example-mobile-multi-clip.png` | Mobile Multi-Clip - Touch-optimized editing |
| `example-mobile-annotations.png` | Mobile Annotations - Touch annotation editing |
| `example-media-element.png` | Media Element - HTMLAudioElement playback |
| `example-mir-spectrogram.png` | MIR Spectrogram - Frequency-domain visualization |

## Tips for Screenshots

1. **Use dark mode** - Matches the site's night vision aesthetic
2. **1200x630 pixels** - Optimal for Twitter and Open Graph
3. **Show the waveform** - The visual centerpiece of each example
4. **Include UI context** - Show some controls to convey interactivity
5. **Capture key features** - Effects panel, recording VU meter, annotations overlay, etc.

## Image Generation

Screenshots are taken with Playwright using a dedicated browser context:

```js
const context = await browser.newContext({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 2,
  colorScheme: 'dark'
});
```

This produces 2400x1260 retina PNGs in dark mode. Each page waits for
`[data-playlist-state="ready"]` before capture (except pages without playlists).
