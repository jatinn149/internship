import { useEffect, useMemo, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { ChatRoomSnapshot } from "../types/chat";
import { CosmosUser, Position } from "../types/user";
import { PROXIMITY_CHECK_INTERVAL_MS, PROXIMITY_RADIUS } from "../utils/constants";

interface UseProximityOptions {
  socket: Socket | null;
  selfUserId: string | null;
  users: CosmosUser[];
  selfPosition: Position;
}

interface UseProximityResult {
  connectedPeerIds: string[];
  activePeerId: string | null;
  activeRoomId: string | null;
  setActivePeerId: (peerId: string) => void;
}

const sortedValues = (set: Set<string>): string[] => {
  return Array.from(set).sort((first, second) => first.localeCompare(second));
};

const PROXIMITY_RADIUS_SQUARED = PROXIMITY_RADIUS * PROXIMITY_RADIUS;

export const useProximity = ({
  socket,
  selfUserId,
  users,
  selfPosition,
}: UseProximityOptions): UseProximityResult => {
  const [connectedPeerIds, setConnectedPeerIds] = useState<string[]>([]);
  const [activePeerId, setActivePeerIdState] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const connectedPeerSetRef = useRef<Set<string>>(new Set());
  const directNearbyPeersRef = useRef<Set<string>>(new Set());
  const remoteUsersRef = useRef<CosmosUser[]>([]);
  const selfPositionRef = useRef<Position>(selfPosition);

  const remoteUsers = useMemo(() => {
    return users.filter((user) => user.id !== selfUserId);
  }, [users, selfUserId]);

  useEffect(() => {
    remoteUsersRef.current = remoteUsers;
  }, [remoteUsers]);

  useEffect(() => {
    selfPositionRef.current = selfPosition;
  }, [selfPosition]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleChatRoomUpdate = ({ roomId, memberUserIds }: ChatRoomSnapshot) => {
      if (!roomId) {
        connectedPeerSetRef.current.clear();
        setConnectedPeerIds([]);
        setActivePeerIdState(null);
        setActiveRoomId(null);
        return;
      }

      const peers = sortedValues(
        new Set(
          memberUserIds.filter((memberUserId) => {
            return selfUserId ? memberUserId !== selfUserId : true;
          })
        )
      );
      connectedPeerSetRef.current = new Set(peers);
      setConnectedPeerIds(peers);
      setActiveRoomId(roomId);

      setActivePeerIdState((previous) => {
        if (previous && peers.includes(previous)) {
          return previous;
        }

        return peers[0] || null;
      });
    };

    socket.on("chat-room-update", handleChatRoomUpdate);

    return () => {
      socket.off("chat-room-update", handleChatRoomUpdate);
    };
  }, [socket, selfUserId]);

  useEffect(() => {
    directNearbyPeersRef.current.clear();

    if (!selfUserId) {
      connectedPeerSetRef.current.clear();
      setConnectedPeerIds([]);
      setActivePeerIdState(null);
      setActiveRoomId(null);
    }
  }, [selfUserId]);

  useEffect(() => {
    if (!socket || !selfUserId) {
      return;
    }

    const checkProximity = () => {
      const shouldConnect = new Set<string>();
      const latestSelfPosition = selfPositionRef.current;
      const remoteUsers = remoteUsersRef.current;

      if (remoteUsers.length === 0) {
        if (directNearbyPeersRef.current.size > 0) {
          directNearbyPeersRef.current.forEach((peerUserId) => {
            socket.emit("disconnect-user", { targetUserId: peerUserId });
          });
          directNearbyPeersRef.current = new Set();
        }

        return;
      }

      remoteUsers.forEach((user) => {
        const dx = user.x - latestSelfPosition.x;
        const dy = user.y - latestSelfPosition.y;
        if (dx * dx + dy * dy < PROXIMITY_RADIUS_SQUARED) {
          shouldConnect.add(user.id);
        }
      });

      shouldConnect.forEach((peerUserId) => {
        if (!connectedPeerSetRef.current.has(peerUserId)) {
          socket.emit("connect-user", { targetUserId: peerUserId });
        }
      });

      directNearbyPeersRef.current.forEach((peerUserId) => {
        if (!shouldConnect.has(peerUserId)) {
          socket.emit("disconnect-user", { targetUserId: peerUserId });
        }
      });

      directNearbyPeersRef.current = shouldConnect;
    };

    checkProximity();
    const intervalId = window.setInterval(checkProximity, PROXIMITY_CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [socket, selfUserId]);

  const setActivePeerId = (peerId: string) => {
    setActivePeerIdState(peerId);
  };

  return {
    connectedPeerIds,
    activePeerId,
    activeRoomId,
    setActivePeerId,
  };
};
