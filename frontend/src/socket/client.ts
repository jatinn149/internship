import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

const resolveSocketUrl = (): string | undefined => {
  const configuredUrl = (import.meta.env.VITE_SOCKET_URL || "").trim();
  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window !== "undefined") {
    // Same-origin fallback works for localhost and cloudflared frontend tunnels.
    return window.location.origin;
  }

  return undefined;
};

export const getSocketClient = (): Socket => {
  if (!socketInstance) {
    socketInstance = io(resolveSocketUrl(), {
      path: "/socket.io",
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
    });
  }

  return socketInstance;
};
