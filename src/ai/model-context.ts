import { AsyncLocalStorage } from 'async_hooks';

const researchModelStorage = new AsyncLocalStorage<string | undefined>();

export function runWithResearchModel<T>(
  modelId: string | undefined,
  fn: () => T,
): T {
  return researchModelStorage.run(modelId, fn);
}

export function getActiveResearchModel(): string | undefined {
  return researchModelStorage.getStore();
}
