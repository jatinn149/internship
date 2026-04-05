interface SpaceTopBarProps {
  selfLabel: string | null;
  onlineCount: number;
  nearbyCount: number;
  currentRoomName: string;
}

export const SpaceTopBar = ({ selfLabel, onlineCount, nearbyCount, currentRoomName }: SpaceTopBarProps) => {
  return (
    <header className="rounded-2xl border border-cosmos-700/60 bg-cosmos-800/45 p-3 shadow-panel">
      <div className="flex h-full flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-cosmos-300">Cosmos Space</p>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">{currentRoomName}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-cosmos-700/70 bg-cosmos-900/70 px-3 py-1 text-slate-200">
            You: {selfLabel || "connecting..."}
          </span>
          <span className="rounded-full border border-cosmos-700/70 bg-cosmos-900/70 px-3 py-1 text-slate-200">
            Online: {onlineCount}
          </span>
          <span className="rounded-full border border-cosmos-700/70 bg-cosmos-900/70 px-3 py-1 text-slate-200">
            Nearby: {nearbyCount}
          </span>
        </div>
      </div>
    </header>
  );
};
