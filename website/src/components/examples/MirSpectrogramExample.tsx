import React, { useState, useCallback, useRef } from 'react';
import styled from 'styled-components';
import * as Tone from 'tone';
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
import type { SpectrogramConfig, RenderMode, ColorMapName, ClipTrack } from '@waveform-playlist/core';
import { createTrack, createClipFromSeconds } from '@waveform-playlist/core';
import type { AudioTrackConfig } from '@waveform-playlist/browser';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { FolderOpenIcon, MusicNotesIcon } from '@phosphor-icons/react';

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

const ClearButton = styled.button`
  margin-left: auto;
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--ifm-color-emphasis-400, #ced4da);
  border-radius: 4px;
  background: transparent;
  color: var(--ifm-font-color-base, #495057);
  cursor: pointer;
  font-size: 0.8rem;

  &:hover {
    background: #dc3545;
    color: white;
    border-color: #dc3545;
  }
`;

const DropZone = styled.div<{ $isDragging: boolean }>`
  padding: 1.5rem 1rem;
  border: 2px dashed ${(props) => (props.$isDragging ? '#3498db' : 'var(--ifm-color-emphasis-400, #ced4da)')};
  border-radius: 0.5rem;
  text-align: center;
  background: ${(props) => (props.$isDragging ? 'rgba(52, 152, 219, 0.1)' : 'var(--ifm-background-surface-color, #f8f9fa)')};
  margin-top: 1rem;
  transition: all 0.2s ease-in-out;
  cursor: pointer;

  &:hover {
    border-color: #3498db;
  }
`;

const DropZoneText = styled.p`
  margin: 0;
  color: var(--ifm-font-color-base, #495057);
  font-size: 0.9rem;
`;

const HiddenFileInput = styled.input`
  display: none;
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

const AUDIO_CONFIGS: AudioTrackConfig[] = TRACK_CONFIGS.map((tc) => ({
  src: tc.src,
  name: tc.name,
  renderMode: tc.defaultMode,
  spectrogramConfig: DEFAULT_SPECTROGRAM_CONFIG,
  spectrogramColorMap: tc.colorMap,
}));

function MirSpectrogramInner() {
  usePlaybackShortcuts();
  return null;
}

export function MirSpectrogramExample() {
  const { theme } = useDocusaurusTheme();
  const [userTracks, setUserTracks] = useState<ClipTrack[]>([]);
  const [removedBaseIds, setRemovedBaseIds] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { tracks: baseTracks, loading, error } = useAudioTracks(AUDIO_CONFIGS, { progressive: true });

  const filteredBaseTracks = baseTracks.filter(t => !removedBaseIds.has(t.id));
  const allTracks = [...filteredBaseTracks, ...userTracks];

  const handleRemoveTrack = useCallback((index: number) => {
    if (index < filteredBaseTracks.length) {
      setRemovedBaseIds(prev => new Set([...prev, filteredBaseTracks[index].id]));
    } else {
      setUserTracks(prev => prev.filter((_, i) => i !== index - filteredBaseTracks.length));
    }
  }, [filteredBaseTracks]);

  const handleClearAll = useCallback(() => {
    setUserTracks([]);
    setRemovedBaseIds(new Set(baseTracks.map(t => t.id)));
  }, [baseTracks]);

  const addFiles = async (files: File[]) => {
    const audioContext = Tone.getContext().rawContext as AudioContext;
    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const clip = createClipFromSeconds({
          audioBuffer,
          startTime: 0,
          duration: audioBuffer.duration,
          offset: 0,
          name: file.name.replace(/\.[^/.]+$/, ''),
        });
        const newTrack = createTrack({
          name: file.name.replace(/\.[^/.]+$/, ''),
          clips: [clip],
          muted: false,
          soloed: false,
          volume: 1,
          pan: 0,
        });
        setUserTracks(prev => [...prev, newTrack]);
      } catch (err) {
        console.error('Error loading audio file:', file.name, err);
      }
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = (Array.from(e.dataTransfer.files) as File[]).filter(f => f.type.startsWith('audio/'));
    if (files.length > 0) addFiles(files);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) addFiles(Array.from(files) as File[]);
  }, []);

  if (error) return <div>Error: {error}</div>;

  return (
    <Container>
      <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: '0 0 0.75rem' }}>
        Use the <strong>...</strong> menu in each track's controls to change render mode or spectrogram settings per-track.
      </p>

      {loading && <div style={{ padding: '1rem', opacity: 0.7 }}>Loading tracks...</div>}

      {allTracks.length > 0 && (
        <WaveformPlaylistProvider
          tracks={allTracks}
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
            <ClearButton onClick={handleClearAll} title="Remove all tracks">
              Clear All
            </ClearButton>
          </ControlBar>
          <Waveform onRemoveTrack={handleRemoveTrack} showClipHeaders />
        </WaveformPlaylistProvider>
      )}

      <DropZone
        $isDragging={isDragging}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onClick={() => fileInputRef.current?.click()}
      >
        <DropZoneText>
          {isDragging
            ? <><FolderOpenIcon size={18} weight="light" style={{ marginRight: 6, verticalAlign: 'text-bottom' }} /> Drop audio files here</>
            : <><MusicNotesIcon size={18} weight="light" style={{ marginRight: 6, verticalAlign: 'text-bottom' }} /> Drop audio files here to add tracks</>
          }
        </DropZoneText>
      </DropZone>

      <HiddenFileInput
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleFileInput}
      />
    </Container>
  );
}
