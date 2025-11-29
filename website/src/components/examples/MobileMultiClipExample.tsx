/**
 * Mobile-optimized Multi-Clip Example
 *
 * Demonstrates touch-friendly clip dragging and trimming:
 * - Touch delay (250ms) to distinguish drag from scroll gestures
 * - Larger touch targets (24px) for clip boundaries
 * - Simplified controls optimized for mobile screens
 * - Fewer tracks for better mobile performance
 *
 * Usage tip: Touch and hold a clip header to drag it.
 * Touch and hold a clip edge to trim it.
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import type WaveformData from 'waveform-data';
import { DndContext } from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { getGlobalAudioContext } from '@waveform-playlist/playout';
import { createTrack, createClipFromSeconds, type ClipTrack } from '@waveform-playlist/core';
import {
  WaveformPlaylistProvider,
  usePlaylistData,
  usePlaylistControls,
  useClipDragHandlers,
  useDragSensors,
  loadWaveformData,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  ZoomInButton,
  ZoomOutButton,
  AudioPosition,
} from '@waveform-playlist/browser';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

const Container = styled.div`
  /* Prevent accidental text selection while dragging on mobile */
  user-select: none;
  -webkit-user-select: none;

  /* Prevent pull-to-refresh on mobile while interacting with playlist */
  overscroll-behavior: contain;
`;

const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
  align-items: center;
  padding: 8px;
  background: var(--ifm-background-surface-color, #f8f9fa);
  border-radius: 8px;

  /* Make buttons larger on mobile */
  @media (max-width: 768px) {
    button {
      min-width: 44px;
      min-height: 44px;
      padding: 8px 12px;
    }
  }
`;

const ControlGroup = styled.div`
  display: flex;
  gap: 4px;
  align-items: center;
`;

const Instructions = styled.div`
  background: var(--ifm-background-surface-color, #f8f9fa);
  border: 1px solid var(--ifm-color-emphasis-300, #dadde1);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ifm-font-color-base);

  strong {
    display: block;
    margin-bottom: 4px;
    color: var(--ifm-color-primary);
  }

  ul {
    margin: 8px 0 0 0;
    padding-left: 20px;
  }

  li {
    margin-bottom: 4px;
  }

  li strong {
    display: inline;
    margin-bottom: 0;
  }
`;

// Simplified audio files for mobile - fewer tracks (with BBC peaks)
const audioFiles = [
  {
    id: 'kick',
    src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/01_Kick.opus',
    peaksSrc: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/01_Kick.dat',
  },
  {
    id: 'bass',
    src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/08_Bass.opus',
    peaksSrc: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/08_Bass.dat',
  },
  {
    id: 'synth',
    src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/09_Synth1_Unmodulated.opus',
    peaksSrc: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/09_Synth1_Unmodulated.dat',
  },
];

// Simplified track configuration - 3 tracks for mobile
const trackConfigs = [
  {
    name: 'Kick',
    clips: [
      { fileId: 'kick', startTime: 0, duration: 8, offset: 0 },
      { fileId: 'kick', startTime: 12, duration: 8, offset: 8 },
    ],
  },
  {
    name: 'Bass',
    clips: [
      { fileId: 'bass', startTime: 4, duration: 12, offset: 2 },
    ],
  },
  {
    name: 'Synth',
    clips: [
      { fileId: 'synth', startTime: 0, duration: 6, offset: 0 },
      { fileId: 'synth', startTime: 10, duration: 8, offset: 6 },
    ],
  },
];

interface PlaylistWithDragProps {
  tracks: ClipTrack[];
  onTracksChange: (tracks: ClipTrack[]) => void;
}

