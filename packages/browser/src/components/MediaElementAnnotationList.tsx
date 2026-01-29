import React, { useCallback } from 'react';
import { AnnotationText } from '@waveform-playlist/annotations';
import type { RenderAnnotationItemProps } from '@waveform-playlist/annotations';
import { useMediaElementState, useMediaElementControls } from '../MediaElementPlaylistContext';
import type { OnAnnotationUpdateFn } from '../types/annotations';

export type { RenderAnnotationItemProps } from '@waveform-playlist/annotations';
export type { OnAnnotationUpdateFn } from '../types/annotations';

export interface MediaElementAnnotationListProps {
  /** Height in pixels for the annotation text list */
  height?: number;
  /**
   * Custom render function for annotation items in the text list.
   * When provided, completely replaces the default annotation item rendering.
   */
  renderAnnotationItem?: (props: RenderAnnotationItemProps) => React.ReactNode;
  /**
   * Callback when annotations are updated (e.g., text edited).
   * Called with the full updated annotations array.
   */
  onAnnotationUpdate?: OnAnnotationUpdateFn;
  /** Whether annotation text can be edited. Defaults to false. */
  editable?: boolean;
  /** Whether dragging one annotation boundary also moves the adjacent annotation's boundary. Defaults to false. */
  linkEndpoints?: boolean;
  /** Override continuousPlay from context. Falls back to context value if not provided. */
  continuousPlay?: boolean;
  /** Where to position the active annotation when auto-scrolling. Defaults to 'center'. */
  scrollActivePosition?: ScrollLogicalPosition;
  /** Which scrollable containers to scroll: 'nearest' or 'all'. Defaults to 'nearest'. */
  scrollActiveContainer?: 'nearest' | 'all';
}

/**
 * Standalone annotation text list component for MediaElementPlaylistProvider.
 *
 * Reads annotations and playback state from context and renders AnnotationText
 * unconditionally (even when annotations are empty).
 */
export const MediaElementAnnotationList: React.FC<MediaElementAnnotationListProps> = ({
  height,
  renderAnnotationItem,
  onAnnotationUpdate,
  editable = false,
  linkEndpoints = false,
  continuousPlay: continuousPlayProp,
  scrollActivePosition = 'center',
  scrollActiveContainer = 'nearest',
}) => {
  const { annotations, activeAnnotationId, continuousPlay: contextContinuousPlay } = useMediaElementState();
  const { setAnnotations } = useMediaElementControls();

  const continuousPlay = continuousPlayProp ?? contextContinuousPlay;

  const handleAnnotationUpdate = useCallback((updatedAnnotations: any[]) => {
    setAnnotations(updatedAnnotations);
    onAnnotationUpdate?.(updatedAnnotations);
  }, [setAnnotations, onAnnotationUpdate]);

  return (
    <AnnotationText
      annotations={annotations}
      activeAnnotationId={activeAnnotationId ?? undefined}
      shouldScrollToActive={true}
      scrollActivePosition={scrollActivePosition}
      scrollActiveContainer={scrollActiveContainer}
      editable={editable}
      annotationListConfig={{ linkEndpoints, continuousPlay }}
      height={height}
      onAnnotationUpdate={handleAnnotationUpdate}
      renderAnnotationItem={renderAnnotationItem}
    />
  );
};
