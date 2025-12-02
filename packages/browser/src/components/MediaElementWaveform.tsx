import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  Playlist,
  Track as TrackComponent,
  Clip,
  Playhead,
  Selection,
  PlaylistInfoContext,
  TrackControlsContext,
  DevicePixelRatioProvider,
  StyledTimeScale,
  useTheme,
  waveformColorToCss,
} from '@waveform-playlist/ui-components';
import {
  AnnotationBoxesWrapper,
  AnnotationBox,
  AnnotationText,
} from '@waveform-playlist/annotations';
import type { RenderAnnotationItemProps } from '@waveform-playlist/annotations';
import type { Peaks } from '@waveform-playlist/webaudio-peaks';
import {
  useMediaElementAnimation,
  useMediaElementState,
  useMediaElementControls,
  useMediaElementData,
} from '../MediaElementPlaylistContext';
import { AnimatedMediaElementPlayhead } from './AnimatedMediaElementPlayhead';
import { ChannelWithMediaElementProgress } from './ChannelWithMediaElementProgress';

// Re-export RenderAnnotationItemProps for convenience
export type { RenderAnnotationItemProps } from '@waveform-playlist/annotations';

export interface MediaElementWaveformProps {
  /** Height in pixels for the annotation text list */
  annotationTextHeight?: number;
  /** Custom function to generate the label shown on annotation boxes */
  getAnnotationBoxLabel?: (annotation: { id: string; start: number; end: number; lines: string[] }) => string;
  /**
   * Custom render function for annotation items in the text list.
   * When provided, completely replaces the default annotation item rendering.
   * Use this to customize the appearance of each annotation (e.g., add furigana).
   */
  renderAnnotationItem?: (props: RenderAnnotationItemProps) => React.ReactNode;
  className?: string;
}

/**
 * Simplified Waveform component for MediaElementPlaylistProvider
 *
 * This is a stripped-down version of Waveform that works with the
 * MediaElement context. It supports:
 * - Single track visualization
 * - Click to seek
 * - Annotation display and click-to-play
 * - Playhead animation
 *
 * For multi-track editing, use the full Waveform with WaveformPlaylistProvider.
 */
