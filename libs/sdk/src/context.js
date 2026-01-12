import { AsyncLocalStorage } from 'async_hooks';

export const context = new AsyncLocalStorage();

export function getContext() {
  return context.getStore();
}

export function runWithContext(store, callback) {
  return context.run(store, callback);
}
