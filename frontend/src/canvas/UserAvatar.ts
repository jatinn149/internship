import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { AvatarHairStyle, AvatarOutfitColor, AvatarProfile, AvatarSkinTone, Position } from "../types/user";

const LABEL_STYLE = new TextStyle({
  fill: 0xe8edf6,
  fontFamily: "monospace",
  fontSize: 11,
  fontWeight: "700",
});

export class UserAvatar {
  public readonly container: Container;

  private readonly body: Graphics;
  private readonly label: Text;
  private profile: AvatarProfile;
  private profileKey: string;
  private isSelfHighlighted: boolean;
  private currentX: number;
  private currentY: number;
  private targetX: number;
  private targetY: number;

  constructor(userId: string, displayName: string, profile: AvatarProfile, isSelf: boolean, initialPosition: Position) {
    this.container = new Container();
    this.body = new Graphics();
    this.profile = profile;
    this.profileKey = UserAvatar.profileToKey(profile);
    this.isSelfHighlighted = isSelf;
    this.label = new Text({
      text: displayName || userId,
      style: LABEL_STYLE,
    });

    this.currentX = initialPosition.x;
    this.currentY = initialPosition.y;
    this.targetX = initialPosition.x;
    this.targetY = initialPosition.y;

    this.drawAvatar(isSelf);

    this.label.anchor.set(0.5, 1);
    this.label.position.set(0, -30);

    this.container.addChild(this.body);
    this.container.addChild(this.label);
    this.container.position.set(this.currentX, this.currentY);
  }

  public setTargetPosition(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  public syncIdentity(displayName: string, profile: AvatarProfile, isSelf: boolean): void {
    let shouldRedraw = false;

    if (this.label.text !== displayName) {
      this.label.text = displayName;
    }

    const nextProfileKey = UserAvatar.profileToKey(profile);
    if (nextProfileKey !== this.profileKey) {
      this.profile = profile;
      this.profileKey = nextProfileKey;
      shouldRedraw = true;
    }

    if (this.isSelfHighlighted !== isSelf) {
      this.isSelfHighlighted = isSelf;
      shouldRedraw = true;
    }

    if (shouldRedraw) {
      this.drawAvatar(isSelf);
    }
  }

  public setSelf(isSelf: boolean): void {
    this.syncIdentity(this.label.text, this.profile, isSelf);
  }

  public animate(): void {
    const SMOOTHING = 0.22;

    this.currentX += (this.targetX - this.currentX) * SMOOTHING;
    this.currentY += (this.targetY - this.currentY) * SMOOTHING;
    this.container.position.set(this.currentX, this.currentY);
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }

  private drawAvatar(isSelf: boolean): void {
    const outlineColor = isSelf ? 0xf59e0b : 0x60a5fa;
    const palette = UserAvatar.resolvePalette(this.profile);

    this.body.clear();

    this.body.ellipse(0, 12, 9, 3.5).fill({ color: 0x020617, alpha: 0.35 });
    this.body.circle(0, -17, 5.2).fill({ color: palette.skin, alpha: 0.98 });

    if (this.profile.gender === "female") {
      this.body.ellipse(0, -19.2, 5.8, 3.2).fill({ color: palette.hair, alpha: 0.95 });
      if (this.profile.hairStyle !== "short") {
        this.body.ellipse(4.8, -16.2, 1.8, 2.6).fill({ color: palette.hair, alpha: 0.95 });
      }
      if (this.profile.hairStyle === "curly") {
        this.body.circle(-4.5, -16.5, 1.4).fill({ color: palette.hair, alpha: 0.92 });
        this.body.circle(-2.6, -14.8, 1.1).fill({ color: palette.hair, alpha: 0.92 });
      }
      this.body.roundRect(-3.4, -11.4, 6.8, 8.8, 2.8).fill({ color: palette.shirt, alpha: 0.96 });
      this.body.poly([-6.2, -2.2, 0, 7.8, 6.2, -2.2]).fill({ color: palette.lower, alpha: 0.95 });
      this.body.roundRect(-2.5, 7.2, 2.1, 6.8, 1.1).fill({ color: 0xcbd5e1, alpha: 0.96 });
      this.body.roundRect(0.4, 7.2, 2.1, 6.8, 1.1).fill({ color: 0xcbd5e1, alpha: 0.96 });
    } else {
      if (this.profile.hairStyle === "long") {
        this.body.ellipse(0, -19.4, 6.2, 3.2).fill({ color: palette.hair, alpha: 0.95 });
      } else if (this.profile.hairStyle === "curly") {
        this.body.circle(-2.4, -19.1, 1.5).fill({ color: palette.hair, alpha: 0.95 });
        this.body.circle(0, -19.8, 1.5).fill({ color: palette.hair, alpha: 0.95 });
        this.body.circle(2.4, -19.1, 1.5).fill({ color: palette.hair, alpha: 0.95 });
      } else {
        this.body.ellipse(0, -19, 5.5, 3).fill({ color: palette.hair, alpha: 0.95 });
      }
      this.body.roundRect(-4.2, -11.5, 8.4, 11, 3).fill({ color: palette.shirt, alpha: 0.96 });
      this.body.roundRect(-4.2, 0, 3.4, 11.5, 1.2).fill({ color: palette.lower, alpha: 0.95 });
      this.body.roundRect(0.8, 0, 3.4, 11.5, 1.2).fill({ color: palette.lower, alpha: 0.95 });
    }

    this.body.roundRect(-7.6, -9.6, 2.5, 8.1, 1.1).fill({ color: 0xf8d5b3, alpha: 0.96 });
    this.body.roundRect(5.1, -9.6, 2.5, 8.1, 1.1).fill({ color: 0xf8d5b3, alpha: 0.96 });
    this.body.circle(0, -17, 5.2).stroke({ color: 0x1e293b, width: 0.7, alpha: 0.45 });
    this.body.circle(0, -1.5, 14).stroke({ color: outlineColor, width: 1.4, alpha: isSelf ? 0.68 : 0.35 });
  }

  private static resolvePalette(profile: AvatarProfile): {
    skin: number;
    shirt: number;
    lower: number;
    hair: number;
  } {
    const skinToneMap: Record<AvatarSkinTone, number> = {
      light: 0xf6d2b2,
      medium: 0xd6a57a,
      dark: 0x8f613f,
    };

    const outfitMap: Record<AvatarOutfitColor, { shirt: number; lower: number }> = {
      azure: { shirt: 0x0ea5e9, lower: 0x0284c7 },
      rose: { shirt: 0xec4899, lower: 0xdb2777 },
      emerald: { shirt: 0x10b981, lower: 0x059669 },
      amber: { shirt: 0xf59e0b, lower: 0xd97706 },
    };

    const hairMap: Record<AvatarHairStyle, number> = {
      short: 0x1f2937,
      long: 0x7e22ce,
      curly: 0x7c2d12,
    };

    const selectedOutfit = outfitMap[profile.outfitColor];
    return {
      skin: skinToneMap[profile.skinTone],
      shirt: selectedOutfit.shirt,
      lower: selectedOutfit.lower,
      hair: hairMap[profile.hairStyle],
    };
  }

  private static profileToKey(profile: AvatarProfile): string {
    return `${profile.gender}|${profile.skinTone}|${profile.outfitColor}|${profile.hairStyle}`;
  }
}
