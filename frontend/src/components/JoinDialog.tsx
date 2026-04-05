import { FormEvent, useMemo, useState } from "react";
import {
  AvatarGender,
  AvatarHairStyle,
  AvatarOutfitColor,
  AvatarProfile,
  AvatarSkinTone,
  JoinIdentity,
} from "../types/user";

const GENDER_OPTIONS: AvatarGender[] = ["male", "female"];
const SKIN_TONE_OPTIONS: AvatarSkinTone[] = ["light", "medium", "dark"];
const OUTFIT_OPTIONS: AvatarOutfitColor[] = ["azure", "rose", "emerald", "amber"];
const HAIR_STYLE_OPTIONS: AvatarHairStyle[] = ["short", "long", "curly"];

const DEFAULT_AVATAR: AvatarProfile = {
  gender: "male",
  skinTone: "medium",
  outfitColor: "azure",
  hairStyle: "short",
};

interface JoinDialogProps {
  onSubmit: (identity: JoinIdentity) => void;
}

const toneClassMap: Record<AvatarSkinTone, string> = {
  light: "#f6d2b2",
  medium: "#d6a57a",
  dark: "#8f613f",
};

const shirtColorMap: Record<AvatarOutfitColor, string> = {
  azure: "#0ea5e9",
  rose: "#ec4899",
  emerald: "#10b981",
  amber: "#f59e0b",
};

const hairColorMap: Record<AvatarHairStyle, string> = {
  short: "#1f2937",
  long: "#7e22ce",
  curly: "#7c2d12",
};

export const JoinDialog = ({ onSubmit }: JoinDialogProps) => {
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState<AvatarProfile>(DEFAULT_AVATAR);

  const trimmedName = useMemo(() => {
    return displayName.trim();
  }, [displayName]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmedName) {
      return;
    }

    onSubmit({
      displayName: trimmedName,
      avatar,
    });
  };

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-cosmos-900/85 px-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl rounded-2xl border border-cosmos-700/70 bg-cosmos-900 p-6 shadow-panel"
      >
        <h2 className="text-2xl font-bold text-cosmos-300">Enter Virtual Cosmos</h2>
        <p className="mt-1 text-sm text-slate-400">Set your identity before joining the live space.</p>

        <label className="mt-5 block text-sm font-semibold text-slate-200" htmlFor="displayName">
          Name
        </label>
        <input
          id="displayName"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Type your name"
          maxLength={24}
          className="mt-2 w-full rounded-lg border border-cosmos-700/70 bg-cosmos-800/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cosmos-300"
          required
          autoFocus
        />

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-slate-200">Gender</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {GENDER_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAvatar((previous) => ({ ...previous, gender: option }))}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition ${
                    avatar.gender === option
                      ? "border-cosmos-300 bg-cosmos-500/25 text-cosmos-200"
                      : "border-cosmos-700/70 bg-cosmos-800/70 text-slate-300 hover:border-cosmos-500"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-200">Skin Tone</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {SKIN_TONE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAvatar((previous) => ({ ...previous, skinTone: option }))}
                  className={`rounded-lg border px-2 py-2 text-[11px] font-semibold capitalize transition ${
                    avatar.skinTone === option
                      ? "border-cosmos-300 bg-cosmos-500/25 text-cosmos-200"
                      : "border-cosmos-700/70 bg-cosmos-800/70 text-slate-300 hover:border-cosmos-500"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-slate-200">Outfit</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {OUTFIT_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAvatar((previous) => ({ ...previous, outfitColor: option }))}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition ${
                    avatar.outfitColor === option
                      ? "border-cosmos-300 bg-cosmos-500/25 text-cosmos-200"
                      : "border-cosmos-700/70 bg-cosmos-800/70 text-slate-300 hover:border-cosmos-500"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-200">Hair Style</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {HAIR_STYLE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAvatar((previous) => ({ ...previous, hairStyle: option }))}
                  className={`rounded-lg border px-2 py-2 text-[11px] font-semibold capitalize transition ${
                    avatar.hairStyle === option
                      ? "border-cosmos-300 bg-cosmos-500/25 text-cosmos-200"
                      : "border-cosmos-700/70 bg-cosmos-800/70 text-slate-300 hover:border-cosmos-500"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-cosmos-700/60 bg-cosmos-800/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Avatar Preview</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="relative h-16 w-14">
              <div className="absolute bottom-0 left-1/2 h-2 w-10 -translate-x-1/2 rounded-full bg-black/30" />
              <div
                className="absolute left-1/2 top-1 h-4 w-4 -translate-x-1/2 rounded-full border border-slate-900/40"
                style={{ backgroundColor: toneClassMap[avatar.skinTone] }}
              />
              <div
                className="absolute left-1/2 top-0.5 h-2.5 w-5 -translate-x-1/2 rounded-full"
                style={{ backgroundColor: hairColorMap[avatar.hairStyle] }}
              />
              <div
                className="absolute left-1/2 top-5 h-6 w-6 -translate-x-1/2 rounded-md"
                style={{ backgroundColor: shirtColorMap[avatar.outfitColor] }}
              />
              {avatar.gender === "female" ? (
                <>
                  <div
                    className="absolute left-1/2 top-8 h-0 w-0 -translate-x-1/2 border-l-[11px] border-r-[11px] border-t-[15px] border-l-transparent border-r-transparent"
                    style={{ borderTopColor: shirtColorMap[avatar.outfitColor] }}
                  />
                  <div className="absolute left-1/2 top-[46px] h-[12px] w-[4px] -translate-x-[5px] rounded-sm bg-slate-300" />
                  <div className="absolute left-1/2 top-[46px] h-[12px] w-[4px] translate-x-[1px] rounded-sm bg-slate-300" />
                </>
              ) : (
                <>
                  <div className="absolute left-1/2 top-11 h-5 w-2 -translate-x-[7px] rounded-sm bg-slate-300" />
                  <div className="absolute left-1/2 top-11 h-5 w-2 translate-x-[3px] rounded-sm bg-slate-300" />
                </>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">{trimmedName || "Your avatar"}</p>
              <p className="text-xs text-slate-400">
                {avatar.gender}, {avatar.skinTone} tone, {avatar.hairStyle} hair, {avatar.outfitColor} outfit
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={!trimmedName}
          className="mt-6 w-full rounded-lg bg-cosmos-500 px-4 py-2.5 text-sm font-bold text-cosmos-900 transition hover:bg-cosmos-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Join Space
        </button>
      </form>
    </div>
  );
};
