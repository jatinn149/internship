import { AvatarProfile, Position } from "./user";

export interface JoinCosmosPayload {
  userId?: string;
  displayName?: string;
  avatar?: AvatarProfile;
  position?: Position;
}

export interface JoinedCosmosPayload {
  userId: string;
  displayName: string;
  avatar: AvatarProfile;
  position: Position;
}

export interface ConnectUserPayload {
  targetUserId: string;
}
