import React, { FunctionComponent, useRef, useEffect, useContext, useMemo } from 'react';
import styled, { withTheme, DefaultTheme } from 'styled-components';
import { PlaylistInfoContext } from '../contexts/PlaylistInfo';
import { useDevicePixelRatio } from '../contexts/DevicePixelRatio';
import { secondsToPixels } from '../utils/conversions';

function formatTime(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  const s = seconds % 60;
  const m = (seconds - s) / 60;

  return `${m}:${String(s).padStart(2, '0')}`;
}

interface PlaylistTimeScaleScrollProps {
  readonly $cssWidth: number;
  readonly $controlWidth: number;
  readonly $timeScaleHeight: number;
}
const PlaylistTimeScaleScroll = styled.div.attrs<PlaylistTimeScaleScrollProps>((props) => ({
  style: {
    width: `${props.$cssWidth}px`,
    marginLeft: `${props.$controlWidth}px`,
    height: `${props.$timeScaleHeight}px`,
  },
}))<PlaylistTimeScaleScrollProps>`
  position: relative;
  overflow: visible; /* Allow time labels to render above the container */
  border-bottom: 1px solid ${props => props.theme.timeColor};
  box-sizing: border-box;
`;

interface TimeTicksProps {
  readonly $cssWidth: number;
  readonly $timeScaleHeight: number;
}
const TimeTicks = styled.canvas.attrs<TimeTicksProps>((props) => ({
  style: {
    width: `${props.$cssWidth}px`,
    height: `${props.$timeScaleHeight}px`,
  },
}))<TimeTicksProps>`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
`;

interface TimeStampProps {
  readonly $left: number;
}
const TimeStamp = styled.div.attrs<TimeStampProps>((props) => ({
  style: {
    left: `${props.$left + 4}px`, // Offset 4px to the right of the tick
  },
}))<TimeStampProps>`
  position: absolute;
  font-size: 0.75rem; /* Smaller font to prevent overflow */
  white-space: nowrap; /* Prevent text wrapping */
  color: ${props => props.theme.timeColor}; /* Use theme color instead of inheriting */
`;

export interface TimeScaleProps {
  readonly theme?: DefaultTheme;
  readonly duration: number;
  readonly marker: number;
  readonly bigStep: number;
  readonly secondStep: number;
  readonly renderTimestamp?: (timeMs: number, pixelPosition: number) => React.ReactNode;
}

interface TimeScalePropsWithTheme extends TimeScaleProps {
  readonly theme: DefaultTheme;
}

export const TimeScale: FunctionComponent<TimeScalePropsWithTheme> = (props) => {
  const {
    theme: { timeColor },
    duration,
    marker,
    bigStep,
    secondStep,
    renderTimestamp,
  } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    sampleRate,
    samplesPerPixel,
    timeScaleHeight,
    controls: { show: showControls, width: controlWidth },
  } = useContext(PlaylistInfoContext);
  const devicePixelRatio = useDevicePixelRatio();

  const { widthX, canvasInfo, timeMarkers } = useMemo(() => {
    const nextCanvasInfo = new Map<number, number>();
    const nextTimeMarkers: React.ReactNode[] = [];
    const nextWidthX = secondsToPixels(duration / 1000, samplesPerPixel, sampleRate);
    const pixPerSec = sampleRate / samplesPerPixel;
    let counter = 0;

    for (let i = 0; i < nextWidthX; i += (pixPerSec * secondStep) / 1000) {
      const pix = Math.floor(i);

      if (counter % marker === 0) {
        const timeMs = counter;
        const timestamp = formatTime(timeMs);

        const timestampContent = renderTimestamp ? (
          <React.Fragment key={`timestamp-${counter}`}>
            {renderTimestamp(timeMs, pix)}
          </React.Fragment>
        ) : (
          <TimeStamp key={timestamp} $left={pix}>
            {timestamp}
          </TimeStamp>
        );

        nextTimeMarkers.push(timestampContent);
        nextCanvasInfo.set(pix, timeScaleHeight);
      } else if (counter % bigStep === 0) {
        nextCanvasInfo.set(pix, Math.floor(timeScaleHeight / 2));
      } else if (counter % secondStep === 0) {
        nextCanvasInfo.set(pix, Math.floor(timeScaleHeight / 5));
      }

      counter += secondStep;
    }

    return {
      widthX: nextWidthX,
      canvasInfo: nextCanvasInfo,
      timeMarkers: nextTimeMarkers,
    };
  }, [duration, samplesPerPixel, sampleRate, marker, bigStep, secondStep, renderTimestamp, timeScaleHeight]);

  useEffect(() => {
    if (canvasRef.current !== null) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.resetTransform();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = timeColor;
        ctx.scale(devicePixelRatio, devicePixelRatio);

        for (const [pixLeft, scaleHeight] of canvasInfo.entries()) {
          const scaleY = timeScaleHeight - scaleHeight;
          ctx.fillRect(pixLeft, scaleY, 1, scaleHeight);
        }
      }
    }
  }, [
    duration,
    devicePixelRatio,
    timeColor,
    timeScaleHeight,
    canvasInfo,
  ]);

  return (
    <PlaylistTimeScaleScroll
      $cssWidth={widthX}
      $controlWidth={showControls ? controlWidth : 0}
      $timeScaleHeight={timeScaleHeight}
    >
      {timeMarkers}
      <TimeTicks
        $cssWidth={widthX}
        $timeScaleHeight={timeScaleHeight}
        width={widthX * devicePixelRatio}
        height={timeScaleHeight * devicePixelRatio}
        ref={canvasRef}
      />
    </PlaylistTimeScaleScroll>
  );
};

export const StyledTimeScale = withTheme(TimeScale) as FunctionComponent<TimeScaleProps>;
