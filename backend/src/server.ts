import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import app from "./app";
import { registerSocketHandlers } from "./socket/handlers";
import { CosmosState } from "./socket/state";
import { connectDatabase } from "./utils/database";

const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/virtual-cosmos";
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: frontendUrl,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const state = new CosmosState();
registerSocketHandlers(io, state);

const bootstrap = async (): Promise<void> => {
  await connectDatabase(mongoUri);

  httpServer.listen(port, () => {
    console.log(`Virtual Cosmos backend listening on port ${port}`);
  });
};

void bootstrap().catch((error) => {
  console.error("Failed to bootstrap backend", error);
  process.exit(1);
});
