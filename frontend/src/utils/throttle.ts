export const throttle = <T extends (...args: any[]) => void>(
  callback: T,
  waitMs: number
): ((...args: Parameters<T>) => void) => {
  let lastRun = 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let trailingArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = waitMs - (now - lastRun);

    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }

      lastRun = now;
      callback(...args);
      return;
    }

    trailingArgs = args;
    if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null;
        lastRun = Date.now();

        if (trailingArgs) {
          callback(...trailingArgs);
          trailingArgs = null;
        }
      }, remaining);
    }
  };
};
