import React, { useMemo } from 'react';
import styled from 'styled-components';
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  AudioPosition,
  ZoomInButton,
  ZoomOutButton,
  useAudioTracks,
  usePlaybackShortcuts,
} from '@waveform-playlist/browser';
import type { SpectrogramConfig, RenderMode, ColorMapName } from '@waveform-playlist/core';
import type { AudioTrackConfig } from '@waveform-playlist/browser';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const ControlBar = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem 1rem;
  flex-wrap: wrap;
  background: var(--ifm-background-surface-color, #f5f5f5);
  border-radius: 6px;
  margin-bottom: 1rem;
`;

const TRACK_CONFIGS: { src: string; name: string; defaultMode: RenderMode; colorMap?: ColorMapName }[] = [
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/09_Synth1.opus',
    name: 'Synth',
    defaultMode: 'waveform',
    colorMap: 'viridis',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/07_Bass1.opus',
    name: 'Bass',
    defaultMode: 'waveform',
    colorMap: 'magma',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/03_Kick.opus',
    name: 'Kick',
    defaultMode: 'waveform',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/06_HiHat.opus',
    name: 'HiHat',
    defaultMode: 'waveform',
  },
];

const DEFAULT_SPECTROGRAM_CONFIG: SpectrogramConfig = {
  fftSize: 2048,
  windowFunction: 'hann',
  frequencyScale: 'linear',
  minFrequency: 0,
  maxFrequency: 20000,
  minDecibels: -100,
  maxDecibels: -20,
  gainDb: 0,
  labels: false,
};

function MirSpectrogramInner() {
  usePlaybackShortcuts();
  return null;
}

export function MirSpectrogramExample() {
  const { theme } = useDocusaurusTheme();

  // Build audio configs with per-track render modes and spectrogram settings
  const audioConfigs: AudioTrackConfig[] = useMemo(() =>
    TRACK_CONFIGS.map((tc) => ({
      src: tc.src,
      name: tc.name,
      renderMode: tc.defaultMode,
      spectrogramConfig: DEFAULT_SPECTROGRAM_CONFIG,
      spectrogramColorMap: tc.colorMap,
    })),
    []
  );

  const { tracks, loading, error } = useAudioTracks(audioConfigs, { progressive: true });

  if (error) return <div>Error: {error}</div>;

  return (
    <Container>
      <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: '0 0 0.75rem' }}>
        Use the <strong>...</strong> menu in each track's controls to change render mode or spectrogram settings per-track.
      </p>

      {loading && <div style={{ padding: '1rem', opacity: 0.7 }}>Loading tracks...</div>}

      {tracks.length > 0 && (
        <WaveformPlaylistProvider
          tracks={tracks}
          theme={theme}
          waveHeight={100}
          samplesPerPixel={512}
          zoomLevels={[128, 256, 512, 1024, 2048, 4096]}
          controls={{ show: true, width: 180 }}
        >
          <MirSpectrogramInner />
          <ControlBar>
            <PlayButton />
            <PauseButton />
            <StopButton />
            <AudioPosition />
            <ZoomInButton />
            <ZoomOutButton />
          </ControlBar>
          <Waveform />
        </WaveformPlaylistProvider>
      )}
    </Container>
  );
}
