import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { InnovationStateSnapshot, InnovationWhiteboardPoint } from "../types/innovation";

interface InnovationHubPanelProps {
  selfUserId: string | null;
  userDisplayNameById: Record<string, string>;
  innovationState: InnovationStateSnapshot;
  isPresenter: boolean;
  isPitchVoiceSupported: boolean;
  isPitchMicToggling: boolean;
  pitchVoiceError: string | null;
  onStartSharing: () => void;
  onStopSharing: () => void;
  onTogglePitchMic: () => void;
  onWhiteboardStroke: (payload: { points: InnovationWhiteboardPoint[]; color?: string; width?: number }) => void;
  onClearWhiteboard: () => void;
  onAddIdea: (text: string) => void;
  onToggleIdeaVote: (ideaId: string) => void;
}

const WHITEBOARD_BASE_WIDTH = 900;
const WHITEBOARD_BASE_HEIGHT = 500;
const WHITEBOARD_STROKE_COLOR = "#0f172a";
const WHITEBOARD_STROKE_WIDTH = 2;

const drawPolyline = (
  context: CanvasRenderingContext2D,
  points: InnovationWhiteboardPoint[],
  width: number,
  color: string
): void => {
  if (points.length < 2) {
    return;
  }

  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = color;
  context.lineWidth = width;
  context.beginPath();
  context.moveTo(points[0].x * WHITEBOARD_BASE_WIDTH, points[0].y * WHITEBOARD_BASE_HEIGHT);

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    context.lineTo(point.x * WHITEBOARD_BASE_WIDTH, point.y * WHITEBOARD_BASE_HEIGHT);
  }

  context.stroke();
};

