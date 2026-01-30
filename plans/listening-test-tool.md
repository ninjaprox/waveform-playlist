# Listening Test Tool

A modern web-based perceptual audio evaluation tool built on waveform-playlist, targeting MIR researchers conducting subjective listening experiments.

## Problem

Researchers running listening tests today choose between:

- **webMUSHRA** — Last updated 2020, Chrome-only, PHP backend, no waveform visualization
- **ReSEval** — Requires AWS, Mechanical Turk, MySQL. Heavy infrastructure for what's often a 20-participant study
- **Custom scripts** — Most researchers end up building one-off HTML pages from scratch

All lack waveform visualization, which is valuable for stem separation, source enhancement, and audio restoration research where seeing the signal matters.

## Product

A configurable listening test application built on `@waveform-playlist/browser`. Researchers define tests in a YAML/JSON config, deploy as a static site or with an optional lightweight backend for collecting responses.

## Differentiators

- **Waveform visualization** — See what you're hearing. Useful for stem separation, denoising, enhancement evaluation
- **Modern stack** — React, works in all browsers, no PHP
- **Simple deployment** — Static site export (GitHub Pages, Netlify) or optional Cloudflare Workers backend
- **Familiar config format** — YAML like webMUSHRA for easy migration
- **Mobile-friendly** — Responsive design, touch support

## Test Types

### MUSHRA (ITU-R BS.1534)
Multiple stimuli rated on a 0-100 scale with hidden reference and anchor. The standard for audio quality evaluation.

```yaml
type: mushra
reference: audio/ref.wav
anchor: audio/anchor.wav
conditions:
  - label: "Model A"
    file: audio/model_a.wav
  - label: "Model B"
    file: audio/model_b.wav
```

### MOS (Mean Opinion Score)
Single stimulus rated on a 1-5 scale. Common for TTS and speech enhancement.

```yaml
type: mos
scale:
  min: 1
  max: 5
  labels: ["Bad", "Poor", "Fair", "Good", "Excellent"]
stimuli:
  - file: audio/sample_01.wav
  - file: audio/sample_02.wav
```

### AB / ABX
Pairwise preference or discrimination tests.

```yaml
type: abx
pairs:
  - a: audio/original.wav
    b: audio/processed.wav
question: "Which sample has higher quality?"
```

### Likert Scale
Custom questionnaire pages between test sections for collecting qualitative feedback.

## Config Format

Single YAML file defines the entire experiment:

```yaml
experiment:
  name: "Stem Separation Evaluation 2025"
  description: "Evaluate vocal separation quality across models"
  investigator: "researcher@university.edu"

settings:
  randomize_conditions: true
  randomize_trials: true
  require_full_playback: true
  show_waveform: true
  allow_looping: true
  min_listening_time: 5  # seconds before rating enabled

pages:
  - type: introduction
    content: "welcome.md"

  - type: training
    description: "Familiarize yourself with the interface"
    reference: audio/training/ref.wav
    conditions:
      - file: audio/training/good.wav
        label: "High quality example"
      - file: audio/training/bad.wav
        label: "Low quality example"

  - type: mushra
    trials:
      - name: "Song 1"
        reference: audio/song1/ref.wav
        anchor: audio/song1/anchor.wav
        conditions:
          - { label: "Demucs", file: "audio/song1/demucs.wav" }
          - { label: "Open-Unmix", file: "audio/song1/openunmix.wav" }
          - { label: "HTDemucs", file: "audio/song1/htdemucs.wav" }

      - name: "Song 2"
        reference: audio/song2/ref.wav
        anchor: audio/song2/anchor.wav
        conditions:
          - { label: "Demucs", file: "audio/song2/demucs.wav" }
          - { label: "Open-Unmix", file: "audio/song2/openunmix.wav" }
          - { label: "HTDemucs", file: "audio/song2/htdemucs.wav" }

  - type: questionnaire
    questions:
      - text: "How familiar are you with source separation?"
        type: likert
        scale: ["Not at all", "Slightly", "Moderately", "Very", "Expert"]

  - type: finish
    content: "thank_you.md"

results:
  format: csv          # csv | json
  storage: local       # local | cloudflare | custom
```

## Architecture

