import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';
import { AudioCredits } from '../../components/AudioCredits';

const LazyMediaElementExample = createLazyExample(
  () => import('../../components/examples/MediaElementExample').then(m => ({ default: m.MediaElementExample }))
);

export default function MediaElementExamplePage(): React.ReactElement {
  return (
    <Layout
      title="Media Element Playout Example"
      description="Single-track playback with pitch-preserving playback rate control using HTMLAudioElement"
    >
      <Head>
        <meta property="og:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-media-element.png" />
        <meta name="twitter:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-media-element.png" />
      </Head>
      <main className="container margin-vert--lg">
        <h1>Media Element Playout</h1>
        <p style={{ marginBottom: '1rem' }}>
          Single-track playback using <code>HTMLAudioElement</code> instead of Tone.js.
          Streams audio without downloading the entire file, with pitch-preserving playback rate control.
        </p>

        <LazyMediaElementExample />

        <div style={{ marginTop: '2rem' }}>
          <h2>When to Use Media Element Playout</h2>
          <p>
            Choose <code>MediaElementPlaylistProvider</code> over <code>WaveformPlaylistProvider</code> when you need:
          </p>
          <ul>
            <li><strong>Large audio files</strong> - streams audio without downloading the entire file first</li>
            <li><strong>Pre-computed peaks</strong> - use <a href="https://github.com/bbc/audiowaveform">audiowaveform</a> to generate peaks server-side</li>
            <li><strong>Playback rate control</strong> - 0.5x to 2.0x speed with pitch preservation</li>
            <li><strong>Single-track playback</strong> - simpler API, smaller bundle</li>
          </ul>

          <p>
            Use <code>WaveformPlaylistProvider</code> (Tone.js) when you need:
          </p>
          <ul>
            <li><strong>Multi-track mixing</strong> - multiple tracks playing in sync</li>
            <li><strong>Audio effects</strong> - reverb, delay, EQ, etc.</li>
            <li><strong>Precise timing</strong> - sample-accurate scheduling</li>
            <li><strong>Recording</strong> - capture audio input</li>
          </ul>

          <h3>Basic Usage</h3>
          <pre style={{
            background: 'var(--ifm-code-background)',
            padding: '1rem',
            borderRadius: '4px',
            overflow: 'auto',
          }}>
{`import {
  MediaElementPlaylistProvider,
  useMediaElementAnimation,
  useMediaElementControls,
  MediaElementWaveform,
  loadWaveformData,
} from '@waveform-playlist/browser';

function MyPlayer() {
  const [waveformData, setWaveformData] = useState(null);

  useEffect(() => {
    loadWaveformData('/peaks/audio.dat').then(setWaveformData);
  }, []);

  if (!waveformData) return <div>Loading...</div>;

  return (
    <MediaElementPlaylistProvider
      track={{
        source: '/audio/track.mp3',
        waveformData,
        name: 'My Track',
      }}
      samplesPerPixel={512}
      waveHeight={100}
    >
      <PlaybackControls />
      <MediaElementWaveform />
    </MediaElementPlaylistProvider>
  );
}

function PlaybackControls() {
  const { isPlaying, currentTime } = useMediaElementAnimation();
  const { play, pause, setPlaybackRate } = useMediaElementControls();

  return (
    <div>
      <button onClick={() => play()} disabled={isPlaying}>Play</button>
      <button onClick={() => pause()} disabled={!isPlaying}>Pause</button>
      <button onClick={() => setPlaybackRate(0.5)}>0.5x</button>
      <button onClick={() => setPlaybackRate(1)}>1x</button>
      <button onClick={() => setPlaybackRate(2)}>2x</button>
    </div>
  );
}`}
          </pre>
        </div>

        <AudioCredits track="ubiquitous" />
      </main>
    </Layout>
  );
}
