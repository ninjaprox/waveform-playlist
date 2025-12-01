// Re-export Tone.js for convenience
import * as Tone from 'tone';
export { Tone };

// Export types from playout
export type { EffectsFunction, TrackEffectsFunction } from '@waveform-playlist/playout';

// Export new flexible/headless API
export {
  WaveformPlaylistProvider,
  useWaveformPlaylist,
  usePlaybackAnimation,
  usePlaylistState,
  usePlaylistControls,
  usePlaylistData,
} from './WaveformPlaylistContext';
export type { WaveformPlaylistContextValue, WaveformTrack, TrackState } from './WaveformPlaylistContext';

// Export MediaElement-based provider (single-track with playback rate control)
export {
  MediaElementPlaylistProvider,
  useMediaElementAnimation,
  useMediaElementState,
  useMediaElementControls,
  useMediaElementData,
} from './MediaElementPlaylistContext';
export type {
  MediaElementTrackConfig,
  MediaElementAnimationContextValue,
  MediaElementStateContextValue,
  MediaElementControlsContextValue,
  MediaElementDataContextValue,
} from './MediaElementPlaylistContext';
export {
  useClipDragHandlers,
  useAnnotationDragHandlers,
  useAnnotationKeyboardControls,
  useDragSensors,
  useClipSplitting,
  useKeyboardShortcuts,
  getShortcutLabel,
  usePlaybackShortcuts,
  useAudioTracks,
  useIntegratedRecording,
  useZoomControls,
  useTimeFormat,
  useMasterVolume,
  useMasterAnalyser,
  useDynamicEffects,
  useTrackDynamicEffects,
  useExportWav,
} from './hooks';
export type {
  AudioTrackConfig,
  UseIntegratedRecordingReturn,
  IntegratedRecordingOptions,
  UsePlaybackShortcutsOptions,
  UsePlaybackShortcutsReturn,
  ZoomControls,
  TimeFormatControls,
  MasterVolumeControls,
  UseDynamicEffectsReturn,
  ActiveEffect,
  UseTrackDynamicEffectsReturn,
  TrackActiveEffect,
  TrackEffectsState,
  ExportOptions,
  ExportResult,
  UseExportWavReturn,
} from './hooks';

// Export effect definitions and factory
export {
  effectDefinitions,
  effectCategories,
  getEffectDefinition,
  getEffectsByCategory,
} from './effects';
export type {
  EffectDefinition,
  EffectParameter,
  ParameterType,
} from './effects';
export {
  createEffectInstance,
  createEffectChain,
} from './effects';
export type { EffectInstance } from './effects';
export {
  PlayButton,
  PauseButton,
  StopButton,
  RewindButton,
  FastForwardButton,
  SkipBackwardButton,
  SkipForwardButton,
  LoopButton,
  SetLoopRegionButton,
  ZoomInButton,
  ZoomOutButton,
  MasterVolumeControl,
  TimeFormatSelect,
  AudioPosition,
  SelectionTimeInputs,
  AutomaticScrollCheckbox,
  ContinuousPlayCheckbox,
  LinkEndpointsCheckbox,
  EditableCheckbox,
  DownloadAnnotationsButton,
  ExportWavButton,
  Waveform,
  MediaElementWaveform,
} from './components';
export type { ExportWavButtonProps } from './components/ExportControls';
export type { WaveformProps } from './components/Waveform';
export type { MediaElementWaveformProps } from './components/MediaElementWaveform';

// Re-export TimeFormat type from ui-components for convenience
export type { TimeFormat } from '@waveform-playlist/ui-components';

// Re-export core types for convenience
export type { ClipTrack, AudioClip, Fade } from '@waveform-playlist/core';

// Re-export annotation types for custom rendering
export type { RenderAnnotationItemProps, AnnotationData } from '@waveform-playlist/annotations';

// Export waveform-data.js utilities
export {
  loadWaveformData,
  waveformDataToPeaks,
  loadPeaksFromWaveformData,
  getWaveformDataMetadata,
} from './waveformDataLoader';
