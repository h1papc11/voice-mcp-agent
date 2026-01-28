const DEBUG = import.meta.env.DEV;

export const debug = {
  log: (...args: unknown[]) => {
    if (DEBUG) {
      console.log(...args);
    }
  },
  error: (...args: unknown[]) => {
    if (DEBUG) {
      console.error(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (DEBUG) {
      console.warn(...args);
    }
  },
};
