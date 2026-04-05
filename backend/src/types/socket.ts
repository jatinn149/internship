import { AvatarProfile, Position } from "./user";

export interface JoinCosmosPayload {
  userId?: string;
  displayName?: string;
  avatar?: Partial<AvatarProfile>;
  position?: Position;
}

export interface ConnectUserPayload {
  targetUserId: string;
}

export interface SendMessagePayload {
  roomId?: string;
  toUserId?: string;
  message: string;
}

export type ArenaGameType = "tap-race" | "dice-clash";

export interface StartArenaGamePayload {
  gameType: ArenaGameType;
  targetUserId?: string;
}

export interface ArenaGameActionPayload {
  action: "tap" | "roll";
}

export interface ArenaChallengeResponsePayload {
  challengerUserId: string;
  accept: boolean;
}

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

export interface SocialVoiceMicPayload {
  enabled: boolean;
}

export interface SocialVoiceOfferPayload {
  targetUserId: string;
  sdp: {
    type: string;
    sdp?: string;
  };
}

export interface SocialVoiceAnswerPayload {
  targetUserId: string;
  sdp: {
    type: string;
    sdp?: string;
  };
}

export interface SocialVoiceIceCandidatePayload {
  targetUserId: string;
  candidate: {
    candidate?: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
  };
}

export interface InnovationWhiteboardPoint {
  x: number;
  y: number;
}

export interface InnovationWhiteboardStroke {
  id: string;
  fromUserId: string;
  color: string;
  width: number;
  points: InnovationWhiteboardPoint[];
  createdAt: string;
}

export interface InnovationIdea {
  id: string;
  text: string;
  createdBy: string;
  voteCount: number;
  voteUserIds: string[];
  createdAt: string;
}

export interface InnovationStateSnapshot {
  presenterUserId: string | null;
  pitchMicEnabled: boolean;
  pitchSpeakerUserId: string | null;
  participantUserIds: string[];
  whiteboardStrokes: InnovationWhiteboardStroke[];
  ideas: InnovationIdea[];
}

export interface InnovationWhiteboardStrokePayload {
  color?: string;
  width?: number;
  points: InnovationWhiteboardPoint[];
}

export interface InnovationIdeaAddPayload {
  text: string;
}

export interface InnovationIdeaVotePayload {
  ideaId: string;
}

export interface InnovationPitchMicPayload {
  enabled: boolean;
}

export interface InnovationPitchOfferPayload {
  targetUserId: string;
  sdp: {
    type: string;
    sdp?: string;
  };
}

export interface InnovationPitchAnswerPayload {
  targetUserId: string;
  sdp: {
    type: string;
    sdp?: string;
  };
}

export interface InnovationPitchIceCandidatePayload {
  targetUserId: string;
  candidate: {
    candidate?: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
  };
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

export interface ChatMessage {
  id: string;
  roomId: string;
  fromUserId: string;
  toUserId?: string;
  message: string;
  createdAt: string;
}
