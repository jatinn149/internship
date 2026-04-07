const LOCAL_FRONTEND_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
];

const TRYCLOUDFLARE_ORIGIN_PATTERN = /^https?:\/\/([a-z0-9-]+\.)*trycloudflare\.com$/i;

const parseConfiguredOrigins = (): string[] => {
  return (process.env.FRONTEND_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const createOriginChecker = (): ((origin: string | undefined) => boolean) => {
  const configuredOrigins = parseConfiguredOrigins();
  const allowedOriginSet = new Set<string>([...LOCAL_FRONTEND_ORIGINS, ...configuredOrigins]);

  return (origin: string | undefined): boolean => {
    if (!origin) {
      return true;
    }

    if (allowedOriginSet.has(origin)) {
      return true;
    }

    return TRYCLOUDFLARE_ORIGIN_PATTERN.test(origin);
  };
};
