'use client';

import { PptBackgroundToast } from './ppt-background-toast';
import { ResearchBackgroundToast } from './research-background-toast';

export function AppBackgroundToasts() {
  return (
    <>
      <ResearchBackgroundToast />
      <PptBackgroundToast />
    </>
  );
}
