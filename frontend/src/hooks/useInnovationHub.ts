import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { InnovationIdea, InnovationStateSnapshot, InnovationWhiteboardStroke } from "../types/innovation";

interface UseInnovationHubOptions {
  socket: Socket | null;
  selfUserId: string | null;
}

interface UseInnovationHubResult {
  innovationState: InnovationStateSnapshot;
  isPresenter: boolean;
  isPitchMicToggling: boolean;
  pitchVoiceError: string | null;
  isPitchVoiceSupported: boolean;
  startSharing: () => void;
  stopSharing: () => void;
  togglePitchMic: () => Promise<void>;
  sendWhiteboardStroke: (payload: { points: Array<{ x: number; y: number }>; color?: string; width?: number }) => void;
  clearWhiteboard: () => void;
  addIdea: (text: string) => void;
  toggleIdeaVote: (ideaId: string) => void;
}

const EMPTY_INNOVATION_STATE: InnovationStateSnapshot = {
  presenterUserId: null,
  pitchMicEnabled: false,
  pitchSpeakerUserId: null,
  participantUserIds: [],
  whiteboardStrokes: [],
  ideas: [],
};

const STUN_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

const upsertById = <T extends { id: string }>(items: T[], nextItem: T): T[] => {
  if (items.some((item) => item.id === nextItem.id)) {
    return items;
  }

  return [...items, nextItem];
};

