import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

export const getSocketClient = (): Socket => {
  if (!socketInstance) {
    socketInstance = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:4000", {
      transports: ["websocket"],
      withCredentials: true,
      autoConnect: true,
    });
  }

  return socketInstance;
};
