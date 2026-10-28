let tail = Promise.resolve();

/** Serializes short save/create/load/switch operations inside this server process. */
export function withCareerOperationLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = tail.then(operation, operation);
  tail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