```
┌─────────────────────────────────────────────┐
│  Static Build (GitHub Pages / Netlify)      │
│                                             │
│  Config (YAML) ──→ React App                │
│                    ├── Introduction page     │
│                    ├── Training page         │
│                    ├── Test pages (MUSHRA,   │
│                    │   MOS, ABX)             │
│                    │   └── waveform-playlist │
│                    ├── Questionnaire pages   │
│                    └── Results export        │
│                        ├── Local download    │
│                        └── POST to endpoint  │
└─────────────────────────────────────────────┘

Optional:
┌─────────────────────────────────────────────┐
│  Cloudflare Worker                          │
│  POST /results → validate → R2 storage     │
│  GET /results  → auth → CSV download        │
└─────────────────────────────────────────────┘
```

### Static-first

The default mode requires no backend. Results are downloaded as CSV/JSON at the end of the session. Researchers running small in-person studies (common in MIR) don't need infrastructure.

### Optional backend

For remote/crowdsourced studies, a Cloudflare Worker collects results. Simple API key auth. Could also integrate with Prolific or MTurk via redirect URLs with completion codes.

## Waveform Integration

The key feature competitors lack. Each test condition renders its waveform via `@waveform-playlist/browser`:

- **MUSHRA** — Stacked waveforms for all conditions, synced playback, solo/switch between them
- **Stem comparison** — Reference on top, conditions below, visual diff of what's missing/added
- **AB/ABX** — Side-by-side waveforms with instant switching
- **Toggle waveform** — Configurable per experiment (some researchers want blind tests)

## Implementation Phases

### Phase 1 — Core framework
- YAML config parser
- Page flow engine (introduction → training → tests → questionnaire → finish)
- MUSHRA test type with waveform visualization
- Randomization (conditions within trial, trials within test)
- Local CSV export
- CLI: `npx create-listening-test` scaffolds a new experiment

### Phase 2 — Additional test types
- MOS test type
- AB/ABX test type
- Likert questionnaire pages
- Markdown content pages (introduction, instructions, debrief)
- Progress bar and session persistence (resume interrupted tests)

### Phase 3 — Deployment options
- Static export: `npx listening-test build` → deploy anywhere
- Cloudflare Worker for result collection
- Prolific/MTurk integration (redirect URLs, completion codes)
- Participant ID management

### Phase 4 — Analysis & advanced features
- Results dashboard (built-in basic statistics, confidence intervals)
- Multi-annotator agreement metrics
- Batch audio loading with progress indication
- Configurable rating scales and custom UI
- Experiment templates (MUSHRA, MOS, ABX pre-configured)

## Existing Tools Comparison

| Feature | webMUSHRA | ReSEval | This tool |
|---------|-----------|---------|-----------|
| Last updated | 2020 | 2023 | New |
| Waveform visualization | No | No | Yes |
| Browser support | Chrome only | Modern browsers | Modern browsers |
| Backend required | PHP | AWS + MySQL | None (optional CF Worker) |
| Test types | MUSHRA, AB | MUSHRA, MOS, ABX | MUSHRA, MOS, AB, ABX |
| Config format | YAML | Python API | YAML |
| Crowdsource integration | No | MTurk | Prolific, MTurk |
| Media types | Audio | Audio, image, text, video | Audio |
| Mobile support | No | No | Yes |

## Package Structure

Could be a separate package or a standalone repo that depends on `@waveform-playlist/browser`:

```
@waveform-playlist/listening-test
├── src/
│   ├── config/          # YAML parser, validation
│   ├── pages/           # Page type components
│   ├── test-types/      # MUSHRA, MOS, ABX components
│   ├── results/         # Collection, export, submission
│   └── cli/             # create-listening-test scaffold
├── templates/           # Starter experiment configs
└── worker/              # Optional Cloudflare Worker
```

## Monetization

- **Open source core** — MUSHRA, MOS, ABX test types, local export, static deployment
- **Paid hosted backend** — Result collection, participant management, analysis dashboard
- **Paid templates** — Pre-configured experiments for common MIR evaluation scenarios (stem separation, TTS, enhancement)

## Open Questions

- **Scope**: Standalone repo or monorepo package? Standalone is simpler for researchers to find and use independently.
- **CLI vs GUI config**: Start with YAML files, but a visual experiment builder could be a paid feature later.
- **Audio hosting**: Should the tool help with hosting audio files (R2), or assume researchers serve their own?
- **Offline mode**: Lab settings often have restricted internet. Should the static build work fully offline?
- **webMUSHRA migration**: Offer a config converter from webMUSHRA YAML format to ease adoption?
