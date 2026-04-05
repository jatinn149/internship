import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { RoomId } from "../types/room";

interface UseSocialLoungeVoiceOptions {
  socket: Socket | null;
  selfUserId: string | null;
  currentRoomId: RoomId;
}

interface SocialVoiceParticipantsPayload {
  userIds: string[];
}

interface SocialVoiceOfferEvent {
  fromUserId: string;
  sdp: RTCSessionDescriptionInit;
}

interface SocialVoiceAnswerEvent {
  fromUserId: string;
  sdp: RTCSessionDescriptionInit;
}

interface SocialVoiceIceCandidateEvent {
  fromUserId: string;
  candidate: RTCIceCandidateInit;
}

interface SocialVoiceForcedOffEvent {
  reason?: string;
}

interface UseSocialLoungeVoiceResult {
  isVoiceSupported: boolean;
  micEnabled: boolean;
  isTogglingMic: boolean;
  voiceError: string | null;
  voiceEnabledUserIds: string[];
  speakingUserIds: string[];
  toggleMic: () => Promise<void>;
}

const STUN_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const SOCIAL_LOUNGE_ID: RoomId = "social-lounge";
const SPEAKING_THRESHOLD = 0.03;
const SPEAKING_HOLD_MS = 450;
const SPEAKING_TICK_MS = 120;

interface AudioMonitor {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  buffer: Uint8Array;
}

const hasAudioActivity = (monitor: AudioMonitor): boolean => {
  monitor.analyser.getByteTimeDomainData(monitor.buffer as Uint8Array<ArrayBuffer>);

  let totalDeviation = 0;
  for (let index = 0; index < monitor.buffer.length; index += 1) {
    totalDeviation += Math.abs(monitor.buffer[index] - 128) / 128;
  }

  const averageDeviation = totalDeviation / monitor.buffer.length;
  return averageDeviation > SPEAKING_THRESHOLD;
};

const sameUserIdSnapshot = (current: string[], next: string[]): boolean => {
  if (current.length !== next.length) {
    return false;
  }

  for (let index = 0; index < current.length; index += 1) {
    if (current[index] !== next[index]) {
      return false;
    }
  }

  return true;
};

