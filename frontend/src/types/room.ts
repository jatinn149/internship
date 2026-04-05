import { Position } from "./user";

export type RoomId = "social-lounge" | "innovation-hub" | "game-arena" | "zen-garden";

export interface RoomBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CosmosRoom {
  id: RoomId;
  name: string;
  accentName: string;
  bounds: RoomBounds;
  fillColor: number;
  borderColor: number;
}

export interface RoomMatchResult {
  room: CosmosRoom;
  isInside: boolean;
}

export interface RoomPositionInput extends Position {
  x: number;
  y: number;
}
