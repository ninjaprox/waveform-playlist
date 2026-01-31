import type { ReactNode } from 'react';

export interface TrackMenuItem {
  id: string;
  label?: string;
  content: ReactNode;
}
