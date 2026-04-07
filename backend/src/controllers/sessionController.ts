import mongoose from "mongoose";
import { Position } from "../types/user";
import { UserSession } from "../models/UserSession";

export const saveUserSession = async (userId: string, position: Position): Promise<void> => {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  await UserSession.findOneAndUpdate(
    { userId },
    {
      $set: {
        lastPosition: position,
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
};
