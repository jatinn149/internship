import { Position } from "../types/user";
import { WORLD_HEIGHT, WORLD_WIDTH } from "./constants";

interface SpawnRoom {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

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

const SPAWN_ROOMS: SpawnRoom[] = [
  { id: "social-lounge", x: LEFT_X, y: TOP_Y, width: ROOM_WIDTH, height: ROOM_HEIGHT },
  { id: "innovation-hub", x: RIGHT_X, y: TOP_Y, width: ROOM_WIDTH, height: ROOM_HEIGHT },
  { id: "game-arena", x: LEFT_X, y: BOTTOM_Y, width: ROOM_WIDTH, height: ROOM_HEIGHT },
  { id: "zen-garden", x: RIGHT_X, y: BOTTOM_Y, width: ROOM_WIDTH, height: ROOM_HEIGHT },
];

const SPAWN_PADDING = 28;
const SAFE_DISTANCE = 42;
const MAX_SPAWN_ATTEMPTS = 24;

const distanceSquared = (first: Position, second: Position): number => {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  return dx * dx + dy * dy;
};

const isInsideRoom = (position: Position, room: SpawnRoom): boolean => {
  return (
    position.x >= room.x &&
    position.x <= room.x + room.width &&
    position.y >= room.y &&
    position.y <= room.y + room.height
  );
};

const nearestRoomForPosition = (position: Position): SpawnRoom => {
  return SPAWN_ROOMS.reduce((closestRoom, room) => {
    const roomCenter = { x: room.x + room.width / 2, y: room.y + room.height / 2 };
    const closestCenter = {
      x: closestRoom.x + closestRoom.width / 2,
      y: closestRoom.y + closestRoom.height / 2,
    };

    return distanceSquared(position, roomCenter) < distanceSquared(position, closestCenter) ? room : closestRoom;
  }, SPAWN_ROOMS[0]);
};

const roomForPosition = (position: Position): SpawnRoom => {
  return SPAWN_ROOMS.find((room) => isInsideRoom(position, room)) ?? nearestRoomForPosition(position);
};

const randomBetween = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

const randomPointInRoom = (room: SpawnRoom): Position => {
  return {
    x: randomBetween(room.x + SPAWN_PADDING, room.x + room.width - SPAWN_PADDING),
    y: randomBetween(room.y + SPAWN_PADDING, room.y + room.height - SPAWN_PADDING),
  };
};

const pickLeastCrowdedRoom = (existingPositions: Position[]): SpawnRoom => {
  const roomCounts = new Map<string, number>();
  SPAWN_ROOMS.forEach((room) => roomCounts.set(room.id, 0));

  existingPositions.forEach((position) => {
    const room = roomForPosition(position);
    roomCounts.set(room.id, (roomCounts.get(room.id) ?? 0) + 1);
  });

  const minCount = Math.min(...Array.from(roomCounts.values()));
  const candidates = SPAWN_ROOMS.filter((room) => (roomCounts.get(room.id) ?? 0) === minCount);
  return candidates[Math.floor(Math.random() * candidates.length)];
};

const hasSafeDistance = (candidate: Position, existingPositions: Position[]): boolean => {
  const minDistanceSquared = SAFE_DISTANCE * SAFE_DISTANCE;
  return existingPositions.every((position) => distanceSquared(candidate, position) >= minDistanceSquared);
};

export const generatePreferredSpawnPosition = (existingPositions: Position[]): Position => {
  const selectedRoom = pickLeastCrowdedRoom(existingPositions);

  for (let attempt = 0; attempt < MAX_SPAWN_ATTEMPTS; attempt += 1) {
    const candidate = randomPointInRoom(selectedRoom);
    if (hasSafeDistance(candidate, existingPositions)) {
      return candidate;
    }
  }

  return {
    x: selectedRoom.x + selectedRoom.width / 2,
    y: selectedRoom.y + selectedRoom.height / 2,
  };
};
