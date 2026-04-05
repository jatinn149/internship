export interface ChatMessage {
  id: string;
  roomId: string;
  fromUserId: string;
  toUserId?: string;
  message: string;
  createdAt: string;
}

export interface ChatLinkEvent {
  peerUserId: string;
  roomId?: string;
}

export interface ChatRoomSnapshot {
  roomId: string | null;
  memberUserIds: string[];
}
