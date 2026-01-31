import React, { useRef, useEffect, useState } from 'react';
import styled from 'styled-components';
import type { SpectrogramConfig, ColorMapValue, ColorMapName } from '@waveform-playlist/core';

export interface SpectrogramSettingsModalProps {
  open: boolean;
  onClose: () => void;
  config: SpectrogramConfig;
  colorMap: ColorMapValue;
  onApply: (config: SpectrogramConfig, colorMap: ColorMapValue) => void;
}

const StyledDialog = styled.dialog`
  border: 1px solid rgba(128, 128, 128, 0.4);
  border-radius: 8px;
  padding: 1.5rem;
  background: ${p => p.theme.timescaleBackgroundColor ?? '#222'};
  color: ${p => p.theme.textColor ?? 'inherit'};
  min-width: 380px;
  max-width: 500px;

  &::backdrop {
    background: rgba(0, 0, 0, 0.5);
  }
`;

const Title = styled.h3`
  margin: 0 0 1rem;
  font-size: 1rem;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
`;

const Field = styled.div<{ $span?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  grid-column: ${p => p.$span ? '1 / -1' : 'auto'};
`;

const Label = styled.label`
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.6;
`;

const Select = styled.select`
  padding: 0.3rem 0.4rem;
  border: 1px solid rgba(128, 128, 128, 0.4);
  border-radius: 4px;
  background: rgba(128, 128, 128, 0.15);
  color: inherit;
  font-size: 0.85rem;
`;

const NumberInput = styled.input`
  padding: 0.3rem 0.4rem;
  border: 1px solid rgba(128, 128, 128, 0.4);
  border-radius: 4px;
  background: rgba(128, 128, 128, 0.15);
  color: inherit;
  font-size: 0.85rem;
  width: 100%;
  box-sizing: border-box;
`;

const RangeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const RangeValue = styled.span`
  font-size: 0.75rem;
  font-family: monospace;
  opacity: 0.6;
  min-width: 3ch;
  text-align: right;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  cursor: pointer;
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.25rem;
`;

const ModalButton = styled.button<{ $primary?: boolean }>`
  padding: 0.4rem 1rem;
  border: 1px solid rgba(128, 128, 128, 0.4);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  background: ${p => p.$primary ? (p.theme.waveProgressColor ?? '#4a9') : 'transparent'};
  color: ${p => p.$primary ? '#fff' : 'inherit'};

  &:hover {
    opacity: 0.85;
  }
`;

const FFT_SIZES = [256, 512, 1024, 2048, 4096, 8192];
const WINDOW_FUNCTIONS = ['hann', 'hamming', 'blackman', 'blackman-harris', 'bartlett', 'rectangular'] as const;
const FREQ_SCALES = ['linear', 'logarithmic', 'mel', 'bark', 'erb'] as const;
const COLOR_MAPS: ColorMapName[] = ['viridis', 'magma', 'inferno', 'grayscale', 'igray', 'roseus'];

export const SpectrogramSettingsModal: React.FC<SpectrogramSettingsModalProps> = ({
  open,
  onClose,
  config,
  colorMap,
  onApply,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Local form state
  const [fftSize, setFftSize] = useState(config.fftSize ?? 2048);
  const [windowFn, setWindowFn] = useState(config.windowFunction ?? 'hann');
  const [freqScale, setFreqScale] = useState(config.frequencyScale ?? 'mel');
  const [localColorMap, setLocalColorMap] = useState<ColorMapName>(
    typeof colorMap === 'string' ? colorMap : 'viridis'
  );
  const [minFreq, setMinFreq] = useState(config.minFrequency ?? 0);
  const [maxFreq, setMaxFreq] = useState(config.maxFrequency ?? 20000);
  const [gainDb, setGainDb] = useState(config.gainDb ?? 20);
  const [rangeDb, setRangeDb] = useState(config.rangeDb ?? 80);
  const [zeroPadding, setZeroPadding] = useState(config.zeroPaddingFactor ?? 2);
  const [showLabels, setShowLabels] = useState(config.labels ?? false);

  // Sync local state when props change
  useEffect(() => {
    setFftSize(config.fftSize ?? 2048);
    setWindowFn(config.windowFunction ?? 'hann');
    setFreqScale(config.frequencyScale ?? 'mel');
    setLocalColorMap(typeof colorMap === 'string' ? colorMap : 'viridis');
    setMinFreq(config.minFrequency ?? 0);
    setMaxFreq(config.maxFrequency ?? 20000);
    setGainDb(config.gainDb ?? 20);
    setRangeDb(config.rangeDb ?? 80);
    setZeroPadding(config.zeroPaddingFactor ?? 2);
    setShowLabels(config.labels ?? false);
  }, [config, colorMap]);

  // Open/close dialog + handle native close (Escape key)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }

    const handleClose = () => {
      // Only call onClose if dialog was open (avoids double-fire)
      if (open) {
        onClose();
      }
    };
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [open, onClose]);

  const handleApply = () => {
    onApply(
      {
        fftSize,
        windowFunction: windowFn as SpectrogramConfig['windowFunction'],
        frequencyScale: freqScale as SpectrogramConfig['frequencyScale'],
        minFrequency: minFreq,
        maxFrequency: maxFreq,
        gainDb,
        rangeDb,
        zeroPaddingFactor: zeroPadding,
        labels: showLabels,
      },
      localColorMap
    );
    onClose();
  };

  return (
    <StyledDialog ref={dialogRef}>
      <Title>Spectrogram Settings</Title>
      <FormGrid>
        <Field>
          <Label>FFT Size</Label>
          <Select value={fftSize} onChange={e => setFftSize(Number(e.target.value))}>
            {FFT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>

        <Field>
          <Label>Zero Padding</Label>
          <Select value={zeroPadding} onChange={e => setZeroPadding(Number(e.target.value))}>
            {[1, 2, 4, 8, 16].map(v => <option key={v} value={v}>{v}</option>)}
          </Select>
        </Field>

        <Field>
          <Label>Window Function</Label>
          <Select value={windowFn} onChange={e => setWindowFn(e.target.value as typeof windowFn)}>
            {WINDOW_FUNCTIONS.map(w => <option key={w} value={w}>{w}</option>)}
          </Select>
        </Field>

        <Field>
          <Label>Frequency Scale</Label>
          <Select value={freqScale} onChange={e => setFreqScale(e.target.value as typeof freqScale)}>
            {FREQ_SCALES.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>

        <Field>
          <Label>Color Map</Label>
          <Select value={localColorMap} onChange={e => setLocalColorMap(e.target.value as ColorMapName)}>
            {COLOR_MAPS.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>

        <Field>
          <Label>Min Frequency (Hz)</Label>
          <NumberInput type="number" min={0} max={5000} step={50} value={minFreq}
            onChange={e => setMinFreq(Number(e.target.value))} />
        </Field>

        <Field>
          <Label>Max Frequency (Hz)</Label>
          <NumberInput type="number" min={1000} max={22050} step={50} value={maxFreq}
            onChange={e => setMaxFreq(Number(e.target.value))} />
        </Field>

        <Field>
          <Label>Range (dB)</Label>
          <NumberInput type="number" min={1} max={120} step={1} value={rangeDb}
            onChange={e => setRangeDb(Number(e.target.value))} />
        </Field>

        <Field>
          <Label>Gain (dB)</Label>
          <NumberInput type="number" min={-20} max={60} step={1} value={gainDb}
            onChange={e => setGainDb(Number(e.target.value))} />
        </Field>

        <Field $span>
          <CheckboxLabel>
            <input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} />
            Show Frequency Labels
          </CheckboxLabel>
        </Field>
      </FormGrid>

      <ButtonRow>
        <ModalButton onClick={onClose}>Cancel</ModalButton>
        <ModalButton $primary onClick={handleApply}>Apply</ModalButton>
      </ButtonRow>
    </StyledDialog>
  );
};
