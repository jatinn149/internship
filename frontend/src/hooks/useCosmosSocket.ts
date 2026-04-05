import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { getSocketClient } from "../socket/client";
import { ChatMessage } from "../types/chat";
import { ArenaGameSnapshot, ArenaGameType, ArenaLobbySnapshot } from "../types/game";
import { JoinedCosmosPayload } from "../types/socket";
import { CosmosUser, JoinIdentity, Position } from "../types/user";
import { SOCKET_EMIT_INTERVAL_MS, WORLD_HEIGHT, WORLD_WIDTH } from "../utils/constants";
import { throttle } from "../utils/throttle";

const EMPTY_ARENA_LOBBY: ArenaLobbySnapshot = {
  availablePlayerUserIds: [],
  incomingChallenges: [],
  outgoingChallenges: [],
  hasActiveGame: false,
};

const isSameUsersSnapshot = (currentUsers: CosmosUser[], nextUsers: CosmosUser[]): boolean => {
  if (currentUsers.length !== nextUsers.length) {
    return false;
  }

  for (let index = 0; index < currentUsers.length; index += 1) {
    const current = currentUsers[index];
    const next = nextUsers[index];

    if (current.id !== next.id || current.displayName !== next.displayName) {
      return false;
    }

    if (current.x !== next.x || current.y !== next.y) {
      return false;
    }

    if (
      current.avatar.gender !== next.avatar.gender ||
      current.avatar.skinTone !== next.avatar.skinTone ||
      current.avatar.outfitColor !== next.avatar.outfitColor ||
      current.avatar.hairStyle !== next.avatar.hairStyle
    ) {
      return false;
    }
  }

  return true;
};

interface UseCosmosSocketResult {
  socket: Socket | null;
  selfUserId: string | null;
  users: CosmosUser[];
  messages: ChatMessage[];
  arenaGame: ArenaGameSnapshot | null;
  arenaLobby: ArenaLobbySnapshot;
  emitMove: (position: Position) => void;
  sendMessage: (roomId: string, message: string) => void;
  challengeArenaPlayer: (targetUserId: string, gameType: ArenaGameType) => void;
  respondToArenaChallenge: (challengerUserId: string, accept: boolean) => void;
  leaveArenaMatch: () => void;
  sendArenaAction: (action: "tap" | "roll") => void;
}

export const useCosmosSocket = (
  identity: JoinIdentity | null,
  onJoined?: (position: Position) => void
): UseCosmosSocketResult => {
  const socketRef = useRef<Socket | null>(null);
  const identityRef = useRef<JoinIdentity | null>(identity);
  const didJoinForConnectionRef = useRef(false);
  const [selfUserId, setSelfUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<CosmosUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [arenaGame, setArenaGame] = useState<ArenaGameSnapshot | null>(null);
  const [arenaLobby, setArenaLobby] = useState<ArenaLobbySnapshot>(EMPTY_ARENA_LOBBY);

  useEffect(() => {
    identityRef.current = identity;

    if (socketRef.current?.connected && identity && !didJoinForConnectionRef.current) {
      socketRef.current.emit("join-cosmos", {
        userId: identity.displayName,
        displayName: identity.displayName,
        avatar: identity.avatar,
      });
    }
  }, [identity]);

  useEffect(() => {
    const socket = getSocketClient();
    socketRef.current = socket;

    const handleConnect = () => {
      didJoinForConnectionRef.current = false;

      const nextIdentity = identityRef.current;
      if (!nextIdentity) {
        return;
      }

      socket.emit("join-cosmos", {
        userId: nextIdentity.displayName,
        displayName: nextIdentity.displayName,
        avatar: nextIdentity.avatar,
      });
    };

    const handleJoined = ({ userId, position }: JoinedCosmosPayload) => {
      didJoinForConnectionRef.current = true;
      setSelfUserId(userId);
      onJoined?.(position);
    };

    const handleDisconnect = () => {
      didJoinForConnectionRef.current = false;
      setSelfUserId(null);
      setArenaGame(null);
      setArenaLobby(EMPTY_ARENA_LOBBY);
    };

    const handleUsersUpdate = (incomingUsers: CosmosUser[]) => {
      setUsers((previousUsers) => {
        return isSameUsersSnapshot(previousUsers, incomingUsers) ? previousUsers : incomingUsers;
      });
    };

    const handleReceiveMessage = (incomingMessage: ChatMessage) => {
      setMessages((previous) => [...previous, incomingMessage]);
    };

    const handleArenaGameUpdate = (incomingSnapshot: ArenaGameSnapshot | null) => {
      setArenaGame(incomingSnapshot);
    };

    const handleArenaLobbyUpdate = (incomingLobby: ArenaLobbySnapshot) => {
      setArenaLobby(incomingLobby);
    };

    socket.on("connect", handleConnect);
    socket.on("joined-cosmos", handleJoined);
    socket.on("disconnect", handleDisconnect);
    socket.on("users-update", handleUsersUpdate);
    socket.on("receive-message", handleReceiveMessage);
    socket.on("arena-game-update", handleArenaGameUpdate);
    socket.on("arena-lobby-update", handleArenaLobbyUpdate);

    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("joined-cosmos", handleJoined);
      socket.off("disconnect", handleDisconnect);
      socket.off("users-update", handleUsersUpdate);
      socket.off("receive-message", handleReceiveMessage);
      socket.off("arena-game-update", handleArenaGameUpdate);
      socket.off("arena-lobby-update", handleArenaLobbyUpdate);
    };
  }, [onJoined]);

  const throttledMoveEmitter = useMemo(
    () =>
      throttle((position: Position) => {
        socketRef.current?.emit("move", position);
      }, SOCKET_EMIT_INTERVAL_MS),
    []
  );

  const emitMove = useCallback(
    (position: Position) => {
      throttledMoveEmitter(position);
    },
    [throttledMoveEmitter]
  );

  const sendMessage = useCallback((roomId: string, message: string) => {
    socketRef.current?.emit("send-message", {
      roomId,
      message,
    });
  }, []);

  const challengeArenaPlayer = useCallback((targetUserId: string, gameType: ArenaGameType) => {
    socketRef.current?.emit("start-arena-game", {
      gameType,
      targetUserId,
    });
  }, []);

  const respondToArenaChallenge = useCallback((challengerUserId: string, accept: boolean) => {
    socketRef.current?.emit("arena-challenge-respond", {
      challengerUserId,
      accept,
    });
  }, []);

  const leaveArenaMatch = useCallback(() => {
    socketRef.current?.emit("arena-leave-match");
  }, []);

  const sendArenaAction = useCallback((action: "tap" | "roll") => {
    socketRef.current?.emit("arena-game-action", {
      action,
    });
  }, []);

  return {
    socket: socketRef.current,
    selfUserId,
    users,
    messages,
    arenaGame,
    arenaLobby,
    emitMove,
    sendMessage,
    challengeArenaPlayer,
    respondToArenaChallenge,
    leaveArenaMatch,
    sendArenaAction,
  };
};
