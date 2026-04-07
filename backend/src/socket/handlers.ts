import { Server, Socket } from "socket.io";
import { saveUserSession } from "../controllers/sessionController";
import {
  ArenaGameActionPayload,
  ArenaChallengeResponsePayload,
  ArenaChallengeSnapshot,
  ArenaGameSnapshot,
  ArenaLobbySnapshot,
  ArenaGameType,
  ChatMessage,
  ConnectUserPayload,
  InnovationIdea,
  InnovationIdeaAddPayload,
  InnovationIdeaVotePayload,
  InnovationPitchAnswerPayload,
  InnovationPitchIceCandidatePayload,
  InnovationPitchMicPayload,
  InnovationPitchOfferPayload,
  InnovationStateSnapshot,
  InnovationWhiteboardPoint,
  InnovationWhiteboardStroke,
  InnovationWhiteboardStrokePayload,
  JoinCosmosPayload,
  SocialVoiceAnswerPayload,
  SocialVoiceIceCandidatePayload,
  SocialVoiceMicPayload,
  SocialVoiceOfferPayload,
  SendMessagePayload,
  StartArenaGamePayload,
} from "../types/socket";
import { AvatarGender, AvatarHairStyle, AvatarOutfitColor, AvatarProfile, AvatarSkinTone, Position } from "../types/user";
import { SERVER_BROADCAST_INTERVAL_MS, PROXIMITY_RADIUS } from "../utils/constants";
import { isInGameArena, isInInnovationHub, isInSocialLounge } from "../utils/rooms";
import { CosmosState } from "./state";

const ALLOWED_GENDERS: AvatarGender[] = ["male", "female"];
const ALLOWED_SKIN_TONES: AvatarSkinTone[] = ["light", "medium", "dark"];
const ALLOWED_OUTFIT_COLORS: AvatarOutfitColor[] = ["azure", "rose", "emerald", "amber"];
const ALLOWED_HAIR_STYLES: AvatarHairStyle[] = ["short", "long", "curly"];

const DEFAULT_AVATAR: AvatarProfile = {
  gender: "male",
  skinTone: "medium",
  outfitColor: "azure",
  hairStyle: "short",
};

const TAP_RACE_TARGET_SCORE = 18;
const TAP_RACE_DURATION_MS = 45_000;
const DICE_CLASH_DURATION_MS = 35_000;
const ARENA_CHALLENGE_TTL_MS = 35_000;
const INNOVATION_WHITEBOARD_MAX_STROKES = 300;
const INNOVATION_WHITEBOARD_MAX_POINTS = 220;
const INNOVATION_IDEA_MAX_ITEMS = 60;
const INNOVATION_IDEA_MAX_LENGTH = 160;
const DEFAULT_WHITEBOARD_STROKE_COLOR = "#0f172a";
const DEFAULT_WHITEBOARD_STROKE_WIDTH = 2;
const WHITEBOARD_STROKE_WIDTH_MIN = 1;
const WHITEBOARD_STROKE_WIDTH_MAX = 8;

interface ArenaGameRuntime {
  gameId: string;
  gameType: ArenaGameType;
  status: "active" | "finished";
  participants: string[];
  scores: Record<string, number>;
  winnerUserId: string | null;
  createdAt: string;
  endsAt: string;
  targetScore?: number;
  rolledBy: Set<string>;
  timeoutId: NodeJS.Timeout | null;
  resolveWindowTimeoutId: NodeJS.Timeout | null;
}

interface ArenaChallengeRuntime {
  id: string;
  fromUserId: string;
  toUserId: string;
  gameType: ArenaGameType;
  createdAt: string;
  createdAtMs: number;
}

interface InnovationIdeaRuntime {
  id: string;
  text: string;
  createdBy: string;
  voterUserIds: Set<string>;
  createdAt: string;
}

interface InnovationRuntime {
  presenterUserId: string | null;
  pitchMicEnabled: boolean;
  whiteboardStrokes: InnovationWhiteboardStroke[];
  ideas: InnovationIdeaRuntime[];
}

const sanitizeUserId = (incoming?: string): string => {
  const base = incoming?.trim() || "traveler";
  return base.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 24) || "traveler";
};

const sanitizeDisplayName = (incoming?: string): string => {
  const base = incoming?.trim() || "Traveler";
  return base.replace(/\s+/g, " ").replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 24) || "Traveler";
};

const sanitizeAvatarProfile = (incoming?: Partial<AvatarProfile>): AvatarProfile => {
  const gender = incoming?.gender;
  const skinTone = incoming?.skinTone;
  const outfitColor = incoming?.outfitColor;
  const hairStyle = incoming?.hairStyle;

  return {
    gender: ALLOWED_GENDERS.includes(gender as AvatarGender) ? (gender as AvatarGender) : DEFAULT_AVATAR.gender,
    skinTone: ALLOWED_SKIN_TONES.includes(skinTone as AvatarSkinTone)
      ? (skinTone as AvatarSkinTone)
      : DEFAULT_AVATAR.skinTone,
    outfitColor: ALLOWED_OUTFIT_COLORS.includes(outfitColor as AvatarOutfitColor)
      ? (outfitColor as AvatarOutfitColor)
      : DEFAULT_AVATAR.outfitColor,
    hairStyle: ALLOWED_HAIR_STYLES.includes(hairStyle as AvatarHairStyle)
      ? (hairStyle as AvatarHairStyle)
      : DEFAULT_AVATAR.hairStyle,
  };
};

const ensureUniqueUserId = (baseUserId: string, state: CosmosState): string => {
  if (!state.hasUserId(baseUserId)) {
    return baseUserId;
  }

  let sequence = 1;
  let candidate = `${baseUserId}-${sequence}`;

  while (state.hasUserId(candidate)) {
    sequence += 1;
    candidate = `${baseUserId}-${sequence}`;
  }

  return candidate;
};

const safelyPersistSession = (userId: string, position: Position): void => {
  void saveUserSession(userId, position).catch((error) => {
    console.error("Failed to save user session", { userId, error });
  });
};

