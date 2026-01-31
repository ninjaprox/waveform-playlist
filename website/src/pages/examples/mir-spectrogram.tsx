import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';
import { AudioCredits } from '../../components/AudioCredits';

const LazyMirSpectrogramExample = createLazyExample(
  () => import('../../components/examples/MirSpectrogramExample').then(m => ({ default: m.MirSpectrogramExample }))
);

export default function MirSpectrogramPage(): React.ReactElement {
  return (
    <Layout
      title="MIR Spectrogram - Audio Spectral Analysis & Visualization"
      description="Interactive spectrogram visualization for music information retrieval (MIR). Configure FFT size, window functions (Hann, Hamming, Blackman), frequency scales (mel, bark, ERB), and perceptually uniform color maps."
    >
      <Head>
        <meta property="og:title" content="MIR Spectrogram - Audio Spectral Analysis & Visualization" />
        <meta property="og:description" content="Interactive spectrogram visualization for music information retrieval (MIR). Configure FFT size, window functions, frequency scales (mel, bark, ERB), and perceptually uniform color maps." />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-mir-spectrogram.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="MIR Spectrogram - Audio Spectral Analysis & Visualization" />
        <meta name="twitter:description" content="Interactive spectrogram visualization for music information retrieval (MIR). Configure FFT size, window functions, frequency scales (mel, bark, ERB), and perceptually uniform color maps." />
        <meta name="twitter:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-mir-spectrogram.png" />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Waveform Playlist MIR Spectrogram',
            description: 'Interactive spectrogram visualization tool for music information retrieval with configurable FFT, window functions, frequency scales, and color maps.',
            applicationCategory: 'MultimediaApplication',
            operatingSystem: 'Any',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
            featureList: [
              'Configurable FFT size (256 to 16384)',
              'Six window functions (Hann, Hamming, Blackman, Blackman-Harris, Bartlett, Rectangular)',
              'Five frequency scales (Linear, Logarithmic, Mel, Bark, ERB)',
              'Six perceptually uniform color maps',
              'Real-time audio playback with spectrogram overlay',
              'Adjustable dB range and gain',
              'Hop size control',
              'Zero padding',
            ],
          })}
        </script>
      </Head>
      <main className="container margin-vert--lg">
        <h1>MIR Spectrogram</h1>
        <p style={{ marginBottom: '2rem' }}>
          Frequency-domain visualization for music information retrieval. Configure FFT parameters,
          window functions, frequency scales, and color maps per track.
        </p>

        <LazyMirSpectrogramExample />

        <div style={{ marginTop: '2rem' }}>
          <h2>Window Functions</h2>
          <p>
            Window functions shape the analysis frame before the FFT, controlling the trade-off
            between frequency resolution (main lobe width) and spectral leakage (sidelobe level).
          </p>
          <ul>
            <li>
              <strong>Hann</strong> — The most common window for spectral analysis. Good balance of
              frequency resolution and sidelobe suppression (~31 dB down). Smooth cosine taper to
              zero at both edges.
            </li>
            <li>
              <strong>Hamming</strong> — Similar to Hann but does not taper to zero, leaving a small
              discontinuity at the edges. First sidelobe is ~42 dB down, but sidelobes decay more
              slowly than Hann.
            </li>
            <li>
              <strong>Blackman</strong> — Wider main lobe than Hann, but sidelobes are ~58 dB down.
              Good choice when detecting weak signals near strong ones.
            </li>
            <li>
              <strong>Blackman-Harris</strong> — Four-term cosine sum with sidelobes ~92 dB down.
              Excellent dynamic range at the cost of the widest main lobe. Useful for high dynamic
              range measurements.
            </li>
            <li>
              <strong>Bartlett</strong> — Triangular window with ~26 dB sidelobe suppression. Simpler
              than cosine windows, with sidelobes that decay faster than rectangular but worse
              frequency resolution than Hann.
            </li>
            <li>
              <strong>Rectangular</strong> — No windowing (uniform weighting). Narrowest main lobe
              giving the best frequency resolution, but only ~13 dB sidelobe suppression. Use when
              the signal is already periodic within the frame or for transient detection.
            </li>
          </ul>

          <h2>Frequency Scales</h2>
          <p>
            The frequency axis can be mapped using different perceptual and mathematical scales,
            each suited to different analysis tasks.
          </p>
          <ul>
            <li>
              <strong>Linear</strong> — Uniform spacing in Hz. Best for narrowband analysis, harmonic
              series inspection, and engineering measurements where equal Hz spacing is needed.
            </li>
            <li>
              <strong>Logarithmic</strong> — Spacing proportional to frequency (octave-based). Matches
              musical pitch perception — each octave occupies equal visual space. Standard for
              wideband audio analysis.
            </li>
            <li>
              <strong>Mel</strong> — Perceptual scale based on pitch perception experiments.
              Approximately linear below 1 kHz and logarithmic above. Widely used in speech
              recognition, speaker identification, and MIR feature extraction (MFCCs).
            </li>
            <li>
              <strong>Bark</strong> — Based on critical bands of the auditory system (24 Bark bands).
              Each band corresponds to a region of the basilar membrane. Used in psychoacoustic
              models, audio codec design, and perceptual loudness measurement.
            </li>
            <li>
              <strong>ERB (Equivalent Rectangular Bandwidth)</strong> — Models auditory filter
              bandwidths more accurately than Bark at low frequencies. Common in computational
              auditory scene analysis (CASA) and hearing research.
            </li>
          </ul>

          <h2>Color Maps</h2>
          <p>
            All color maps are perceptually uniform — equal steps in data value produce equal
            perceived brightness changes — ensuring the visualization does not introduce visual
            artifacts.
          </p>
          <ul>
            <li>
              <strong>Viridis</strong> — Blue-green-yellow. The default choice for scientific
              visualization. Perceptually uniform, colorblind-friendly, and prints well in
              grayscale.
            </li>
            <li>
              <strong>Magma</strong> — Black-purple-orange-yellow. High contrast at both ends of
              the range. Good for highlighting low-energy detail against a dark background.
            </li>
            <li>
              <strong>Inferno</strong> — Black-purple-red-yellow. Similar to magma with warmer
              midtones. Useful when distinguishing mid-range energy levels.
            </li>
            <li>
              <strong>Grayscale</strong> — Black to white. Familiar and intuitive, works universally
              in print and on screen.
            </li>
            <li>
              <strong>Inverted Grayscale</strong> — White to black. Dark regions represent high
              energy, matching traditional paper-based spectrogram plots.
            </li>
            <li>
              <strong>Roseus</strong> — Black-pink-white. Perceptually uniform alternative to the
              common "hot" colormap without the misleading luminance reversals.
            </li>
          </ul>

          <h2>FFT Parameters</h2>
          <p>
            The Short-Time Fourier Transform (STFT) parameters control the resolution and
            appearance of the spectrogram.
          </p>
          <ul>
            <li>
              <strong>FFT Size</strong> — Number of samples per analysis frame (256–16384). Larger
              sizes give finer frequency resolution but coarser time resolution (the
              time-frequency uncertainty principle). 2048 or 4096 are common starting points for
              music analysis at 44.1 kHz.
            </li>
            <li>
              <strong>Hop Size</strong> — Number of samples between successive frames. Smaller hops
              give smoother time resolution (more overlap between frames). Typical values are
              1/4 to 1/2 of the FFT size.
            </li>
            <li>
              <strong>Zero Padding</strong> — Appending zeros to the frame before the FFT
              interpolates the frequency bins, producing a visually smoother spectrogram without
              changing the actual frequency resolution.
            </li>
            <li>
              <strong>dB Range &amp; Gain</strong> — The dynamic range controls which magnitudes are
              visible. A typical range of 80–120 dB shows most musical content. Gain offsets the
              entire scale, useful for normalizing quiet recordings.
            </li>
          </ul>
        </div>

        <AudioCredits track="whiptails" />
      </main>
    </Layout>
  );
}
