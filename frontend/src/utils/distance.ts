interface PositionLike {
  x: number;
  y: number;
}

export const calculateDistance = (first: PositionLike, second: PositionLike): number => {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  return Math.sqrt(dx * dx + dy * dy);
};
