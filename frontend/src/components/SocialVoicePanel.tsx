interface VoiceUser {
  id: string;
  displayName: string;
}

interface SocialVoicePanelProps {
  isVoiceSupported: boolean;
  micEnabled: boolean;
  isTogglingMic: boolean;
  participants: VoiceUser[];
  speakingUserIds: string[];
  selfUserId: string | null;
  voiceError: string | null;
  onToggleMic: () => void;
}

export const SocialVoicePanel = ({
  isVoiceSupported,
  micEnabled,
  isTogglingMic,
  participants,
  speakingUserIds,
  selfUserId,
  voiceError,
  onToggleMic,
}: SocialVoicePanelProps) => {
  return (
    <section className="rounded-2xl border border-sky-500/40 bg-sky-950/20 p-4 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-200">Social Lounge Voice</h2>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
            micEnabled
              ? "border-emerald-300/60 bg-emerald-500/20 text-emerald-100"
              : "border-sky-300/40 bg-sky-500/10 text-sky-200"
          }`}
        >
          {micEnabled ? "Mic On" : "Mic Off"}
        </span>
      </div>

      <p className="mt-2 text-xs text-sky-100/80">
        Voice is available only in Social Lounge. Leaving this room automatically turns your mic off.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onToggleMic}
          disabled={!isVoiceSupported || isTogglingMic}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
            micEnabled
              ? "border-rose-300/50 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
              : "border-sky-300/50 bg-sky-500/20 text-sky-100 hover:bg-sky-500/30"
          }`}
        >
          {isTogglingMic ? "Connecting..." : micEnabled ? "Turn Mic Off" : "Turn Mic On"}
        </button>
      </div>

      {!isVoiceSupported ? (
        <p className="mt-2 text-xs text-rose-200">This browser does not support realtime voice.</p>
      ) : null}

      {voiceError ? <p className="mt-2 text-xs text-amber-200">{voiceError}</p> : null}

      <div className="mt-3 rounded-xl border border-sky-300/30 bg-black/20 p-3">
        <p className="text-xs font-semibold text-sky-100">Live on mic ({participants.length})</p>

        <div className="mt-2 max-h-28 space-y-1 overflow-y-auto pr-1">
          {participants.length === 0 ? <p className="text-xs text-sky-100/70">No one is talking right now.</p> : null}

          {participants.map((participant) => (
            <div
              key={participant.id}
              className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs ${
                participant.id === selfUserId
                  ? "border-amber-300/60 bg-amber-400/15 text-amber-100"
                  : "border-sky-300/35 bg-sky-900/25 text-sky-100"
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    speakingUserIds.includes(participant.id)
                      ? "animate-pulse bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.9)]"
                      : "bg-sky-300/45"
                  }`}
                />
                <span className="truncate">{participant.displayName}</span>
              </div>

              <div className="flex items-center gap-2">
                {speakingUserIds.includes(participant.id) ? (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-200">Speaking</span>
                ) : null}
                <span className="text-[10px] text-sky-100/70">@{participant.id}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
