/**
 * New Tracks Example
 *
 * Demonstrates dynamic track management:
 * - Drag and drop audio files to add tracks
 * - Remove tracks from the playlist
 * - Multiple tracks with independent controls
 */

import React, { useState, useCallback } from 'react';
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
  AutomaticScrollCheckbox,
  useDynamicTracks,
} from '@waveform-playlist/browser';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { FolderOpenIcon, MusicNotesIcon } from '@phosphor-icons/react';

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const Controls = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 1rem;
  background: var(--ifm-background-surface-color, #f8f9fa);
  border: 1px solid var(--ifm-color-emphasis-300, #dee2e6);
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;

const ControlGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding-right: 1rem;
  border-right: 1px solid var(--ifm-color-emphasis-300, #dee2e6);

  &:last-child {
    border-right: none;
  }
`;

const DropZone = styled.div<{ $isDragging: boolean }>`
  padding: 3rem 2rem;
  border: 3px dashed ${(props) => (props.$isDragging ? '#3498db' : 'var(--ifm-color-emphasis-400, #ced4da)')};
  border-radius: 0.5rem;
  text-align: center;
  background: ${(props) => (props.$isDragging ? 'rgba(52, 152, 219, 0.1)' : 'var(--ifm-background-surface-color, #f8f9fa)')};
  margin-bottom: 1.5rem;
  transition: all 0.2s ease-in-out;
  cursor: pointer;

  &:hover {
    border-color: #3498db;
    background: var(--ifm-color-emphasis-100, #e3f2fd);
  }
`;

const DropZoneText = styled.p`
  margin: 0;
  color: var(--ifm-font-color-base, #495057);
  font-size: 1rem;
`;

const DropZoneSubtext = styled.p`
  margin: 0.5rem 0 0 0;
  color: var(--ifm-color-emphasis-700, #6c757d);
  font-size: 0.875rem;
`;

const HiddenFileInput = styled.input`
  display: none;
`;

export function NewTracksExample() {
  const { theme } = useDocusaurusTheme();
  const { tracks, addTracks, removeTrack, loadingCount, isLoading, errors } = useDynamicTracks();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const files = (Array.from(e.dataTransfer.files) as File[]).filter((file) =>
        file.type.startsWith('audio/')
      );

      if (files.length > 0) {
        addTracks(files);
      }
    },
    [addTracks]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        addTracks(Array.from(files) as File[]);
      }
    },
    [addTracks]
  );

  const handleRemoveTrack = (index: number) => {
    const track = tracks[index];
    if (track) {
      removeTrack(track.id);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDropZoneClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Container>
      <DropZone
        $isDragging={isDragging}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleDropZoneClick}
      >
        {isLoading ? (
          <>
            <DropZoneText>
              Decoding {loadingCount} file{loadingCount !== 1 ? 's' : ''}...
            </DropZoneText>
            <DropZoneSubtext>Placeholder tracks are shown below while audio decodes</DropZoneSubtext>
          </>
        ) : (
          <>
            <DropZoneText>
              {isDragging ? <><FolderOpenIcon size={20} weight="light" style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} /> Drop audio files here</> : <><MusicNotesIcon size={20} weight="light" style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} /> Drop audio files here to add tracks</>}
            </DropZoneText>
            <DropZoneSubtext>
              or click to browse (supports MP3, WAV, OGG, and more)
            </DropZoneSubtext>
          </>
        )}
      </DropZone>

      <HiddenFileInput
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleFileInput}
      />

      {errors.length > 0 && (
        <div role="alert" style={{
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          background: 'var(--ifm-color-danger-contrast-background, #fdf0ef)',
          border: '1px solid var(--ifm-color-danger-dark, #c0392b)',
          borderRadius: '0.5rem',
          color: 'var(--ifm-color-danger-darkest, #7f1d1d)',
          fontSize: '0.875rem',
        }}>
          {errors.map((e, i) => (
            <div key={i}>Failed to load &quot;{e.name}&quot;: {e.error.message}</div>
          ))}
        </div>
      )}

      {tracks.length > 0 && (
        <WaveformPlaylistProvider
          tracks={tracks}
          samplesPerPixel={8192}
          zoomLevels={[512, 1024, 2048, 4096, 8192, 16384, 32768]}
          mono
          waveHeight={120}
          automaticScroll={true}
          controls={{ show: true, width: 200 }}
          theme={theme}
          timescale
          barWidth={4}
          barGap={2}
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

            <ControlGroup>
              <AutomaticScrollCheckbox />
            </ControlGroup>
          </Controls>

          <Waveform
            onRemoveTrack={handleRemoveTrack}
          />
        </WaveformPlaylistProvider>
      )}
    </Container>
  );
}
