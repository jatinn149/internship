import { Schema, model } from "mongoose";

interface UserSessionDocument {
  userId: string;
  lastPosition: {
    x: number;
    y: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSessionSchema = new Schema<UserSessionDocument>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    lastPosition: {
      x: { type: Number, required: true, default: 0 },
      y: { type: Number, required: true, default: 0 },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const UserSession = model<UserSessionDocument>("UserSession", userSessionSchema);