export const MediaElementWaveform: React.FC<MediaElementWaveformProps> = ({
  annotationTextHeight,
  getAnnotationBoxLabel,
  renderAnnotationItem,
  className,
}) => {
  const theme = useTheme() as import('@waveform-playlist/ui-components').WaveformPlaylistTheme;

  // MediaElement context hooks
  const { isPlaying, currentTimeRef } = useMediaElementAnimation();
  const { annotations, activeAnnotationId, continuousPlay } = useMediaElementState();
  const { play, seekTo, setActiveAnnotationId } = useMediaElementControls();
  const {
    duration,
    peaksDataArray,
    sampleRate,
    waveHeight,
    timeScaleHeight,
    samplesPerPixel,
    controls,
    playoutRef,
    barWidth,
    barGap,
  } = useMediaElementData();

  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [isSelecting, setIsSelecting] = useState(false);

  // Local ref for scroll container
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Calculate dimensions
  const tracksFullWidth = Math.floor((duration * sampleRate) / samplesPerPixel);

  // Annotation click handler
  const handleAnnotationClick = useCallback(async (annotation: any) => {
    setActiveAnnotationId(annotation.id);
    play(annotation.start);
  }, [setActiveAnnotationId, play]);

  // Mouse handlers for click-to-seek
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const controlWidth = controls.show ? controls.width : 0;
    const x = e.clientX - rect.left - controlWidth;
    const clickTime = (x * samplesPerPixel) / sampleRate;

    setIsSelecting(true);
    setSelectionStart(clickTime);
    setSelectionEnd(clickTime);
  }, [controls, samplesPerPixel, sampleRate]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const controlWidth = controls.show ? controls.width : 0;
    const x = e.clientX - rect.left - controlWidth;
    const moveTime = (x * samplesPerPixel) / sampleRate;

    setSelectionEnd(moveTime);
  }, [isSelecting, controls, samplesPerPixel, sampleRate]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting) return;

    setIsSelecting(false);

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const controlWidth = controls.show ? controls.width : 0;
    const x = e.clientX - rect.left - controlWidth;
    const endTime = (x * samplesPerPixel) / sampleRate;

    const start = Math.min(selectionStart, endTime);
    const end = Math.max(selectionStart, endTime);

    // If it's just a click (not a drag), seek to that position
    if (Math.abs(end - start) < 0.1) {
      seekTo(start);
      setSelectionStart(start);
      setSelectionEnd(start);

      if (isPlaying && playoutRef.current) {
        playoutRef.current.stop();
        play(start);
      }
    } else {
      // It was a drag - finalize the selection
      setSelectionStart(start);
      setSelectionEnd(end);
    }
  }, [isSelecting, selectionStart, samplesPerPixel, sampleRate, controls, seekTo, isPlaying, playoutRef, play]);

  // Show loading if peaks not ready
  if (peaksDataArray.length === 0) {
    return <div className={className}>Loading waveform...</div>;
  }

  // Empty track controls (MediaElement is single-track, no mute/solo needed)
  const emptyControls = null;

  return (
    <DevicePixelRatioProvider>
      <PlaylistInfoContext.Provider
        value={{
          samplesPerPixel,
          sampleRate,
          zoomLevels: [samplesPerPixel],
          waveHeight,
          timeScaleHeight,
          duration,
          controls,
          barWidth,
          barGap,
        }}
      >
        <Playlist
          theme={theme}
          backgroundColor={waveformColorToCss(theme.waveOutlineColor)}
          timescaleBackgroundColor={theme.timescaleBackgroundColor}
          scrollContainerWidth={tracksFullWidth + (controls.show ? controls.width : 0)}
          timescaleWidth={tracksFullWidth}
          tracksWidth={tracksFullWidth}
          controlsWidth={controls.show ? controls.width : 0}
          onTracksMouseDown={handleMouseDown}
          onTracksMouseMove={handleMouseMove}
          onTracksMouseUp={handleMouseUp}
          scrollContainerRef={(el) => { scrollContainerRef.current = el; }}
          isSelecting={isSelecting}
          timescale={
            timeScaleHeight > 0 ? (
              <StyledTimeScale
                duration={duration * 1000}
                marker={10000}
                bigStep={5000}
                secondStep={1000}
              />
            ) : undefined
          }
        >
          <>
            {peaksDataArray.map((trackClipPeaks, trackIndex) => {
              // For MediaElement, we have a single track with a single clip
              const maxChannels = trackClipPeaks.length > 0
                ? Math.max(...trackClipPeaks.map(clip => clip.peaks.data.length))
                : 1;

              return (
                <TrackControlsContext.Provider key={trackIndex} value={emptyControls}>
                  <TrackComponent
                    numChannels={maxChannels}
                    backgroundColor={waveformColorToCss(theme.waveOutlineColor)}
                    offset={0}
                    width={tracksFullWidth}
                    hasClipHeaders={false}
                    trackId={`media-element-track-${trackIndex}`}
                    isSelected={true}
                  >
                    {trackClipPeaks.map((clip, clipIndex) => {
                      const peaksData = clip.peaks;
                      const width = peaksData.length;

                      return (
                        <Clip
                          key={`${trackIndex}-${clipIndex}`}
                          clipId={clip.clipId}
                          trackIndex={trackIndex}
                          clipIndex={clipIndex}
                          trackName={clip.trackName}
                          startSample={clip.startSample}
                          durationSamples={clip.durationSamples}
                          samplesPerPixel={samplesPerPixel}
                          showHeader={false}
                          disableHeaderDrag={true}
                          isSelected={true}
                          trackId={`media-element-track-${trackIndex}`}
                        >
                          {peaksData.data.map((channelPeaks: Peaks, channelIndex: number) => (
                            <ChannelWithMediaElementProgress
                              key={`${trackIndex}-${clipIndex}-${channelIndex}`}
                              index={channelIndex}
                              data={channelPeaks}
                              bits={peaksData.bits}
                              length={width}
                              clipStartSample={clip.startSample}
                              clipDurationSamples={clip.durationSamples}
                            />
                          ))}
                        </Clip>
                      );
                    })}
                  </TrackComponent>
                </TrackControlsContext.Provider>
              );
            })}
            {annotations.length > 0 && (
              <AnnotationBoxesWrapper height={30} width={tracksFullWidth}>
                {annotations.map((annotation, index) => {
                  const startPosition = (annotation.start * sampleRate) / samplesPerPixel;
                  const endPosition = (annotation.end * sampleRate) / samplesPerPixel;
                  const label = getAnnotationBoxLabel
                    ? getAnnotationBoxLabel(annotation)
                    : annotation.id;
                  return (
                    <AnnotationBox
                      key={annotation.id}
                      annotationId={annotation.id}
                      annotationIndex={index}
                      startPosition={startPosition}
                      endPosition={endPosition}
                      label={label}
                      color="#ff9800"
                      isActive={annotation.id === activeAnnotationId}
                      onClick={() => handleAnnotationClick(annotation)}
                      editable={false}
                    />
                  );
                })}
              </AnnotationBoxesWrapper>
            )}
            {selectionStart !== selectionEnd && (
              <Selection
                startPosition={
                  (Math.min(selectionStart, selectionEnd) * sampleRate) / samplesPerPixel +
                  (controls.show ? controls.width : 0)
                }
                endPosition={
                  (Math.max(selectionStart, selectionEnd) * sampleRate) / samplesPerPixel +
                  (controls.show ? controls.width : 0)
                }
                color={theme.selectionColor}
              />
            )}
            <AnimatedMediaElementPlayhead
              color={theme.playheadColor}
              controlsOffset={controls.show ? controls.width : 0}
            />
          </>
        </Playlist>
        {annotations.length > 0 && (
          <AnnotationText
            annotations={annotations}
            activeAnnotationId={activeAnnotationId ?? undefined}
            shouldScrollToActive={true}
            editable={false}
            annotationListConfig={{ linkEndpoints: false, continuousPlay }}
            height={annotationTextHeight}
            onAnnotationUpdate={() => {}}
            renderAnnotationItem={renderAnnotationItem}
          />
        )}
      </PlaylistInfoContext.Provider>
    </DevicePixelRatioProvider>
  );
};
