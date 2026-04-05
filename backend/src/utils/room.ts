export const getRoomId = (userA: string, userB: string): string => {
  const [first, second] = [userA, userB].sort((a, b) => a.localeCompare(b));
  return `${first}:${second}`;
};
