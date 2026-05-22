import type { SlideBoxKey } from './ppt-types';

export type SlideBoxRole =
  | 'title'
  | 'subtitle'
  | 'body'
  | 'columnTitle'
  | 'columnBody'
  | 'image';

export function slideBoxRole(key: SlideBoxKey): SlideBoxRole {
  if (key === 'image') {
    return 'image';
  }
  if (key === 'title') {
    return 'title';
  }
  if (key === 'subtitle') {
    return 'subtitle';
  }
  if (key === 'body') {
    return 'body';
  }
  if (key === 'leftTitle' || key === 'rightTitle') {
    return 'columnTitle';
  }
  return 'columnBody';
}
