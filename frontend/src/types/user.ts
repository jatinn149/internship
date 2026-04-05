export interface Position {
  x: number;
  y: number;
}

export type AvatarGender = "male" | "female";
export type AvatarSkinTone = "light" | "medium" | "dark";
export type AvatarOutfitColor = "azure" | "rose" | "emerald" | "amber";
export type AvatarHairStyle = "short" | "long" | "curly";

export interface AvatarProfile {
  gender: AvatarGender;
  skinTone: AvatarSkinTone;
  outfitColor: AvatarOutfitColor;
  hairStyle: AvatarHairStyle;
}

export interface JoinIdentity {
  displayName: string;
  avatar: AvatarProfile;
}

export interface CosmosUser {
  id: string;
  displayName: string;
  avatar: AvatarProfile;
  x: number;
  y: number;
}