const PlaylistWithDrag: React.FC<PlaylistWithDragProps> = ({ tracks, onTracksChange }) => {
  const { samplesPerPixel, sampleRate } = usePlaylistData();
  const { setSelectedTrackId } = usePlaylistControls();

  // Use touch-optimized sensors with 250ms delay to distinguish drag from scroll
  const sensors = useDragSensors({ touchOptimized: true });

  const { onDragStart: handleDragStart, onDragMove, onDragEnd, collisionModifier } = useClipDragHandlers({
    tracks,
    onTracksChange,
    samplesPerPixel,
    sampleRate,
  });

  const onDragStart = (event: any) => {
    const trackIndex = event.active?.data?.current?.trackIndex;
    if (trackIndex !== undefined && tracks[trackIndex]) {
      setSelectedTrackId(tracks[trackIndex].id);
    }
    handleDragStart(event);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      modifiers={[restrictToHorizontalAxis, collisionModifier]}
    >
      <Controls>
        <ControlGroup>
          <PlayButton />
          <PauseButton />
          <StopButton />
        </ControlGroup>
        <ControlGroup>
          <ZoomInButton />
          <ZoomOutButton />
        </ControlGroup>
        <ControlGroup>
          <AudioPosition />
        </ControlGroup>
      </Controls>

      {/* touchOptimized enables larger touch targets for clip boundaries */}
      <Waveform showClipHeaders interactiveClips touchOptimized />
    </DndContext>
  );
};

export function MobileMultiClipExample() {
  const { theme } = useDocusaurusTheme();
  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTracks = async () => {
      try {
        setLoading(true);
        setError(null);

        const audioContext = getGlobalAudioContext();

        // Load all audio files and BBC peaks in parallel
        const fileLoadPromises = audioFiles.map(async (file) => {
          // Load audio and peaks in parallel
          const [audioResponse, waveformData] = await Promise.all([
            fetch(file.src),
            loadWaveformData(file.peaksSrc),
          ]);

          if (!audioResponse.ok) {
            throw new Error(`Failed to fetch ${file.src}: ${audioResponse.statusText}`);
          }

          const arrayBuffer = await audioResponse.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          return { id: file.id, buffer: audioBuffer, waveformData };
        });

        const loadedFiles = await Promise.all(fileLoadPromises);
        const fileBuffers = new Map(loadedFiles.map(f => [f.id, { buffer: f.buffer, waveformData: f.waveformData }]));

        // Create tracks with BBC peaks attached to clips
        const loadedTracks = trackConfigs.map((trackConfig) => {
          const clips = trackConfig.clips.map((clipConfig) => {
            const fileData = fileBuffers.get(clipConfig.fileId);
            if (!fileData) {
              throw new Error(`Audio file not found for ID: ${clipConfig.fileId}`);
            }

            return createClipFromSeconds({
              audioBuffer: fileData.buffer,
              startTime: clipConfig.startTime,
              duration: clipConfig.duration,
              offset: clipConfig.offset,
              name: `${trackConfig.name} ${clipConfig.offset}-${clipConfig.offset + clipConfig.duration}s`,
              waveformData: fileData.waveformData as WaveformData, // Attach BBC peaks!
            });
          });

          return createTrack({
            name: trackConfig.name,
            clips,
            muted: false,
            soloed: false,
            volume: 1,
            pan: 0,
          });
        });

        if (!cancelled) {
          setTracks(loadedTracks);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load tracks:', err);
          setError(err as Error);
          setLoading(false);
        }
      }
    };

    loadTracks();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading audio tracks...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', color: 'red' }}>
        Error loading audio: {error.message}
      </div>
    );
  }

  return (
    <Container>
      <Instructions>
        <strong>Touch Controls</strong>
        <ul>
          <li><strong>Scroll:</strong> Swipe left/right on the waveform area</li>
          <li><strong>Move clip:</strong> Touch and hold the clip header (250ms), then drag</li>
          <li><strong>Trim clip:</strong> Touch and hold a clip edge, then drag</li>
          <li><strong>Seek:</strong> Tap on the waveform to set playhead position</li>
        </ul>
      </Instructions>

      <WaveformPlaylistProvider
        tracks={tracks}
        samplesPerPixel={1024}
        mono
        waveHeight={120}
        automaticScroll={false}
        controls={{ show: true, width: 100 }}
        theme={theme}
        timescale
        barWidth={4}
        barGap={2}
      >
        <PlaylistWithDrag tracks={tracks} onTracksChange={setTracks} />
      </WaveformPlaylistProvider>
    </Container>
  );
}
