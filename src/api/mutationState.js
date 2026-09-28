const listeners = new Set();
const pending = new Map();
let snapshot = 0;

const emit = () => {
  snapshot = pending.size;
  listeners.forEach((listener) => listener());
};

export const subscribeMutations = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getMutationCount = () => snapshot;

// A rapid second submit of the same action shares its first request.
export function runMutation(key, request) {
  if (pending.has(key)) return pending.get(key);
  const promise = (async () => {
    try {
      return await request();
    } finally {
      pending.delete(key);
      emit();
    }
  })();
  pending.set(key, promise);
  emit();
  return promise;
}
