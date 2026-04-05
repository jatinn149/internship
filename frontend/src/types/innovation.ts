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
