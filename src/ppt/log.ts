const PREFIX = '[ppt]';

export function pptLog(...args: unknown[]) {
  console.log(PREFIX, ...args);
}

export function pptLogWarn(...args: unknown[]) {
  console.warn(PREFIX, ...args);
}

export function pptLogError(...args: unknown[]) {
  console.error(PREFIX, ...args);
}
