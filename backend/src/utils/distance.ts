import { Position } from "../types/user";

export const calculateDistance = (first: Position, second: Position): number => {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  return Math.sqrt(dx * dx + dy * dy);
};
