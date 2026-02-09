import React, { useRef, useLayoutEffect } from "react";
import styled from "styled-components";
import { useDevicePixelRatio } from "../contexts";

const LABELS_WIDTH = 72;

interface LabelsStickyWrapperProps {
  readonly $height: number;
}

const LabelsStickyWrapper = styled.div<LabelsStickyWrapperProps>`
  position: sticky;
  left: 0;
  z-index: 101;
  pointer-events: none;
  height: 0;
  width: 0;
  overflow: visible;
`;

export interface SpectrogramLabelsProps {
  /** Height per channel in CSS pixels */
  waveHeight: number;
  /** Number of audio channels */
  numChannels: number;
  /** Frequency scale function */
  frequencyScaleFn: (f: number, minF: number, maxF: number) => number;
  /** Min frequency in Hz */
  minFrequency: number;
  /** Max frequency in Hz */
  maxFrequency: number;
  /** Label text color */
  labelsColor?: string;
  /** Label background color */
  labelsBackground?: string;
  /** Render mode — in "both" mode spectrogram is half height */
  renderMode?: "spectrogram" | "both";
  /** Whether clip headers are shown (adds offset) */
  hasClipHeaders?: boolean;
}

/** Generate nice frequency labels for the axis, limited by available height */
function getFrequencyLabels(
  minF: number,
  maxF: number,
  height: number,
): number[] {
  const allCandidates = [
    20, 50, 100, 200, 500, 1000, 2000, 3000, 4000, 5000, 8000, 10000, 12000,
    16000, 20000,
  ];
  const inRange = allCandidates.filter((f) => f >= minF && f <= maxF);

  // Each label needs ~20px of vertical space to avoid overlap
  const maxLabels = Math.max(2, Math.floor(height / 20));
  if (inRange.length <= maxLabels) return inRange;

  // Evenly sample from the available candidates
  const step = (inRange.length - 1) / (maxLabels - 1);
  const result: number[] = [];
  for (let i = 0; i < maxLabels; i++) {
    result.push(inRange[Math.round(i * step)]);
  }
  return result;
}

export const SpectrogramLabels: React.FC<SpectrogramLabelsProps> = ({
  waveHeight,
  numChannels,
  frequencyScaleFn,
  minFrequency,
  maxFrequency,
  labelsColor = "#ccc",
  labelsBackground = "rgba(0,0,0,0.6)",
  renderMode = "spectrogram",
  hasClipHeaders = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const devicePixelRatio = useDevicePixelRatio();

  const spectrogramHeight =
    renderMode === "both" ? Math.floor(waveHeight / 2) : waveHeight;

  const totalHeight = numChannels * waveHeight;
  const clipHeaderOffset = hasClipHeaders ? 22 : 0;

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.resetTransform();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(devicePixelRatio, devicePixelRatio);

    const labelFreqs = getFrequencyLabels(
      minFrequency,
      maxFrequency,
      spectrogramHeight,
    );

    for (let ch = 0; ch < numChannels; ch++) {
      const channelTop = ch * waveHeight + clipHeaderOffset;

      ctx.font = "11px monospace";
      ctx.textBaseline = "middle";

      for (const freq of labelFreqs) {
        const normalized = frequencyScaleFn(freq, minFrequency, maxFrequency);
        if (normalized < 0 || normalized > 1) continue;
        const y = channelTop + spectrogramHeight * (1 - normalized);

        const text =
          freq >= 1000 ? `${(freq / 1000).toFixed(1)}k` : `${freq} Hz`;
        const metrics = ctx.measureText(text);
        const padding = 3;

        ctx.fillStyle = labelsBackground;
        ctx.fillRect(0, y - 7, metrics.width + padding * 2, 14);
        ctx.fillStyle = labelsColor;
        ctx.fillText(text, padding, y);
      }
    }
  }, [
    waveHeight,
    numChannels,
    frequencyScaleFn,
    minFrequency,
    maxFrequency,
    labelsColor,
    labelsBackground,
    devicePixelRatio,
    spectrogramHeight,
    clipHeaderOffset,
  ]);

  return (
    <LabelsStickyWrapper $height={totalHeight + clipHeaderOffset}>
      <canvas
        ref={canvasRef}
        width={LABELS_WIDTH * devicePixelRatio}
        height={(totalHeight + clipHeaderOffset) * devicePixelRatio}
        style={{
          width: LABELS_WIDTH,
          height: totalHeight + clipHeaderOffset,
          pointerEvents: "none",
        }}
      />
    </LabelsStickyWrapper>
  );
};
