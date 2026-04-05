import { useMemo, useState } from "react";
import { ArenaGameSnapshot, ArenaGameType, ArenaLobbySnapshot } from "../types/game";

interface ArenaPlayer {
  id: string;
  displayName: string;
}

interface GameArenaPanelProps {
  selfUserId: string | null;
  arenaPlayers: ArenaPlayer[];
  arenaGame: ArenaGameSnapshot | null;
  arenaLobby: ArenaLobbySnapshot;
  onChallengePlayer: (targetUserId: string, gameType: ArenaGameType) => void;
  onRespondChallenge: (challengerUserId: string, accept: boolean) => void;
  onLeaveMatch: () => void;
  onAction: (action: "tap" | "roll") => void;
}

const GAME_NAME: Record<ArenaGameType, string> = {
  "tap-race": "Tap Race",
  "dice-clash": "Dice Clash",
};

export const GameArenaPanel = ({
  selfUserId,
  arenaPlayers,
  arenaGame,
  arenaLobby,
  onChallengePlayer,
  onRespondChallenge,
  onLeaveMatch,
  onAction,
}: GameArenaPanelProps) => {
  const [selectedGameType, setSelectedGameType] = useState<ArenaGameType>("tap-race");
  const canChallenge = !arenaLobby.hasActiveGame;
  const isParticipant = !!selfUserId && !!arenaGame?.participants.includes(selfUserId);
  const isActive = arenaGame?.status === "active";

  const nameByUserId = useMemo(() => {
    return Object.fromEntries(arenaPlayers.map((player) => [player.id, player.displayName]));
  }, [arenaPlayers]);

  const availablePlayers = arenaLobby.availablePlayerUserIds.map((userId) => ({
    userId,
    displayName: nameByUserId[userId] ?? userId,
  }));

  const sortedScoreRows = arenaGame
    ? arenaGame.participants
        .map((userId) => ({
          userId,
          score: arenaGame.scores[userId] ?? 0,
          displayName: nameByUserId[userId] ?? userId,
        }))
        .sort((first, second) => {
          if (first.score !== second.score) {
            return second.score - first.score;
          }

          return first.userId.localeCompare(second.userId);
        })
    : [];

  return (
    <section className="rounded-2xl border border-orange-500/40 bg-orange-950/25 p-4 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-orange-100">Game Arena</h2>
        <span className="rounded-full border border-orange-400/40 bg-orange-500/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-200">
          {arenaPlayers.length} players
        </span>
      </div>

      <p className="mt-2 text-xs text-orange-200/80">Simple multiplayer games for users inside Game Arena.</p>

      {!arenaGame ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-orange-300/30 bg-black/20 p-3">
            <p className="text-xs font-semibold text-orange-100">Choose game type</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedGameType("tap-race")}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  selectedGameType === "tap-race"
                    ? "border-orange-200/70 bg-orange-500/35 text-orange-50"
                    : "border-orange-300/40 bg-orange-500/20 text-orange-100 hover:bg-orange-500/30"
                }`}
              >
                Tap Race
              </button>
              <button
                onClick={() => setSelectedGameType("dice-clash")}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  selectedGameType === "dice-clash"
                    ? "border-orange-200/70 bg-orange-500/35 text-orange-50"
                    : "border-orange-300/40 bg-orange-500/20 text-orange-100 hover:bg-orange-500/30"
                }`}
              >
                Dice Clash
              </button>
            </div>
          </div>

          {arenaLobby.hasActiveGame ? (
            <p className="text-xs text-orange-200/70">Another match is currently running. You can challenge after it finishes.</p>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-orange-100">Challenge a player</p>
            {availablePlayers.length === 0 ? (
              <p className="text-xs text-orange-200/70">No available players right now.</p>
            ) : (
              availablePlayers.map((player) => (
                <div
                  key={player.userId}
                  className="flex items-center justify-between rounded-lg border border-orange-400/25 bg-orange-900/25 px-3 py-2"
                >
                  <span className="text-xs text-orange-100">{player.displayName}</span>
                  <button
                    onClick={() => onChallengePlayer(player.userId, selectedGameType)}
                    disabled={!canChallenge}
                    className="rounded-md border border-orange-300/50 bg-orange-500/25 px-2.5 py-1 text-[11px] font-semibold text-orange-100 transition hover:bg-orange-500/35 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Challenge
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-orange-100">Incoming challenges</p>
            {arenaLobby.incomingChallenges.length === 0 ? (
              <p className="text-xs text-orange-200/70">No incoming challenges.</p>
            ) : (
              arenaLobby.incomingChallenges.map((challenge) => (
                <div
                  key={`${challenge.fromUserId}-${challenge.createdAt}`}
                  className="rounded-lg border border-orange-300/30 bg-black/20 px-3 py-2"
                >
                  <p className="text-xs text-orange-100">
                    {nameByUserId[challenge.fromUserId] ?? challenge.fromUserId} invited you to {GAME_NAME[challenge.gameType]}.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => onRespondChallenge(challenge.fromUserId, true)}
                      disabled={arenaLobby.hasActiveGame}
                      className="rounded-md border border-emerald-300/50 bg-emerald-500/25 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => onRespondChallenge(challenge.fromUserId, false)}
                      className="rounded-md border border-orange-300/50 bg-orange-500/25 px-2.5 py-1 text-[11px] font-semibold text-orange-100 transition hover:bg-orange-500/35"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-orange-100">Outgoing requests</p>
            {arenaLobby.outgoingChallenges.length === 0 ? (
              <p className="text-xs text-orange-200/70">No pending outgoing requests.</p>
            ) : (
              arenaLobby.outgoingChallenges.map((challenge) => (
                <p
                  key={`${challenge.toUserId}-${challenge.createdAt}`}
                  className="rounded-lg border border-orange-300/25 bg-black/20 px-3 py-2 text-xs text-orange-100"
                >
                  Waiting for {nameByUserId[challenge.toUserId] ?? challenge.toUserId} to accept {GAME_NAME[challenge.gameType]}.
                </p>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-orange-300/30 bg-black/20 px-3 py-2 text-xs text-orange-100">
            <p className="font-semibold">{GAME_NAME[arenaGame.gameType]}</p>
            <p className="mt-1 text-[11px] text-orange-200/80">
              {arenaGame.status === "active"
                ? "Round active"
                : arenaGame.winnerUserId
                ? `Winner: ${arenaPlayers.find((player) => player.id === arenaGame.winnerUserId)?.displayName ?? arenaGame.winnerUserId}`
                : "Round ended with no winner"}
            </p>
            {arenaGame.gameType === "tap-race" && arenaGame.targetScore ? (
              <p className="mt-1 text-[11px] text-orange-200/80">First to {arenaGame.targetScore} taps wins.</p>
            ) : null}
          </div>

          <div className="space-y-2">
            {sortedScoreRows.map((row) => (
              <div
                key={row.userId}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                  row.userId === selfUserId
                    ? "border-amber-300/60 bg-amber-400/15 text-amber-100"
                    : "border-orange-400/25 bg-orange-900/25 text-orange-100"
                }`}
              >
                <span>{row.displayName}</span>
                <span className="font-semibold">{row.score}</span>
              </div>
            ))}
          </div>

          {isActive ? (
            <div className="flex flex-wrap gap-2">
              {arenaGame.gameType === "tap-race" ? (
                <button
                  onClick={() => onAction("tap")}
                  disabled={!isParticipant}
                  className="rounded-lg border border-cyan-300/50 bg-cyan-500/25 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/35 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Tap
                </button>
              ) : (
                <button
                  onClick={() => onAction("roll")}
                  disabled={!isParticipant}
                  className="rounded-lg border border-indigo-300/50 bg-indigo-500/25 px-3 py-1.5 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-500/35 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Roll Dice
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-orange-200/80">Match finished. Leave this match to start a new challenge.</p>
          )}

          <button
            onClick={onLeaveMatch}
            className="rounded-lg border border-orange-300/40 bg-orange-500/20 px-3 py-1.5 text-xs font-semibold text-orange-100 transition hover:bg-orange-500/30"
          >
            Leave Match
          </button>
        </div>
      )}
    </section>
  );
};