export const InnovationHubPanel = ({
  selfUserId,
  userDisplayNameById,
  innovationState,
  isPresenter,
  isPitchVoiceSupported,
  isPitchMicToggling,
  pitchVoiceError,
  onStartSharing,
  onStopSharing,
  onTogglePitchMic,
  onWhiteboardStroke,
  onClearWhiteboard,
  onAddIdea,
  onToggleIdeaVote,
}: InnovationHubPanelProps) => {
  const [draftPoints, setDraftPoints] = useState<InnovationWhiteboardPoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ideaInput, setIdeaInput] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const presenterUserId = innovationState.presenterUserId;
  const speakerUserId = innovationState.pitchSpeakerUserId;
  const canStartSharing = !presenterUserId;
  const canDraw = isPresenter && !!presenterUserId;

  const presenterLabel = presenterUserId ? userDisplayNameById[presenterUserId] || presenterUserId : null;
  const speakerLabel = speakerUserId ? userDisplayNameById[speakerUserId] || speakerUserId : null;

  const sortedIdeas = useMemo(() => {
    return [...innovationState.ideas].sort((first, second) => {
      if (first.voteCount !== second.voteCount) {
        return second.voteCount - first.voteCount;
      }

      return first.createdAt.localeCompare(second.createdAt);
    });
  }, [innovationState.ideas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, WHITEBOARD_BASE_WIDTH, WHITEBOARD_BASE_HEIGHT);
    context.fillStyle = "#f8fafc";
    context.fillRect(0, 0, WHITEBOARD_BASE_WIDTH, WHITEBOARD_BASE_HEIGHT);

    context.strokeStyle = "#e2e8f0";
    context.lineWidth = 1;
    for (let x = 0; x < WHITEBOARD_BASE_WIDTH; x += 50) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, WHITEBOARD_BASE_HEIGHT);
      context.stroke();
    }
    for (let y = 0; y < WHITEBOARD_BASE_HEIGHT; y += 50) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(WHITEBOARD_BASE_WIDTH, y);
      context.stroke();
    }

    innovationState.whiteboardStrokes.forEach((stroke) => {
      drawPolyline(context, stroke.points, stroke.width, stroke.color);
    });

    if (draftPoints.length > 1) {
      drawPolyline(context, draftPoints, WHITEBOARD_STROKE_WIDTH, WHITEBOARD_STROKE_COLOR);
    }
  }, [draftPoints, innovationState.whiteboardStrokes]);

  const toNormalizedPoint = (event: ReactPointerEvent<HTMLCanvasElement>): InnovationWhiteboardPoint => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;

    return {
      x: Math.min(Math.max(x, 0), 1),
      y: Math.min(Math.max(y, 0), 1),
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDrawing(true);
    setDraftPoints([toNormalizedPoint(event)]);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || !isDrawing) {
      return;
    }

    const nextPoint = toNormalizedPoint(event);
    setDraftPoints((previous) => [...previous, nextPoint]);
  };

  const finishDrawing = () => {
    if (!canDraw || draftPoints.length < 2) {
      setDraftPoints([]);
      setIsDrawing(false);
      return;
    }

    onWhiteboardStroke({
      points: draftPoints,
      color: WHITEBOARD_STROKE_COLOR,
      width: WHITEBOARD_STROKE_WIDTH,
    });

    setDraftPoints([]);
    setIsDrawing(false);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    finishDrawing();
  };

  const handleIdeaSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = ideaInput.trim();
    if (!text) {
      return;
    }

    onAddIdea(text);
    setIdeaInput("");
  };

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-4 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-200">Innovation Studio</h2>
        <span className="rounded-full border border-emerald-300/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-100">
          {presenterLabel ? `Presenter: ${presenterLabel}` : "Presenter: None"}
        </span>
      </div>

      <p className="mt-2 text-xs text-emerald-100/80">
        Only one presenter can use whiteboard and speak at a time. Everyone else can chat and vote ideas.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={onStartSharing}
          disabled={!canStartSharing}
          className="rounded-lg border border-emerald-300/45 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Start Whiteboard
        </button>

        <button
          onClick={onStopSharing}
          disabled={!isPresenter}
          className="rounded-lg border border-rose-300/45 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Stop Sharing
        </button>

        <button
          onClick={onTogglePitchMic}
          disabled={!isPresenter || !isPitchVoiceSupported || isPitchMicToggling}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
            innovationState.pitchMicEnabled
              ? "border-amber-300/50 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30"
              : "border-cyan-300/50 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30"
          }`}
        >
          {isPitchMicToggling ? "Connecting..." : innovationState.pitchMicEnabled ? "Mute Presenter Mic" : "Enable Presenter Mic"}
        </button>
      </div>

      <p className="mt-2 text-xs text-emerald-100/70">
        {speakerLabel ? `${speakerLabel} is speaking in pitch mode.` : "Pitch mode idle. Only presenter can speak."}
      </p>

      {pitchVoiceError ? <p className="mt-1 text-xs text-amber-200">{pitchVoiceError}</p> : null}

      <div className="mt-3 rounded-xl border border-emerald-300/35 bg-white p-2">
        <canvas
          ref={canvasRef}
          width={WHITEBOARD_BASE_WIDTH}
          height={WHITEBOARD_BASE_HEIGHT}
          className={`h-56 w-full rounded-lg border border-slate-200 ${canDraw ? "cursor-crosshair" : "cursor-default"}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            if (isDrawing) {
              finishDrawing();
            }
          }}
        />

        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
          <span>{canDraw ? "You can draw now" : "View-only while another presenter is active"}</span>
          <button
            onClick={onClearWhiteboard}
            disabled={!isPresenter}
            className="rounded border border-slate-300 px-2 py-1 font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>

      <section className="mt-3 min-h-0 rounded-xl border border-emerald-300/30 bg-emerald-900/20 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-100">Idea Voting</h3>

        <form onSubmit={handleIdeaSubmit} className="mt-2 flex gap-2">
          <input
            value={ideaInput}
            onChange={(event) => setIdeaInput(event.target.value)}
            placeholder="Add idea"
            className="min-w-0 flex-1 rounded-md border border-emerald-300/35 bg-black/10 px-2 py-1.5 text-xs text-emerald-50 outline-none placeholder:text-emerald-100/60 focus:border-emerald-200"
          />
          <button
            type="submit"
            className="rounded-md border border-emerald-300/45 bg-emerald-500/20 px-2.5 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/30"
          >
            Add
          </button>
        </form>

        <div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
          {sortedIdeas.length === 0 ? <p className="text-xs text-emerald-100/60">No ideas yet.</p> : null}

          {sortedIdeas.map((idea) => {
            const hasVoted = !!selfUserId && idea.voteUserIds.includes(selfUserId);
            const authorLabel = userDisplayNameById[idea.createdBy] || idea.createdBy;
            return (
              <div key={idea.id} className="rounded-lg border border-emerald-300/30 bg-black/10 px-2 py-1.5 text-xs text-emerald-50">
                <p>{idea.text}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] text-emerald-100/70">by {authorLabel}</span>
                  <button
                    onClick={() => onToggleIdeaVote(idea.id)}
                    className={`rounded border px-2 py-0.5 text-[11px] font-semibold transition ${
                      hasVoted
                        ? "border-amber-300/55 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30"
                        : "border-emerald-300/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
                    }`}
                  >
                    {hasVoted ? "Voted" : "Vote"} ({idea.voteCount})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
};
