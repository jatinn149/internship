import cors from "cors";
import express from "express";
import { createOriginChecker } from "./utils/cors";

const app = express();
const isAllowedOrigin = createOriginChecker();

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin ?? "unknown"}`));
    },
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "virtual-cosmos-backend" });
});

export default app;
