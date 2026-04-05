import { Position } from "../types/user";
import { WORLD_HEIGHT, WORLD_WIDTH } from "./constants";

const OUTER_MARGIN = 72;
const SHARED_CORRIDOR = 56;
const INNER_WIDTH = WORLD_WIDTH - OUTER_MARGIN * 2;
const INNER_HEIGHT = WORLD_HEIGHT - OUTER_MARGIN * 2;
const ROOM_WIDTH = (INNER_WIDTH - SHARED_CORRIDOR) / 2;
const ROOM_HEIGHT = (INNER_HEIGHT - SHARED_CORRIDOR) / 2;
const TOP_Y = OUTER_MARGIN;
const LEFT_X = OUTER_MARGIN;
const RIGHT_X = OUTER_MARGIN + ROOM_WIDTH + SHARED_CORRIDOR;
const BOTTOM_Y = OUTER_MARGIN + ROOM_HEIGHT + SHARED_CORRIDOR;

const SOCIAL_LOUNGE_BOUNDS = {
  x: LEFT_X,
  y: TOP_Y,
  width: ROOM_WIDTH,
  height: ROOM_HEIGHT,
};

const INNOVATION_HUB_BOUNDS = {
  x: RIGHT_X,
  y: TOP_Y,
  width: ROOM_WIDTH,
  height: ROOM_HEIGHT,
};

const GAME_ARENA_BOUNDS = {
  x: LEFT_X,
  y: BOTTOM_Y,
  width: ROOM_WIDTH,
  height: ROOM_HEIGHT,
};

const isWithinBounds = (position: Position, bounds: { x: number; y: number; width: number; height: number }): boolean => {
  const maxX = bounds.x + bounds.width;
  const maxY = bounds.y + bounds.height;

  return position.x >= bounds.x && position.x <= maxX && position.y >= bounds.y && position.y <= maxY;
};

export const isInSocialLounge = (position: Position): boolean => {
  return isWithinBounds(position, SOCIAL_LOUNGE_BOUNDS);
};

export const isInInnovationHub = (position: Position): boolean => {
  return isWithinBounds(position, INNOVATION_HUB_BOUNDS);
};

export const isInGameArena = (position: Position): boolean => {
  return isWithinBounds(position, GAME_ARENA_BOUNDS);
};