export const useSocialLoungeVoice = ({
  socket,
  selfUserId,
  currentRoomId,
}: UseSocialLoungeVoiceOptions): UseSocialLoungeVoiceResult => {
  const [micEnabled, setMicEnabled] = useState(false);
  const [isTogglingMic, setIsTogglingMic] = useState(false);
  const [voiceEnabledUserIds, setVoiceEnabledUserIds] = useState<string[]>([]);
  const [speakingUserIds, setSpeakingUserIds] = useState<string[]>([]);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const offerCreatedForPeerRef = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const localAudioMonitorRef = useRef<AudioMonitor | null>(null);
  const remoteAudioMonitorByUserRef = useRef<Map<string, AudioMonitor>>(new Map());
  const speakingUntilByUserRef = useRef<Map<string, number>>(new Map());
  const speakingLoopIntervalRef = useRef<number | null>(null);
  const micEnabledRef = useRef(false);

  const isInSocialLounge = currentRoomId === SOCIAL_LOUNGE_ID;

  const isVoiceSupported = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return !!window.RTCPeerConnection && !!navigator.mediaDevices?.getUserMedia;
  }, []);

  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  const ensureAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") {
      return null;
    }

    if (!audioContextRef.current) {
      const WebAudioContext = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!WebAudioContext) {
        return null;
      }

      audioContextRef.current = new WebAudioContext();
    }

    if (audioContextRef.current.state === "suspended") {
      void audioContextRef.current.resume().catch(() => {
        // Resume can be blocked until user interaction.
      });
    }

    return audioContextRef.current;
  }, []);

  const clearSpeakingSnapshot = useCallback(() => {
    setSpeakingUserIds((previous) => (previous.length === 0 ? previous : []));
  }, []);

  const removeRemoteAudioMonitor = useCallback(
    (peerUserId: string) => {
      const monitor = remoteAudioMonitorByUserRef.current.get(peerUserId);
      if (monitor) {
        monitor.source.disconnect();
        monitor.analyser.disconnect();
        remoteAudioMonitorByUserRef.current.delete(peerUserId);
      }

      speakingUntilByUserRef.current.delete(peerUserId);
      setSpeakingUserIds((previous) => previous.filter((userId) => userId !== peerUserId));
    },
    [setSpeakingUserIds]
  );

  const removeLocalAudioMonitor = useCallback(() => {
    const monitor = localAudioMonitorRef.current;
    if (monitor) {
      monitor.source.disconnect();
      monitor.analyser.disconnect();
      localAudioMonitorRef.current = null;
    }

    if (selfUserId) {
      speakingUntilByUserRef.current.delete(selfUserId);
      setSpeakingUserIds((previous) => previous.filter((userId) => userId !== selfUserId));
    }
  }, [selfUserId]);

  const stopSpeakingLoop = useCallback(() => {
    if (speakingLoopIntervalRef.current !== null) {
      window.clearInterval(speakingLoopIntervalRef.current);
      speakingLoopIntervalRef.current = null;
    }
  }, []);

  const teardownAudioAnalysis = useCallback(() => {
    stopSpeakingLoop();

    removeLocalAudioMonitor();

    Array.from(remoteAudioMonitorByUserRef.current.keys()).forEach((peerUserId) => {
      removeRemoteAudioMonitor(peerUserId);
    });

    speakingUntilByUserRef.current.clear();
    clearSpeakingSnapshot();

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {
        // Ignore close failures.
      });
      audioContextRef.current = null;
    }
  }, [clearSpeakingSnapshot, removeLocalAudioMonitor, removeRemoteAudioMonitor, stopSpeakingLoop]);

  const attachAudioMonitor = useCallback(
    (stream: MediaStream): AudioMonitor | null => {
      const context = ensureAudioContext();
      if (!context) {
        return null;
      }

      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      return {
        source,
        analyser,
        buffer: new Uint8Array(analyser.frequencyBinCount),
      };
    },
    [ensureAudioContext]
  );

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

    removeRemoteAudioMonitor(peerUserId);
    offerCreatedForPeerRef.current.delete(peerUserId);
  }, [removeRemoteAudioMonitor]);

  const closeAllPeerConnections = useCallback(() => {
    Array.from(peerConnectionsRef.current.keys()).forEach((peerUserId) => {
      closePeerConnection(peerUserId);
    });
  }, [closePeerConnection]);

  const disableMic = useCallback(
    (notifyServer: boolean) => {
      if (notifyServer && socket?.connected) {
        socket.emit("social-voice-mic", { enabled: false });
      }

      setMicEnabled(false);
      micEnabledRef.current = false;
      closeAllPeerConnections();
      stopLocalStream();
      teardownAudioAnalysis();
    },
    [closeAllPeerConnections, socket, stopLocalStream, teardownAudioAnalysis]
  );

  const createOrGetPeerConnection = useCallback(
    (peerUserId: string): RTCPeerConnection => {
      const existingConnection = peerConnectionsRef.current.get(peerUserId);
      if (existingConnection) {
        return existingConnection;
      }

      const peerConnection = new RTCPeerConnection({
        iceServers: STUN_ICE_SERVERS,
      });

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStreamRef.current as MediaStream);
        });
      }

      peerConnection.onicecandidate = (event) => {
        if (!event.candidate || !socket || !micEnabledRef.current) {
          return;
        }

        socket.emit("social-voice-ice-candidate", {
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

          removeRemoteAudioMonitor(peerUserId);
          const monitor = attachAudioMonitor(remoteStream);
          if (monitor) {
            remoteAudioMonitorByUserRef.current.set(peerUserId, monitor);
          }

          void remoteAudio.play().catch(() => {
            // Browser autoplay policy can block until user interacts.
          });
        }
      };

      peerConnection.onconnectionstatechange = () => {
        const currentState = peerConnection.connectionState;
        if (currentState === "failed" || currentState === "disconnected" || currentState === "closed") {
          closePeerConnection(peerUserId);
        }
      };

      peerConnectionsRef.current.set(peerUserId, peerConnection);
      return peerConnection;
    },
    [attachAudioMonitor, closePeerConnection, removeRemoteAudioMonitor, socket]
  );

  const toggleMic = useCallback(async () => {
    if (!socket || !selfUserId) {
      return;
    }

    if (!isVoiceSupported) {
      setVoiceError("Voice chat is not supported in this browser.");
      return;
    }

    if (micEnabledRef.current) {
      disableMic(true);
      setVoiceError(null);
      return;
    }

    if (!isInSocialLounge) {
      setVoiceError("Mic is available only in Social Lounge.");
      return;
    }

    try {
      setIsTogglingMic(true);
      setVoiceError(null);

      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      localStreamRef.current = localStream;
      removeLocalAudioMonitor();
      const monitor = attachAudioMonitor(localStream);
      if (monitor) {
        localAudioMonitorRef.current = monitor;
      }

      setMicEnabled(true);
      micEnabledRef.current = true;
      socket.emit("social-voice-mic", { enabled: true });
    } catch (error) {
      setVoiceError("Could not access microphone. Please allow mic permission.");
      stopLocalStream();
      setMicEnabled(false);
      micEnabledRef.current = false;
    } finally {
      setIsTogglingMic(false);
    }
  }, [attachAudioMonitor, disableMic, isInSocialLounge, isVoiceSupported, removeLocalAudioMonitor, selfUserId, socket, stopLocalStream]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleParticipantsUpdate = ({ userIds }: SocialVoiceParticipantsPayload) => {
      const nextUserIds = Array.isArray(userIds) ? [...new Set(userIds)].sort((first, second) => first.localeCompare(second)) : [];
      setVoiceEnabledUserIds(nextUserIds);
    };

    const handleForcedOff = ({ reason }: SocialVoiceForcedOffEvent = {}) => {
      disableMic(false);
      setVoiceError(reason === "left-social-lounge" ? "Mic turned off because you left Social Lounge." : "Mic was turned off.");
    };

    const handleSocialVoiceOffer = async ({ fromUserId, sdp }: SocialVoiceOfferEvent) => {
      if (!micEnabledRef.current || !socket) {
        return;
      }

      const peerConnection = createOrGetPeerConnection(fromUserId);

      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.emit("social-voice-answer", {
          targetUserId: fromUserId,
          sdp: answer,
        });
      } catch {
        closePeerConnection(fromUserId);
      }
    };

    const handleSocialVoiceAnswer = async ({ fromUserId, sdp }: SocialVoiceAnswerEvent) => {
      const peerConnection = peerConnectionsRef.current.get(fromUserId);
      if (!peerConnection) {
        return;
      }

      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch {
        closePeerConnection(fromUserId);
      }
    };

    const handleSocialVoiceIceCandidate = async ({ fromUserId, candidate }: SocialVoiceIceCandidateEvent) => {
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
      disableMic(false);
      setVoiceEnabledUserIds([]);
      clearSpeakingSnapshot();
    };

    socket.on("social-voice-participants", handleParticipantsUpdate);
    socket.on("social-voice-forced-off", handleForcedOff);
    socket.on("social-voice-offer", handleSocialVoiceOffer);
    socket.on("social-voice-answer", handleSocialVoiceAnswer);
    socket.on("social-voice-ice-candidate", handleSocialVoiceIceCandidate);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("social-voice-participants", handleParticipantsUpdate);
      socket.off("social-voice-forced-off", handleForcedOff);
      socket.off("social-voice-offer", handleSocialVoiceOffer);
      socket.off("social-voice-answer", handleSocialVoiceAnswer);
      socket.off("social-voice-ice-candidate", handleSocialVoiceIceCandidate);
      socket.off("disconnect", handleDisconnect);
    };
  }, [clearSpeakingSnapshot, closePeerConnection, createOrGetPeerConnection, disableMic, socket]);

  useEffect(() => {
    if (!micEnabled || !socket || !selfUserId) {
      closeAllPeerConnections();
      stopSpeakingLoop();
      speakingUntilByUserRef.current.clear();
      clearSpeakingSnapshot();
      return;
    }

    const peerIds = voiceEnabledUserIds.filter((userId) => userId !== selfUserId);
    const peerIdSet = new Set(peerIds);

    Array.from(peerConnectionsRef.current.keys()).forEach((existingPeerId) => {
      if (!peerIdSet.has(existingPeerId)) {
        closePeerConnection(existingPeerId);
      }
    });

    peerIds.forEach((peerUserId) => {
      const peerConnection = createOrGetPeerConnection(peerUserId);
      const shouldInitiateOffer = selfUserId.localeCompare(peerUserId) < 0;

      if (!shouldInitiateOffer || offerCreatedForPeerRef.current.has(peerUserId)) {
        return;
      }

      offerCreatedForPeerRef.current.add(peerUserId);

      void (async () => {
        try {
          if (peerConnection.signalingState !== "stable") {
            return;
          }

          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);

          socket.emit("social-voice-offer", {
            targetUserId: peerUserId,
            sdp: offer,
          });
        } catch {
          closePeerConnection(peerUserId);
        }
      })();
    });

    stopSpeakingLoop();
    speakingLoopIntervalRef.current = window.setInterval(() => {
      if (!micEnabledRef.current) {
        return;
      }

      const now = Date.now();

      if (selfUserId && localAudioMonitorRef.current && hasAudioActivity(localAudioMonitorRef.current)) {
        speakingUntilByUserRef.current.set(selfUserId, now + SPEAKING_HOLD_MS);
      }

      remoteAudioMonitorByUserRef.current.forEach((monitor, peerUserId) => {
        if (hasAudioActivity(monitor)) {
          speakingUntilByUserRef.current.set(peerUserId, now + SPEAKING_HOLD_MS);
        }
      });

      const activeSpeakerIds = Array.from(speakingUntilByUserRef.current.entries())
        .filter(([, speakingUntil]) => speakingUntil > now)
        .map(([userId]) => userId)
        .filter((userId) => voiceEnabledUserIds.includes(userId))
        .sort((first, second) => first.localeCompare(second));

      setSpeakingUserIds((previous) => {
        return sameUserIdSnapshot(previous, activeSpeakerIds) ? previous : activeSpeakerIds;
      });

      Array.from(speakingUntilByUserRef.current.entries()).forEach(([userId, speakingUntil]) => {
        if (speakingUntil <= now) {
          speakingUntilByUserRef.current.delete(userId);
        }
      });
    }, SPEAKING_TICK_MS);

    return () => {
      stopSpeakingLoop();
    };
  }, [
    clearSpeakingSnapshot,
    closeAllPeerConnections,
    closePeerConnection,
    createOrGetPeerConnection,
    micEnabled,
    selfUserId,
    socket,
    stopSpeakingLoop,
    voiceEnabledUserIds,
  ]);

  useEffect(() => {
    if (!micEnabled || isInSocialLounge) {
      return;
    }

    disableMic(true);
    setVoiceError("Mic turned off because you left Social Lounge.");
  }, [disableMic, isInSocialLounge, micEnabled]);

  useEffect(() => {
    return () => {
      disableMic(false);
      teardownAudioAnalysis();
    };
  }, [disableMic, teardownAudioAnalysis]);

  return {
    isVoiceSupported,
    micEnabled,
    isTogglingMic,
    voiceError,
    voiceEnabledUserIds,
    speakingUserIds,
    toggleMic,
  };
};