const syncSocketRoomMembership = (io: Server, state: CosmosState, userId: string): void => {
  const socketId = state.getSocketIdByUserId(userId);
  if (!socketId) {
    return;
  }

  const socket = io.sockets.sockets.get(socketId);
  if (!socket) {
    return;
  }

  const targetRoomId = state.getRoomIdByUserId(userId);

  socket.rooms.forEach((roomId) => {
    if (roomId === socket.id) {
      return;
    }

    if (CosmosState.isManagedRoom(roomId) && roomId !== targetRoomId) {
      socket.leave(roomId);
    }
  });

  if (targetRoomId) {
    socket.join(targetRoomId);
  }
};

const emitRoomSnapshotToUser = (io: Server, state: CosmosState, userId: string): void => {
  const socketId = state.getSocketIdByUserId(userId);
  if (!socketId) {
    return;
  }

  io.to(socketId).emit("chat-room-update", state.getChatSnapshotForUser(userId));
};

const getSnapshotKey = (snapshot: { roomId: string | null; memberUserIds: string[] }): string => {
  return `${snapshot.roomId ?? "none"}|${snapshot.memberUserIds.join(",")}`;
};

const reconcileAndBroadcastRooms = (io: Server, state: CosmosState): void => {
  const userIds = state.listUserIds();
  const previousSnapshotKeyByUser = new Map<string, string>();

  userIds.forEach((userId) => {
    previousSnapshotKeyByUser.set(userId, getSnapshotKey(state.getChatSnapshotForUser(userId)));
  });

  state.reconcileRooms();

  userIds.forEach((userId) => {
    syncSocketRoomMembership(io, state, userId);

    const nextSnapshot = state.getChatSnapshotForUser(userId);
    const nextSnapshotKey = getSnapshotKey(nextSnapshot);
    if (previousSnapshotKeyByUser.get(userId) !== nextSnapshotKey) {
      const socketId = state.getSocketIdByUserId(userId);
      if (socketId) {
        io.to(socketId).emit("chat-room-update", nextSnapshot);
      }
    }
  });
};

