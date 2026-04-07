import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import app from "./app";
import { registerSocketHandlers } from "./socket/handlers";
import { CosmosState } from "./socket/state";
import { createOriginChecker } from "./utils/cors";
import { connectDatabase } from "./utils/database";

const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/virtual-cosmos";
const requireDatabase = String(process.env.REQUIRE_DATABASE || "").toLowerCase() === "true";
const isAllowedOrigin = createOriginChecker();

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Socket.IO CORS blocked for origin: ${origin ?? "unknown"}`));
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const state = new CosmosState();
registerSocketHandlers(io, state);

const bootstrap = async (): Promise<void> => {
  try {
    await connectDatabase(mongoUri);
    console.log("MongoDB connected");
  } catch (error) {
    if (requireDatabase) {
      throw error;
    }

    console.warn("MongoDB unavailable. Continuing in degraded mode without session persistence.");
    console.warn(error);
  }

  httpServer.listen(port, () => {
    console.log(`Virtual Cosmos backend listening on port ${port}`);
  });
};

void bootstrap().catch((error) => {
  console.error("Failed to bootstrap backend", error);
  process.exit(1);
});
