import { CosmosRoom, RoomMatchResult } from "../types/room";
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

export const COSMOS_ROOMS: CosmosRoom[] = [
  {
    id: "social-lounge",
    name: "Social Lounge",
    accentName: "Meet & Mingle",
    bounds: { x: LEFT_X, y: TOP_Y, width: ROOM_WIDTH, height: ROOM_HEIGHT },
    fillColor: 0x1e3a8a,
    borderColor: 0x60a5fa,
  },
  {
    id: "innovation-hub",
    name: "Innovation Hub",
    accentName: "Build & Ship",
    bounds: { x: RIGHT_X, y: TOP_Y, width: ROOM_WIDTH, height: ROOM_HEIGHT },
    fillColor: 0x0f766e,
    borderColor: 0x2dd4bf,
  },
  {
    id: "game-arena",
    name: "Game Arena",
    accentName: "Play & Compete",
    bounds: { x: LEFT_X, y: BOTTOM_Y, width: ROOM_WIDTH, height: ROOM_HEIGHT },
    fillColor: 0x7c2d12,
    borderColor: 0xfb923c,
  },
  {
    id: "zen-garden",
    name: "Zen Garden",
    accentName: "Relax & Reflect",
    bounds: { x: RIGHT_X, y: BOTTOM_Y, width: ROOM_WIDTH, height: ROOM_HEIGHT },
    fillColor: 0x4c1d95,
    borderColor: 0xc4b5fd,
  },
];

const isWithinBounds = (position: Position, room: CosmosRoom): boolean => {
  const maxX = room.bounds.x + room.bounds.width;
  const maxY = room.bounds.y + room.bounds.height;
  return position.x >= room.bounds.x && position.x <= maxX && position.y >= room.bounds.y && position.y <= maxY;
};

const getRoomCenterDistanceSquared = (position: Position, room: CosmosRoom): number => {
  const centerX = room.bounds.x + room.bounds.width / 2;
  const centerY = room.bounds.y + room.bounds.height / 2;
  const dx = position.x - centerX;
  const dy = position.y - centerY;
  return dx * dx + dy * dy;
};

export const getRoomByPosition = (position: Position): RoomMatchResult => {
  const directMatch = COSMOS_ROOMS.find((room) => isWithinBounds(position, room));
  if (directMatch) {
    return { room: directMatch, isInside: true };
  }

  const fallback = COSMOS_ROOMS.reduce((closest, room) => {
    if (!closest) {
      return room;
    }

    const closestDistance = getRoomCenterDistanceSquared(position, closest);
    const currentDistance = getRoomCenterDistanceSquared(position, room);
    return currentDistance < closestDistance ? room : closest;
  }, COSMOS_ROOMS[0]);

  return {
    room: fallback,
    isInside: false,
  };
};

export const getRoomNameByPosition = (position: Position): string => {
  return getRoomByPosition(position).room.name;
};