export const registerSocketHandlers = (io: Server, state: CosmosState): void => {
  let usersDirty = false;
  let roomReconcileQueued = false;
  const arenaGamesById = new Map<string, ArenaGameRuntime>();
  const arenaGameIdByUserId = new Map<string, string>();
  const arenaChallengesById = new Map<string, ArenaChallengeRuntime>();
  const socialVoiceEnabledUserIds = new Set<string>();
  const innovation: InnovationRuntime = {
    presenterUserId: null,
    pitchMicEnabled: false,
    whiteboardStrokes: [],
    ideas: [],
  };

  const clamp = (value: number, min: number, max: number): number => {
    return Math.min(Math.max(value, min), max);
  };

  const sanitizeWhiteboardColor = (incoming?: string): string => {
    const candidate = (incoming ?? "").trim();
    if (/^#[0-9a-fA-F]{6}$/.test(candidate)) {
      return candidate.toLowerCase();
    }

    return DEFAULT_WHITEBOARD_STROKE_COLOR;
  };

  const sanitizeWhiteboardPoints = (points: InnovationWhiteboardPoint[]): InnovationWhiteboardPoint[] => {
    return points
      .slice(0, INNOVATION_WHITEBOARD_MAX_POINTS)
      .map((point) => ({
        x: clamp(Number(point?.x ?? 0), 0, 1),
        y: clamp(Number(point?.y ?? 0), 0, 1),
      }));
  };

  const getInnovationParticipantUserIds = (): string[] => {
    return state
      .listUsers()
      .filter((user) => isInInnovationHub({ x: user.x, y: user.y }))
      .map((user) => user.id)
      .sort((first, second) => first.localeCompare(second));
  };

  const toInnovationIdeaSnapshot = (idea: InnovationIdeaRuntime): InnovationIdea => {
    const voteUserIds = Array.from(idea.voterUserIds).sort((first, second) => first.localeCompare(second));

    return {
      id: idea.id,
      text: idea.text,
      createdBy: idea.createdBy,
      voteCount: voteUserIds.length,
      voteUserIds,
      createdAt: idea.createdAt,
    };
  };

  const getInnovationSnapshot = (): InnovationStateSnapshot => {
    const participantUserIds = getInnovationParticipantUserIds();
    const presenterAvailable = innovation.presenterUserId ? participantUserIds.includes(innovation.presenterUserId) : false;
    const presenterUserId = presenterAvailable ? innovation.presenterUserId : null;
    const pitchMicEnabled = presenterAvailable ? innovation.pitchMicEnabled : false;

    if (!presenterAvailable) {
      innovation.presenterUserId = null;
      innovation.pitchMicEnabled = false;
    }

    return {
      presenterUserId,
      pitchMicEnabled,
      pitchSpeakerUserId: presenterUserId && pitchMicEnabled ? presenterUserId : null,
      participantUserIds,
      whiteboardStrokes: innovation.whiteboardStrokes,
      ideas: innovation.ideas.map(toInnovationIdeaSnapshot),
    };
  };

  const emitInnovationUpdate = (): void => {
    io.emit("innovation-state-update", getInnovationSnapshot());
  };

  const stopInnovationPresenterIfNeeded = (reason?: string): void => {
    const presenterId = innovation.presenterUserId;
    if (!presenterId) {
      return;
    }

    const presenter = state.getUserByUserId(presenterId);
    if (presenter && isInInnovationHub(presenter.position)) {
      return;
    }

    innovation.presenterUserId = null;
    innovation.pitchMicEnabled = false;

    if (presenterId) {
      const presenterSocketId = state.getSocketIdByUserId(presenterId);
      if (presenterSocketId) {
        io.to(presenterSocketId).emit("innovation-pitch-forced-off", {
          reason: reason ?? "left-innovation-room",
        });
      }
    }

    emitInnovationUpdate();
  };

  const canUseInnovationPitchSpeaker = (userId: string): boolean => {
    if (innovation.presenterUserId !== userId || !innovation.pitchMicEnabled) {
      return false;
    }

    const user = state.getUserByUserId(userId);
    if (!user) {
      return false;
    }

    return isInInnovationHub(user.position);
  };

  const canUseInnovationPitchListener = (userId: string): boolean => {
    const user = state.getUserByUserId(userId);
    if (!user) {
      return false;
    }

    return isInInnovationHub(user.position);
  };

  const emitSocialVoiceParticipants = (): void => {
    io.emit("social-voice-participants", {
      userIds: Array.from(socialVoiceEnabledUserIds).sort((first, second) => first.localeCompare(second)),
    });
  };

  const removeSocialVoiceForUser = (
    userId: string,
    options: { notifyUser?: boolean; reason?: string } = {}
  ): boolean => {
    const didRemove = socialVoiceEnabledUserIds.delete(userId);
    if (!didRemove) {
      return false;
    }

    if (options.notifyUser) {
      const socketId = state.getSocketIdByUserId(userId);
      if (socketId) {
        io.to(socketId).emit("social-voice-forced-off", {
          reason: options.reason ?? "left-social-lounge",
        });
      }
    }

    emitSocialVoiceParticipants();
    return true;
  };

  const canListenSocialVoice = (userId: string): boolean => {
    const user = state.getUserByUserId(userId);
    if (!user) {
      return false;
    }

    return isInSocialLounge(user.position);
  };

  const canSpeakSocialVoice = (userId: string): boolean => {
    return canListenSocialVoice(userId) && socialVoiceEnabledUserIds.has(userId);
  };

  const canRouteSocialVoiceBetween = (sourceUserId: string, targetUserId: string): boolean => {
    if (sourceUserId === targetUserId) {
      return false;
    }

    if (!canListenSocialVoice(sourceUserId) || !canListenSocialVoice(targetUserId)) {
      return false;
    }

    if (!state.areUsersConnected(sourceUserId, targetUserId)) {
      return false;
    }

    // At least one side must be actively speaking-enabled for a valid voice route.
    return canSpeakSocialVoice(sourceUserId) || canSpeakSocialVoice(targetUserId);
  };

  const getArenaUserIds = (): string[] => {
    return state
      .listUsers()
      .filter((user) => isInGameArena({ x: user.x, y: user.y }))
      .map((user) => user.id)
      .sort((first, second) => first.localeCompare(second));
  };

  const getArenaGameByUserId = (userId: string): ArenaGameRuntime | null => {
    const gameId = arenaGameIdByUserId.get(userId);
    if (!gameId) {
      return null;
    }

    const game = arenaGamesById.get(gameId);
    if (!game) {
      arenaGameIdByUserId.delete(userId);
      return null;
    }

    return game;
  };

  const isUserInArenaGame = (userId: string): boolean => {
    return getArenaGameByUserId(userId) !== null;
  };

  const clearArenaGameTimers = (game: ArenaGameRuntime): void => {
    if (game.timeoutId) {
      clearTimeout(game.timeoutId);
      game.timeoutId = null;
    }

    if (game.resolveWindowTimeoutId) {
      clearTimeout(game.resolveWindowTimeoutId);
      game.resolveWindowTimeoutId = null;
    }
  };

  const dropArenaGame = (gameId: string): void => {
    const game = arenaGamesById.get(gameId);
    if (!game) {
      return;
    }

    clearArenaGameTimers(game);

    game.participants.forEach((participantUserId) => {
      const mappedGameId = arenaGameIdByUserId.get(participantUserId);
      if (mappedGameId === gameId) {
        arenaGameIdByUserId.delete(participantUserId);
      }
    });

    arenaGamesById.delete(gameId);
  };

  const removeArenaChallengesBetweenUsers = (firstUserId: string, secondUserId: string): void => {
    const challengeIdsToRemove: string[] = [];

    arenaChallengesById.forEach((challenge, challengeId) => {
      const isDirectPair = challenge.fromUserId === firstUserId && challenge.toUserId === secondUserId;
      const isReversePair = challenge.fromUserId === secondUserId && challenge.toUserId === firstUserId;
      if (isDirectPair || isReversePair) {
        challengeIdsToRemove.push(challengeId);
      }
    });

    challengeIdsToRemove.forEach((challengeId) => {
      arenaChallengesById.delete(challengeId);
    });
  };

  const isArenaUserConnectedAndInside = (userId: string): boolean => {
    const user = state.getUserByUserId(userId);
    if (!user) {
      return false;
    }

    return isInGameArena(user.position);
  };

  const toArenaSnapshot = (game: ArenaGameRuntime): ArenaGameSnapshot => {
    return {
      gameId: game.gameId,
      gameType: game.gameType,
      status: game.status,
      participants: [...game.participants],
      scores: { ...game.scores },
      winnerUserId: game.winnerUserId,
      createdAt: game.createdAt,
      endsAt: game.endsAt,
      targetScore: game.targetScore,
    };
  };

  const toArenaChallengeSnapshot = (challenge: ArenaChallengeRuntime): ArenaChallengeSnapshot => {
    return {
      fromUserId: challenge.fromUserId,
      toUserId: challenge.toUserId,
      gameType: challenge.gameType,
      createdAt: challenge.createdAt,
    };
  };

  const findArenaChallenge = (fromUserId: string, toUserId: string): ArenaChallengeRuntime | null => {
    for (const challenge of arenaChallengesById.values()) {
      if (challenge.fromUserId === fromUserId && challenge.toUserId === toUserId) {
        return challenge;
      }
    }

    return null;
  };

  const removeArenaChallengeById = (challengeId: string): void => {
    arenaChallengesById.delete(challengeId);
  };

  const removeArenaChallengesForUser = (userId: string): void => {
    const challengeIdsToRemove: string[] = [];

    arenaChallengesById.forEach((challenge, challengeId) => {
      if (challenge.fromUserId === userId || challenge.toUserId === userId) {
        challengeIdsToRemove.push(challengeId);
      }
    });

    challengeIdsToRemove.forEach(removeArenaChallengeById);
  };

  const pruneArenaChallenges = (): void => {
    const now = Date.now();
    const challengeIdsToRemove: string[] = [];

    arenaChallengesById.forEach((challenge, challengeId) => {
      const isExpired = now - challenge.createdAtMs > ARENA_CHALLENGE_TTL_MS;
      const fromAvailable = isArenaUserConnectedAndInside(challenge.fromUserId);
      const toAvailable = isArenaUserConnectedAndInside(challenge.toUserId);
      const fromBusy = isUserInArenaGame(challenge.fromUserId);
      const toBusy = isUserInArenaGame(challenge.toUserId);

      if (isExpired || !fromAvailable || !toAvailable || fromBusy || toBusy) {
        challengeIdsToRemove.push(challengeId);
      }
    });

    challengeIdsToRemove.forEach(removeArenaChallengeById);
  };

  const emitArenaLobbyUpdateToUser = (userId: string): void => {
    const socketId = state.getSocketIdByUserId(userId);
    if (!socketId) {
      return;
    }

    const currentGame = getArenaGameByUserId(userId);
    pruneArenaChallenges();

    const currentUser = state.getUserByUserId(userId);
    const hasActiveGame = currentGame?.status === "active";

    if (!currentUser || !isInGameArena(currentUser.position)) {
      const emptySnapshot: ArenaLobbySnapshot = {
        availablePlayerUserIds: [],
        incomingChallenges: [],
        outgoingChallenges: [],
        hasActiveGame,
      };
      io.to(socketId).emit("arena-lobby-update", emptySnapshot);
      return;
    }

    const availablePlayerUserIds = currentGame
      ? []
      : getArenaUserIds().filter((candidateUserId) => candidateUserId !== userId && !isUserInArenaGame(candidateUserId));

    const incomingChallenges = Array.from(arenaChallengesById.values())
      .filter((challenge) => challenge.toUserId === userId)
      .sort((first, second) => second.createdAtMs - first.createdAtMs)
      .map(toArenaChallengeSnapshot);

    const outgoingChallenges = Array.from(arenaChallengesById.values())
      .filter((challenge) => challenge.fromUserId === userId)
      .sort((first, second) => second.createdAtMs - first.createdAtMs)
      .map(toArenaChallengeSnapshot);

    const lobbySnapshot: ArenaLobbySnapshot = {
      availablePlayerUserIds,
      incomingChallenges,
      outgoingChallenges,
      hasActiveGame,
    };

    io.to(socketId).emit("arena-lobby-update", lobbySnapshot);
  };

  const emitArenaGameUpdateToUser = (userId: string): void => {
    const socketId = state.getSocketIdByUserId(userId);
    if (!socketId) {
      return;
    }

    const userGame = getArenaGameByUserId(userId);
    if (!userGame) {
      io.to(socketId).emit("arena-game-update", null);
      return;
    }

    io.to(socketId).emit("arena-game-update", toArenaSnapshot(userGame));
  };

  const emitArenaStateToUser = (userId: string): void => {
    emitArenaGameUpdateToUser(userId);
    emitArenaLobbyUpdateToUser(userId);
  };

  const emitArenaStateToAllUsers = (): void => {
    state.listUserIds().forEach((userId) => {
      emitArenaStateToUser(userId);
    });
  };

  const sanitizeActiveArenaGame = (): void => {
    const liveArenaUserIds = new Set(getArenaUserIds());
    const gameIdsToRemove: string[] = [];

    arenaGamesById.forEach((game, gameId) => {
      const nextParticipants = game.participants.filter((participantId) => liveArenaUserIds.has(participantId));

      const removedParticipants = game.participants.filter((participantId) => !nextParticipants.includes(participantId));
      removedParticipants.forEach((participantUserId) => {
        const mappedGameId = arenaGameIdByUserId.get(participantUserId);
        if (mappedGameId === gameId) {
          arenaGameIdByUserId.delete(participantUserId);
        }
      });

      game.participants = nextParticipants;

      const nextScores: Record<string, number> = {};
      nextParticipants.forEach((participantId) => {
        nextScores[participantId] = game.scores[participantId] ?? 0;
      });
      game.scores = nextScores;

      const nextRolledBy = new Set<string>();
      game.rolledBy.forEach((rolledUserId) => {
        if (nextParticipants.includes(rolledUserId)) {
          nextRolledBy.add(rolledUserId);
        }
      });
      game.rolledBy = nextRolledBy;

      if (game.winnerUserId && !nextParticipants.includes(game.winnerUserId)) {
        game.winnerUserId = null;
      }

      if (game.status === "active" && nextParticipants.length < 2) {
        clearArenaGameTimers(game);
        game.status = "finished";
        game.winnerUserId = nextParticipants[0] ?? null;
      }

      if (game.status === "finished" && nextParticipants.length === 0) {
        gameIdsToRemove.push(gameId);
      }
    });

    gameIdsToRemove.forEach(dropArenaGame);
  };

  const emitArenaUpdate = (): void => {
    sanitizeActiveArenaGame();
    pruneArenaChallenges();
    emitArenaStateToAllUsers();
  };

  const resolveWinnerFromScores = (participants: string[], scores: Record<string, number>): string | null => {
    if (participants.length === 0) {
      return null;
    }

    const ranked = participants
      .map((userId) => ({ userId, score: scores[userId] ?? 0 }))
      .sort((first, second) => {
        if (first.score !== second.score) {
          return second.score - first.score;
        }

        return first.userId.localeCompare(second.userId);
      });

    if ((ranked[0]?.score ?? 0) <= 0) {
      return null;
    }

    return ranked[0]?.userId ?? null;
  };

  const finalizeArenaGame = (gameId: string, winnerUserId: string | null): void => {
    const game = arenaGamesById.get(gameId);
    if (!game || game.status !== "active") {
      return;
    }

    clearArenaGameTimers(game);
    game.status = "finished";
    game.winnerUserId = winnerUserId;
    emitArenaUpdate();
  };

  const startArenaGame = (gameType: ArenaGameType, participants: string[]): boolean => {
    if (participants.length < 2) {
      return false;
    }

    const uniqueParticipants = Array.from(new Set(participants)).sort((first, second) => first.localeCompare(second));
    if (uniqueParticipants.length < 2) {
      return false;
    }

    const allInArena = uniqueParticipants.every((participantUserId) => isArenaUserConnectedAndInside(participantUserId));
    if (!allInArena) {
      return false;
    }

    const anyBusy = uniqueParticipants.some((participantUserId) => isUserInArenaGame(participantUserId));
    if (anyBusy) {
      return false;
    }

    const now = Date.now();
    const durationMs = gameType === "tap-race" ? TAP_RACE_DURATION_MS : DICE_CLASH_DURATION_MS;
    const gameId = `arena-${now}-${Math.random().toString(36).slice(2, 8)}`;

    const baseGame: ArenaGameRuntime = {
      gameId,
      gameType,
      status: "active",
      participants: uniqueParticipants,
      scores: Object.fromEntries(uniqueParticipants.map((userId) => [userId, 0])),
      winnerUserId: null,
      createdAt: new Date(now).toISOString(),
      endsAt: new Date(now + durationMs).toISOString(),
      targetScore: gameType === "tap-race" ? TAP_RACE_TARGET_SCORE : undefined,
      rolledBy: new Set<string>(),
      timeoutId: null,
      resolveWindowTimeoutId: null,
    };

    arenaGamesById.set(gameId, baseGame);
    uniqueParticipants.forEach((participantUserId) => {
      arenaGameIdByUserId.set(participantUserId, gameId);
    });

    baseGame.timeoutId = setTimeout(() => {
      const game = arenaGamesById.get(gameId);
      if (!game || game.status !== "active") {
        return;
      }

      const winner = resolveWinnerFromScores(game.participants, game.scores);
      finalizeArenaGame(gameId, winner);
    }, durationMs);

    emitArenaUpdate();
    return true;
  };

  const removeUserFromActiveArenaGame = (userId: string): void => {
    const game = getArenaGameByUserId(userId);
    if (!game) {
      return;
    }

    const gameId = game.gameId;

    game.participants = game.participants.filter((participantId) => participantId !== userId);
    delete game.scores[userId];
    game.rolledBy.delete(userId);
    const mappedGameId = arenaGameIdByUserId.get(userId);
    if (mappedGameId === gameId) {
      arenaGameIdByUserId.delete(userId);
    }

    if (game.status !== "active") {
      if (game.participants.length === 0) {
        dropArenaGame(gameId);
      }
      emitArenaUpdate();
      return;
    }

    if (game.participants.length < 2) {
      finalizeArenaGame(gameId, game.participants[0] ?? null);
      return;
    }

    emitArenaUpdate();
  };

  const submitArenaChallenge = (fromUserId: string, toUserId: string, gameType: ArenaGameType): boolean => {
    if (fromUserId === toUserId) {
      return false;
    }

    if (isUserInArenaGame(fromUserId) || isUserInArenaGame(toUserId)) {
      return false;
    }

    if (!isArenaUserConnectedAndInside(fromUserId) || !isArenaUserConnectedAndInside(toUserId)) {
      return false;
    }

    const now = Date.now();
    removeArenaChallengesForUser(fromUserId);

    const existingChallenge = findArenaChallenge(fromUserId, toUserId);
    if (existingChallenge) {
      existingChallenge.gameType = gameType;
      existingChallenge.createdAt = new Date(now).toISOString();
      existingChallenge.createdAtMs = now;
      emitArenaUpdate();
      return true;
    }

    const challenge: ArenaChallengeRuntime = {
      id: `arena-challenge-${now}-${fromUserId}-${toUserId}`,
      fromUserId,
      toUserId,
      gameType,
      createdAt: new Date(now).toISOString(),
      createdAtMs: now,
    };

    arenaChallengesById.set(challenge.id, challenge);
    emitArenaUpdate();
    return true;
  };

  const respondArenaChallenge = (targetUserId: string, challengerUserId: string, accept: boolean): void => {
    const challenge = findArenaChallenge(challengerUserId, targetUserId);
    if (!challenge) {
      emitArenaStateToUser(targetUserId);
      return;
    }

    removeArenaChallengeById(challenge.id);

    if (!accept) {
      emitArenaUpdate();
      return;
    }

    if (
      !isArenaUserConnectedAndInside(challengerUserId) ||
      !isArenaUserConnectedAndInside(targetUserId) ||
      isUserInArenaGame(challengerUserId) ||
      isUserInArenaGame(targetUserId)
    ) {
      emitArenaUpdate();
      return;
    }

    removeArenaChallengesForUser(challengerUserId);
    removeArenaChallengesForUser(targetUserId);
    removeArenaChallengesBetweenUsers(challengerUserId, targetUserId);

    const started = startArenaGame(challenge.gameType, [challengerUserId, targetUserId]);
    if (!started) {
      emitArenaUpdate();
    }
  };

  const emitUsersUpdateNow = (): void => {
    io.emit("users-update", state.listUsers());
    usersDirty = false;
  };

  const markUsersDirty = (): void => {
    usersDirty = true;
  };

  const scheduleRoomReconcile = (): void => {
    if (roomReconcileQueued) {
      return;
    }

    roomReconcileQueued = true;
    setImmediate(() => {
      roomReconcileQueued = false;
      reconcileAndBroadcastRooms(io, state);
    });
  };

  setInterval(() => {
    if (!usersDirty) {
      return;
    }

    emitUsersUpdateNow();
  }, SERVER_BROADCAST_INTERVAL_MS);

  io.on("connection", (socket) => {
    sanitizeActiveArenaGame();
    socket.emit("arena-game-update", null);
    socket.emit("arena-lobby-update", {
      availablePlayerUserIds: [],
      incomingChallenges: [],
      outgoingChallenges: [],
      hasActiveGame: false,
    } as ArenaLobbySnapshot);
    socket.emit("social-voice-participants", {
      userIds: Array.from(socialVoiceEnabledUserIds).sort((first, second) => first.localeCompare(second)),
    });
    socket.emit("innovation-state-update", getInnovationSnapshot());

    socket.on("join-cosmos", (payload: JoinCosmosPayload = {}) => {
      const displayName = sanitizeDisplayName(payload.displayName || payload.userId);
      const requestedId = sanitizeUserId(payload.userId || displayName || `user-${socket.id.slice(0, 6)}`);
      const userId = ensureUniqueUserId(requestedId, state);
      const avatar = sanitizeAvatarProfile(payload.avatar);
      const normalizedPosition = payload.position
        ? state.normalizePosition(payload.position)
        : state.createSpawnPosition();
      const createdUser = state.addUser(socket.id, userId, displayName, avatar, normalizedPosition);

      socket.emit("joined-cosmos", {
        userId: createdUser.userId,
        displayName: createdUser.displayName,
        avatar: createdUser.avatar,
        position: createdUser.position,
      });

      io.emit("user-joined", {
        id: createdUser.userId,
        displayName: createdUser.displayName,
        avatar: createdUser.avatar,
        x: createdUser.position.x,
        y: createdUser.position.y,
      });

      emitUsersUpdateNow();
      emitRoomSnapshotToUser(io, state, createdUser.userId);
      emitArenaUpdate();
      emitInnovationUpdate();
      safelyPersistSession(createdUser.userId, createdUser.position);
    });

    socket.on("start-arena-game", ({ gameType, targetUserId }: StartArenaGamePayload) => {
      const currentUser = state.getUserBySocket(socket.id);
      if (!currentUser || !isInGameArena(currentUser.position)) {
        return;
      }

      if (gameType !== "tap-race" && gameType !== "dice-clash") {
        return;
      }

      if (!targetUserId) {
        const fallbackTarget = getArenaUserIds().find((candidateUserId) => candidateUserId !== currentUser.userId);
        if (!fallbackTarget) {
          emitArenaStateToUser(currentUser.userId);
          return;
        }

        submitArenaChallenge(currentUser.userId, fallbackTarget, gameType);
        return;
      }

      submitArenaChallenge(currentUser.userId, targetUserId, gameType);
    });

    socket.on("arena-challenge-respond", ({ challengerUserId, accept }: ArenaChallengeResponsePayload) => {
      const currentUser = state.getUserBySocket(socket.id);
      if (!currentUser || !challengerUserId || typeof accept !== "boolean") {
        return;
      }

      respondArenaChallenge(currentUser.userId, challengerUserId, accept);
    });

    socket.on("arena-leave-match", () => {
      const currentUser = state.getUserBySocket(socket.id);
      if (!currentUser) {
        return;
      }

      removeUserFromActiveArenaGame(currentUser.userId);
    });

    socket.on("arena-game-action", ({ action }: ArenaGameActionPayload) => {
      const currentUser = state.getUserBySocket(socket.id);
      if (!currentUser) {
        return;
      }

      const arenaGame = getArenaGameByUserId(currentUser.userId);
      if (!arenaGame || arenaGame.status !== "active") {
        return;
      }

      if (arenaGame.gameType === "tap-race") {
        if (action !== "tap") {
          return;
        }

        const nextScore = (arenaGame.scores[currentUser.userId] ?? 0) + 1;
        arenaGame.scores[currentUser.userId] = nextScore;

        if (nextScore >= TAP_RACE_TARGET_SCORE) {
          finalizeArenaGame(arenaGame.gameId, currentUser.userId);
          return;
        }

        emitArenaUpdate();
        return;
      }

      if (arenaGame.gameType === "dice-clash") {
        if (action !== "roll" || arenaGame.rolledBy.has(currentUser.userId)) {
          return;
        }

        const rollValue = Math.floor(Math.random() * 6) + 1;
        arenaGame.scores[currentUser.userId] = rollValue;
        arenaGame.rolledBy.add(currentUser.userId);

        if (arenaGame.rolledBy.size >= arenaGame.participants.length) {
          const winner = resolveWinnerFromScores(arenaGame.participants, arenaGame.scores);
          finalizeArenaGame(arenaGame.gameId, winner);
          return;
        }

        if (arenaGame.rolledBy.size >= 2) {
          if (arenaGame.resolveWindowTimeoutId) {
            clearTimeout(arenaGame.resolveWindowTimeoutId);
          }

          const gameId = arenaGame.gameId;
          arenaGame.resolveWindowTimeoutId = setTimeout(() => {
            const activeGame = arenaGamesById.get(gameId);
            if (!activeGame || activeGame.status !== "active") {
              return;
            }

            const winner = resolveWinnerFromScores(activeGame.participants, activeGame.scores);
            finalizeArenaGame(gameId, winner);
          }, 2_000);
        }

        emitArenaUpdate();
      }
    });

    socket.on("move", (nextPosition: Position) => {
      const userBeforeMove = state.getUserBySocket(socket.id);
      const wasInInnovationHub = userBeforeMove ? isInInnovationHub(userBeforeMove.position) : false;
      const wasInGameArena = userBeforeMove ? isInGameArena(userBeforeMove.position) : false;

      const updateResult = state.updatePosition(socket.id, nextPosition);
      if (!updateResult?.changed) {
        return;
      }

      if (socialVoiceEnabledUserIds.has(updateResult.user.userId) && !isInSocialLounge(updateResult.user.position)) {
        removeSocialVoiceForUser(updateResult.user.userId, {
          notifyUser: true,
          reason: "left-social-lounge",
        });
      }

      const isNowInInnovationHub = isInInnovationHub(updateResult.user.position);
      const isNowInGameArena = isInGameArena(updateResult.user.position);
      if (wasInInnovationHub !== isNowInInnovationHub) {
        stopInnovationPresenterIfNeeded("left-innovation-room");
        emitInnovationUpdate();
      } else {
        stopInnovationPresenterIfNeeded("left-innovation-room");
      }

      if (wasInGameArena && !isNowInGameArena) {
        removeArenaChallengesForUser(updateResult.user.userId);
        removeUserFromActiveArenaGame(updateResult.user.userId);
      } else if (!wasInGameArena && isNowInGameArena) {
        emitArenaUpdate();
      }

      markUsersDirty();
    });

    socket.on("social-voice-mic", ({ enabled }: SocialVoiceMicPayload) => {
      const currentUser = state.getUserBySocket(socket.id);
      if (!currentUser) {
        return;
      }

      if (!enabled) {
        removeSocialVoiceForUser(currentUser.userId);
        return;
      }

      if (!isInSocialLounge(currentUser.position)) {
        socket.emit("social-voice-forced-off", {
          reason: "left-social-lounge",
        });
        return;
      }

      if (socialVoiceEnabledUserIds.has(currentUser.userId)) {
        return;
      }

      socialVoiceEnabledUserIds.add(currentUser.userId);
      emitSocialVoiceParticipants();
    });

    socket.on("social-voice-offer", ({ targetUserId, sdp }: SocialVoiceOfferPayload) => {
      const currentUser = state.getUserBySocket(socket.id);
      if (!currentUser || !targetUserId || !sdp) {
        return;
      }

      if (!canRouteSocialVoiceBetween(currentUser.userId, targetUserId)) {
        return;
      }

      const targetSocketId = state.getSocketIdByUserId(targetUserId);
      if (!targetSocketId) {
        return;
      }

      io.to(targetSocketId).emit("social-voice-offer", {
        fromUserId: currentUser.userId,
        sdp,
      });
    });

    socket.on("social-voice-answer", ({ targetUserId, sdp }: SocialVoiceAnswerPayload) => {
      const currentUser = state.getUserBySocket(socket.id);
      if (!currentUser || !targetUserId || !sdp) {
        return;
      }

      if (!canRouteSocialVoiceBetween(currentUser.userId, targetUserId)) {
        return;
      }

      const targetSocketId = state.getSocketIdByUserId(targetUserId);
      if (!targetSocketId) {
        return;
      }

      io.to(targetSocketId).emit("social-voice-answer", {
        fromUserId: currentUser.userId,
        sdp,
      });
    });

    socket.on("social-voice-ice-candidate", ({ targetUserId, candidate }: SocialVoiceIceCandidatePayload) => {
      const currentUser = state.getUserBySocket(socket.id);
      if (!currentUser || !targetUserId || !candidate) {
        return;
      }

      if (!canRouteSocialVoiceBetween(currentUser.userId, targetUserId)) {
        return;
      }

      const targetSocketId = state.getSocketIdByUserId(targetUserId);
      if (!targetSocketId) {
        return;
      }

      io.to(targetSocketId).emit("social-voice-ice-candidate", {
        fromUserId: currentUser.userId,
        candidate,
      });
    });

    socket.on("innovation-start-share", () => {
      const currentUser = state.getUserBySocket(socket.id);
      if (!currentUser || !isInInnovationHub(currentUser.position)) {
        return;
      }

      if (innovation.presenterUserId && innovation.presenterUserId !== currentUser.userId) {
        return;
      }

      innovation.presenterUserId = currentUser.userId;
      innovation.pitchMicEnabled = false;
      emitInnovationUpdate();
    });

    socket.on("innovation-stop-share", () => {
      const currentUser = state.getUserBySocket(socket.id);
      if (!currentUser || innovation.presenterUserId !== currentUser.userId) {
        return;
      }

      innovation.presenterUserId = null;
      innovation.pitchMicEnabled = false;
      emitInnovationUpdate();
    });

    socket.on("innovation-pitch-mic", ({ enabled }: InnovationPitchMicPayload) => {
      const currentUser = state.getUserBySocket(socket.id);
      if (!currentUser || innovation.presenterUserId !== currentUser.userId || !isInInnovationHub(currentUser.position)) {
        return;
      }

      innovation.pitchMicEnabled = !!enabled;
      emitInnovationUpdate();
    });

    socket.on("innovation-whiteboard-stroke", ({ points, color, width }: InnovationWhiteboardStrokePayload) => {
      const currentUser = state.getUserBySocket(socket.id);
      if (!currentUser || innovation.presenterUserId !== currentUser.userId || !isInInnovationHub(currentUser.position)) {
        return;
      }

      const safePoints = sanitizeWhiteboardPoints(Array.isArray(points) ? points : []);
      if (safePoints.length < 2) {
        return;
      }

      const stroke: InnovationWhiteboardStroke = {
        id: `stroke-${Date.now()}-${socket.id}`,
        fromUserId: currentUser.userId,
        color: sanitizeWhiteboardColor(color),
        width: clamp(Number(width ?? DEFAULT_WHITEBOARD_STROKE_WIDTH), WHITEBOARD_STROKE_WIDTH_MIN, WHITEBOARD_STROKE_WIDTH_MAX),
        points: safePoints,
        createdAt: new Date().toISOString(),
      };

      innovation.whiteboardStrokes.push(stroke);
      if (innovation.whiteboardStrokes.length > INNOVATION_WHITEBOARD_MAX_STROKES) {
        innovation.whiteboardStrokes.splice(0, innovation.whiteboardStrokes.length - INNOVATION_WHITEBOARD_MAX_STROKES);
      }

      io.emit("innovation-whiteboard-stroke-added", stroke);
    });

    socket.on("innovation-whiteboard-clear", () => {
      const currentUser = state.getUserBySocket(socket.id);
      if (!currentUser || innovation.presenterUserId !== currentUser.userId || !isInInnovationHub(currentUser.position)) {
        return;
      }

      innovation.whiteboardStrokes = [];
      io.emit("innovation-whiteboard-cleared");
      emitInnovationUpdate();
    });

    socket.on("innovation-idea-add", ({ text }: InnovationIdeaAddPayload) => {
      const currentUser = state.getUserBySocket(socket.id);
      if (!currentUser || !isInInnovationHub(currentUser.position)) {
        return;
      }

      const normalizedText = (text ?? "").trim().slice(0, INNOVATION_IDEA_MAX_LENGTH);
      if (!normalizedText) {
        return;
      }

      const nextIdea: InnovationIdeaRuntime = {
        id: `idea-${Date.now()}-${socket.id}`,
        text: normalizedText,
        createdBy: currentUser.userId,
        voterUserIds: new Set<string>(),
        createdAt: new Date().toISOString(),
      };

      innovation.ideas.unshift(nextIdea);
      if (innovation.ideas.length > INNOVATION_IDEA_MAX_ITEMS) {
        innovation.ideas.splice(INNOVATION_IDEA_MAX_ITEMS);
      }

      emitInnovationUpdate();
    });

    socket.on("innovation-idea-vote-toggle", ({ ideaId }: InnovationIdeaVotePayload) => {
      const currentUser = state.getUserBySocket(socket.id);
      if (!currentUser || !isInInnovationHub(currentUser.position) || !ideaId) {
        return;
      }

      const idea = innovation.ideas.find((item) => item.id === ideaId);
      if (!idea) {
        return;
      }

      if (idea.voterUserIds.has(currentUser.userId)) {
        idea.voterUserIds.delete(currentUser.userId);
      } else {
        idea.voterUserIds.add(currentUser.userId);
      }

      emitInnovationUpdate();
    });

    socket.on("innovation-pitch-offer", ({ targetUserId, sdp }: InnovationPitchOfferPayload) => {
      const currentUser = state.getUserBySocket(socket.id);
      if (!currentUser || !targetUserId || !sdp) {
        return;
      }

      if (!canUseInnovationPitchSpeaker(currentUser.userId) || !canUseInnovationPitchListener(targetUserId)) {
        return;
      }

      if (targetUserId === currentUser.userId) {
        return;
      }

      const targetSocketId = state.getSocketIdByUserId(targetUserId);
      if (!targetSocketId) {
        return;
      }

      io.to(targetSocketId).emit("innovation-pitch-offer", {
        fromUserId: currentUser.userId,
        sdp,
      });
    });

    socket.on("innovation-pitch-answer", ({ targetUserId, sdp }: InnovationPitchAnswerPayload) => {
      const currentUser = state.getUserBySocket(socket.id);
      if (!currentUser || !targetUserId || !sdp) {
        return;
      }

      if (!canUseInnovationPitchListener(currentUser.userId) || !canUseInnovationPitchSpeaker(targetUserId)) {
        return;
      }

      if (currentUser.userId === targetUserId) {
        return;
      }

      const targetSocketId = state.getSocketIdByUserId(targetUserId);
      if (!targetSocketId) {
        return;
      }

      io.to(targetSocketId).emit("innovation-pitch-answer", {
        fromUserId: currentUser.userId,
        sdp,
      });
    });

    socket.on("innovation-pitch-ice-candidate", ({ targetUserId, candidate }: InnovationPitchIceCandidatePayload) => {
      const currentUser = state.getUserBySocket(socket.id);
      if (!currentUser || !targetUserId || !candidate) {
        return;
      }

      const isFromSpeaker = canUseInnovationPitchSpeaker(currentUser.userId) && canUseInnovationPitchListener(targetUserId);
      const isFromListener = canUseInnovationPitchListener(currentUser.userId) && canUseInnovationPitchSpeaker(targetUserId);

      if (!isFromSpeaker && !isFromListener) {
        return;
      }

      if (currentUser.userId === targetUserId) {
        return;
      }

      const targetSocketId = state.getSocketIdByUserId(targetUserId);
      if (!targetSocketId) {
        return;
      }

      io.to(targetSocketId).emit("innovation-pitch-ice-candidate", {
        fromUserId: currentUser.userId,
        candidate,
      });
    });

    socket.on("connect-user", ({ targetUserId }: ConnectUserPayload) => {
      const currentUser = state.getUserBySocket(socket.id);
      const targetUser = state.getUserByUserId(targetUserId);

      if (!currentUser || !targetUser || currentUser.userId === targetUser.userId) {
        return;
      }

      const dx = targetUser.position.x - currentUser.position.x;
      const dy = targetUser.position.y - currentUser.position.y;
      if (dx * dx + dy * dy >= PROXIMITY_RADIUS * PROXIMITY_RADIUS) {
        return;
      }

      const didConnect = state.connectUsers(currentUser.userId, targetUser.userId);
      if (!didConnect) {
        return;
      }

      scheduleRoomReconcile();
    });

    socket.on("disconnect-user", ({ targetUserId }: ConnectUserPayload) => {
      const currentUser = state.getUserBySocket(socket.id);
      const targetUser = state.getUserByUserId(targetUserId);

      if (!currentUser || !targetUser || currentUser.userId === targetUser.userId) {
        return;
      }

      const didDisconnect = state.disconnectUsers(currentUser.userId, targetUser.userId);
      if (!didDisconnect) {
        return;
      }

      scheduleRoomReconcile();
    });

    socket.on("send-message", ({ roomId, toUserId, message }: SendMessagePayload) => {
      const currentUser = state.getUserBySocket(socket.id);

      if (!currentUser) {
        return;
      }

      const resolvedRoomId = roomId || state.getRoomIdByUserId(currentUser.userId);
      if (!resolvedRoomId) {
        return;
      }

      const normalizedMessage = message.trim();
      if (!normalizedMessage || normalizedMessage.length > 500) {
        return;
      }

      const roomMembers = state.getRoomMembers(resolvedRoomId);
      if (roomMembers.length < 2 || !roomMembers.includes(currentUser.userId)) {
        return;
      }

      const chatMessage: ChatMessage = {
        id: `${Date.now()}-${socket.id}`,
        roomId: resolvedRoomId,
        fromUserId: currentUser.userId,
        toUserId,
        message: normalizedMessage,
        createdAt: new Date().toISOString(),
      };

      io.to(resolvedRoomId).emit("receive-message", chatMessage);
    });

    socket.on("disconnect", () => {
      const removedUser = state.removeUser(socket.id);
      if (!removedUser) {
        return;
      }

      removeSocialVoiceForUser(removedUser.userId);

      if (innovation.presenterUserId === removedUser.userId) {
        innovation.presenterUserId = null;
        innovation.pitchMicEnabled = false;
      }

      removeUserFromActiveArenaGame(removedUser.userId);
      removeArenaChallengesForUser(removedUser.userId);
      emitArenaUpdate();

      reconcileAndBroadcastRooms(io, state);

      io.emit("user-left", { id: removedUser.userId });
      emitUsersUpdateNow();
      emitInnovationUpdate();
      safelyPersistSession(removedUser.userId, removedUser.position);
    });
  });
};
