import cors from "cors";
import express from "express";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "virtual-cosmos-backend" });
});

export default app;
