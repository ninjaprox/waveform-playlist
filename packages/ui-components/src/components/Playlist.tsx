import styled, { DefaultTheme, withTheme } from "styled-components";
import React, { FunctionComponent, useRef, useState, useCallback } from "react";

const Wrapper = styled.div`
  overflow-y: hidden;
  overflow-x: auto;
  position: relative;
`;

interface ScrollContainerProps {
  readonly $backgroundColor?: string;
  readonly $width?: number;
}

// Use .attrs() for width to avoid generating new CSS classes on every render
const ScrollContainer = styled.div.attrs<ScrollContainerProps>((props) => ({
  style: props.$width !== undefined ? { width: `${props.$width}px` } : {},
}))<ScrollContainerProps>`
  position: relative;
  background: ${(props) => props.$backgroundColor || "transparent"};
`;

interface TimescaleWrapperProps {
  readonly $width?: number;
  readonly $backgroundColor?: string;
}

// Use .attrs() for width to avoid generating new CSS classes on every render
const TimescaleWrapper = styled.div.attrs<TimescaleWrapperProps>((props) => ({
  style: props.$width ? { minWidth: `${props.$width}px` } : {},
}))<TimescaleWrapperProps>`
  background: ${(props) => props.$backgroundColor || "white"};
  width: 100%;
  position: relative;
  overflow: hidden; /* Constrain loop region to timescale area */
`;

interface TracksContainerProps {
  readonly $width?: number;
  readonly $backgroundColor?: string;
}

// Use .attrs() for width to avoid generating new CSS classes on every render
const TracksContainer = styled.div.attrs<TracksContainerProps>((props) => ({
  style: props.$width !== undefined ? { minWidth: `${props.$width}px` } : {},
}))<TracksContainerProps>`
  position: relative;
  background: ${(props) => props.$backgroundColor || "transparent"};
  width: 100%;
`;

interface ClickOverlayProps {
  readonly $controlsWidth?: number;
  readonly $isSelecting?: boolean;
  readonly $dragToScroll?: boolean;
}

const ClickOverlay = styled.div<ClickOverlayProps>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  cursor: ${(props) => (props.$dragToScroll ? "grab" : "crosshair")};
  /* When selecting, raise z-index above clip boundaries (z-index: 105) to prevent interference */
  z-index: ${(props) => (props.$isSelecting ? 110 : 1)};
`;

export interface PlaylistProps {
  readonly theme: DefaultTheme;
  readonly children?: JSX.Element | JSX.Element[];
  readonly backgroundColor?: string;
  readonly timescaleBackgroundColor?: string;
  readonly timescale?: JSX.Element;
  readonly timescaleWidth?: number;
  readonly tracksWidth?: number;
  readonly scrollContainerWidth?: number;
  readonly controlsWidth?: number;
  readonly onTracksClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  readonly onTracksMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  readonly onTracksMouseMove?: (e: React.MouseEvent<HTMLDivElement>) => void;
  readonly onTracksMouseUp?: (e: React.MouseEvent<HTMLDivElement>) => void;
  readonly scrollContainerRef?: (el: HTMLDivElement | null) => void;
  /** When true, selection is in progress - raises z-index to prevent clip boundary interference */
  readonly isSelecting?: boolean;
  /** Data attribute indicating playlist loading state ('loading' | 'ready') */
  readonly "data-playlist-state"?: "loading" | "ready";
  /** When true, dragging on the waveform area scrolls instead of creating a selection */
  readonly dragToScroll?: boolean;
}

export const Playlist: FunctionComponent<PlaylistProps> = ({
  children,
  backgroundColor,
  timescaleBackgroundColor,
  timescale,
  timescaleWidth,
  tracksWidth,
  scrollContainerWidth,
  controlsWidth,
  onTracksClick,
  onTracksMouseDown,
  onTracksMouseMove,
  onTracksMouseUp,
  scrollContainerRef,
  isSelecting,
  "data-playlist-state": playlistState,
  dragToScroll = false,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (dragToScroll && wrapperRef.current) {
        setIsDragging(true);
        dragStartXRef.current = e.clientX;
        dragStartScrollLeftRef.current = wrapperRef.current.scrollLeft;
        e.preventDefault();
      }

      // Call the original handler unless we're in drag-to-scroll mode
      if (!dragToScroll && onTracksMouseDown) {
        onTracksMouseDown(e);
      }
    },
    [dragToScroll, onTracksMouseDown],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (dragToScroll && isDragging && wrapperRef.current) {
        const deltaX = dragStartXRef.current - e.clientX;
        wrapperRef.current.scrollLeft = dragStartScrollLeftRef.current + deltaX;
      }

      // Call the original handler unless we're in drag-to-scroll mode
      if (!dragToScroll && onTracksMouseMove) {
        onTracksMouseMove(e);
      }
    },
    [dragToScroll, isDragging, onTracksMouseMove],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (dragToScroll && isDragging) {
        setIsDragging(false);
      }

      // Call the original handler unless we're in drag-to-scroll mode
      if (!dragToScroll && onTracksMouseUp) {
        onTracksMouseUp(e);
      }
    },
    [dragToScroll, isDragging, onTracksMouseUp],
  );

  const handleMouseLeave = useCallback(() => {
    if (dragToScroll && isDragging) {
      setIsDragging(false);
    }
  }, [dragToScroll, isDragging]);

  // Combine refs to support both internal wrapperRef and external scrollContainerRef
  const setWrapperRef = useCallback(
    (el: HTMLDivElement | null) => {
      (wrapperRef as React.MutableRefObject<HTMLDivElement | null>).current =
        el;
      if (scrollContainerRef) {
        scrollContainerRef(el);
      }
    },
    [scrollContainerRef],
  );

  return (
    <Wrapper
      data-scroll-container="true"
      data-playlist-state={playlistState}
      ref={setWrapperRef}
    >
      <ScrollContainer
        $backgroundColor={backgroundColor}
        $width={scrollContainerWidth}
      >
        {timescale && (
          <TimescaleWrapper
            $width={timescaleWidth}
            $backgroundColor={timescaleBackgroundColor}
          >
            {timescale}
          </TimescaleWrapper>
        )}
        <TracksContainer
          $width={tracksWidth}
          $backgroundColor={backgroundColor}
        >
          {children}
          {(onTracksClick || onTracksMouseDown || dragToScroll) && (
            <ClickOverlay
              $controlsWidth={controlsWidth}
              $isSelecting={isSelecting}
              $dragToScroll={dragToScroll}
              onClick={onTracksClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              style={
                dragToScroll && isDragging ? { cursor: "grabbing" } : undefined
              }
            />
          )}
        </TracksContainer>
      </ScrollContainer>
    </Wrapper>
  );
};

export const StyledPlaylist = withTheme(Playlist);
