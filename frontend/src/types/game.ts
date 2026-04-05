export type ArenaGameType = "tap-race" | "dice-clash";

export interface ArenaChallengeSnapshot {
  fromUserId: string;
  toUserId: string;
  gameType: ArenaGameType;
  createdAt: string;
}

export interface ArenaLobbySnapshot {
  availablePlayerUserIds: string[];
  incomingChallenges: ArenaChallengeSnapshot[];
  outgoingChallenges: ArenaChallengeSnapshot[];
  hasActiveGame: boolean;
}

export interface ArenaGameSnapshot {
  gameId: string;
  gameType: ArenaGameType;
  status: "active" | "finished";
  participants: string[];
  scores: Record<string, number>;
  winnerUserId: string | null;
  createdAt: string;
  endsAt: string;
  targetScore?: number;
}