export const useInnovationHub = ({ socket, selfUserId }: UseInnovationHubOptions): UseInnovationHubResult => {
  const [innovationState, setInnovationState] = useState<InnovationStateSnapshot>(EMPTY_INNOVATION_STATE);
  const [isPitchMicToggling, setIsPitchMicToggling] = useState(false);
  const [pitchVoiceError, setPitchVoiceError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const offeredPeerUserIdsRef = useRef<Set<string>>(new Set());

  const isPresenter = useMemo(() => {
    return !!selfUserId && innovationState.presenterUserId === selfUserId;
  }, [innovationState.presenterUserId, selfUserId]);

  const isPitchVoiceSupported = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return !!window.RTCPeerConnection && !!navigator.mediaDevices?.getUserMedia;
  }, []);

  const stopLocalStream = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    localStreamRef.current = null;
  }, []);

  const closePeerConnection = useCallback((peerUserId: string) => {
    const peerConnection = peerConnectionsRef.current.get(peerUserId);
    if (peerConnection) {
      peerConnection.close();
      peerConnectionsRef.current.delete(peerUserId);
    }

    const remoteAudio = remoteAudioElementsRef.current.get(peerUserId);
    if (remoteAudio) {
      remoteAudio.pause();
      remoteAudio.srcObject = null;
      remoteAudioElementsRef.current.delete(peerUserId);
    }

    offeredPeerUserIdsRef.current.delete(peerUserId);
  }, []);

  const closeAllPeerConnections = useCallback(() => {
    Array.from(peerConnectionsRef.current.keys()).forEach((peerUserId) => {
      closePeerConnection(peerUserId);
    });
  }, [closePeerConnection]);

  const createOrGetPeerConnection = useCallback(
    (peerUserId: string, includeLocalAudio: boolean): RTCPeerConnection => {
      const existing = peerConnectionsRef.current.get(peerUserId);
      if (existing) {
        return existing;
      }

      const peerConnection = new RTCPeerConnection({
        iceServers: STUN_ICE_SERVERS,
      });

      if (includeLocalAudio && localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStreamRef.current as MediaStream);
        });
      }

      peerConnection.onicecandidate = (event) => {
        if (!event.candidate || !socket) {
          return;
        }

        socket.emit("innovation-pitch-ice-candidate", {
          targetUserId: peerUserId,
          candidate: event.candidate.toJSON(),
        });
      };

      peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (!remoteStream) {
          return;
        }

        let remoteAudio = remoteAudioElementsRef.current.get(peerUserId);
        if (!remoteAudio) {
          remoteAudio = new Audio();
          remoteAudio.autoplay = true;
          remoteAudioElementsRef.current.set(peerUserId, remoteAudio);
        }

        if (remoteAudio.srcObject !== remoteStream) {
          remoteAudio.srcObject = remoteStream;
          void remoteAudio.play().catch(() => {
            // Browser autoplay policy can block until user interaction.
          });
        }
      };

      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        if (state === "failed" || state === "disconnected" || state === "closed") {
          closePeerConnection(peerUserId);
        }
      };

      peerConnectionsRef.current.set(peerUserId, peerConnection);
      return peerConnection;
    },
    [closePeerConnection, socket]
  );

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleInnovationStateUpdate = (snapshot: InnovationStateSnapshot) => {
      if (!snapshot) {
        return;
      }

      setInnovationState(snapshot);
    };

    const handleWhiteboardStrokeAdded = (stroke: InnovationWhiteboardStroke) => {
      setInnovationState((previous) => ({
        ...previous,
        whiteboardStrokes: upsertById(previous.whiteboardStrokes, stroke),
      }));
    };

    const handleWhiteboardCleared = () => {
      setInnovationState((previous) => ({
        ...previous,
        whiteboardStrokes: [],
      }));
    };

    const handlePitchForcedOff = () => {
      stopLocalStream();
      closeAllPeerConnections();
      setPitchVoiceError("Pitch mic was turned off.");
      setIsPitchMicToggling(false);
    };

    const handleInnovationPitchOffer = async ({ fromUserId, sdp }: { fromUserId: string; sdp: RTCSessionDescriptionInit }) => {
      if (!socket || !fromUserId || !sdp) {
        return;
      }

      const peerConnection = createOrGetPeerConnection(fromUserId, false);

      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.emit("innovation-pitch-answer", {
          targetUserId: fromUserId,
          sdp: answer,
        });
      } catch {
        closePeerConnection(fromUserId);
      }
    };

    const handleInnovationPitchAnswer = async ({ fromUserId, sdp }: { fromUserId: string; sdp: RTCSessionDescriptionInit }) => {
      const peerConnection = peerConnectionsRef.current.get(fromUserId);
      if (!peerConnection || !sdp) {
        return;
      }

      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch {
        closePeerConnection(fromUserId);
      }
    };

    const handleInnovationPitchIceCandidate = async ({
      fromUserId,
      candidate,
    }: {
      fromUserId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const peerConnection = peerConnectionsRef.current.get(fromUserId);
      if (!peerConnection || !candidate) {
        return;
      }

      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore invalid candidates.
      }
    };

    const handleDisconnect = () => {
      stopLocalStream();
      closeAllPeerConnections();
      setInnovationState(EMPTY_INNOVATION_STATE);
      setIsPitchMicToggling(false);
    };

    socket.on("innovation-state-update", handleInnovationStateUpdate);
    socket.on("innovation-whiteboard-stroke-added", handleWhiteboardStrokeAdded);
    socket.on("innovation-whiteboard-cleared", handleWhiteboardCleared);
    socket.on("innovation-pitch-forced-off", handlePitchForcedOff);
    socket.on("innovation-pitch-offer", handleInnovationPitchOffer);
    socket.on("innovation-pitch-answer", handleInnovationPitchAnswer);
    socket.on("innovation-pitch-ice-candidate", handleInnovationPitchIceCandidate);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("innovation-state-update", handleInnovationStateUpdate);
      socket.off("innovation-whiteboard-stroke-added", handleWhiteboardStrokeAdded);
      socket.off("innovation-whiteboard-cleared", handleWhiteboardCleared);
      socket.off("innovation-pitch-forced-off", handlePitchForcedOff);
      socket.off("innovation-pitch-offer", handleInnovationPitchOffer);
      socket.off("innovation-pitch-answer", handleInnovationPitchAnswer);
      socket.off("innovation-pitch-ice-candidate", handleInnovationPitchIceCandidate);
      socket.off("disconnect", handleDisconnect);
    };
  }, [closeAllPeerConnections, closePeerConnection, createOrGetPeerConnection, socket, stopLocalStream]);

  useEffect(() => {
    const amSpeaker = !!selfUserId && innovationState.pitchSpeakerUserId === selfUserId;

    if (!amSpeaker) {
      stopLocalStream();
      closeAllPeerConnections();
      return;
    }

    if (!localStreamRef.current) {
      if (socket) {
        socket.emit("innovation-pitch-mic", { enabled: false });
      }
      return;
    }

    const peerUserIds = innovationState.participantUserIds.filter((userId) => userId !== selfUserId);
    const peerUserIdSet = new Set(peerUserIds);

    Array.from(peerConnectionsRef.current.keys()).forEach((existingPeerId) => {
      if (!peerUserIdSet.has(existingPeerId)) {
        closePeerConnection(existingPeerId);
      }
    });

    peerUserIds.forEach((peerUserId) => {
      const peerConnection = createOrGetPeerConnection(peerUserId, true);
      if (offeredPeerUserIdsRef.current.has(peerUserId) || !socket) {
        return;
      }

      offeredPeerUserIdsRef.current.add(peerUserId);

      void (async () => {
        try {
          if (peerConnection.signalingState !== "stable") {
            return;
          }

          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);

          socket.emit("innovation-pitch-offer", {
            targetUserId: peerUserId,
            sdp: offer,
          });
        } catch {
          closePeerConnection(peerUserId);
        }
      })();
    });
  }, [
    closeAllPeerConnections,
    closePeerConnection,
    createOrGetPeerConnection,
    innovationState.participantUserIds,
    innovationState.pitchSpeakerUserId,
    selfUserId,
    socket,
    stopLocalStream,
  ]);

  useEffect(() => {
    if (isPresenter && innovationState.pitchMicEnabled) {
      setPitchVoiceError(null);
      setIsPitchMicToggling(false);
    }

    if (isPresenter && !innovationState.pitchMicEnabled) {
      stopLocalStream();
      closeAllPeerConnections();
      setIsPitchMicToggling(false);
    }
  }, [closeAllPeerConnections, innovationState.pitchMicEnabled, isPresenter, stopLocalStream]);

  const startSharing = useCallback(() => {
    socket?.emit("innovation-start-share");
  }, [socket]);

  const stopSharing = useCallback(() => {
    socket?.emit("innovation-stop-share");
  }, [socket]);

  const togglePitchMic = useCallback(async () => {
    if (!socket || !selfUserId || !isPresenter) {
      return;
    }

    if (!isPitchVoiceSupported) {
      setPitchVoiceError("Voice is not supported in this browser.");
      return;
    }

    if (innovationState.pitchMicEnabled) {
      socket.emit("innovation-pitch-mic", { enabled: false });
      stopLocalStream();
      closeAllPeerConnections();
      setPitchVoiceError(null);
      return;
    }

    try {
      setIsPitchMicToggling(true);
      setPitchVoiceError(null);

      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      localStreamRef.current = localStream;
      socket.emit("innovation-pitch-mic", { enabled: true });
    } catch {
      stopLocalStream();
      setPitchVoiceError("Could not access microphone. Please allow mic permission.");
      setIsPitchMicToggling(false);
    }
  }, [
    closeAllPeerConnections,
    innovationState.pitchMicEnabled,
    isPitchVoiceSupported,
    isPresenter,
    selfUserId,
    socket,
    stopLocalStream,
  ]);

  const sendWhiteboardStroke = useCallback(
    (payload: { points: Array<{ x: number; y: number }>; color?: string; width?: number }) => {
      socket?.emit("innovation-whiteboard-stroke", payload);
    },
    [socket]
  );

  const clearWhiteboard = useCallback(() => {
    socket?.emit("innovation-whiteboard-clear");
  }, [socket]);

  const addIdea = useCallback(
    (text: string) => {
      socket?.emit("innovation-idea-add", { text });
    },
    [socket]
  );

  const toggleIdeaVote = useCallback(
    (ideaId: string) => {
      socket?.emit("innovation-idea-vote-toggle", { ideaId });
    },
    [socket]
  );

  useEffect(() => {
    return () => {
      stopLocalStream();
      closeAllPeerConnections();
    };
  }, [closeAllPeerConnections, stopLocalStream]);

  return {
    innovationState,
    isPresenter,
    isPitchMicToggling,
    pitchVoiceError,
    isPitchVoiceSupported,
    startSharing,
    stopSharing,
    togglePitchMic,
    sendWhiteboardStroke,
    clearWhiteboard,
    addIdea,
    toggleIdeaVote,
  };
};
