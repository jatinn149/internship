import { useEffect, useState, useRef } from "react";
import { CosmosUser } from "../types/user";
import { UserAvatar } from "./UserAvatar";
import { usePixi } from "./usePixi";

const MIN_ZOOM_LEVEL = 0.75;
const MAX_ZOOM_LEVEL = 2;
const ZOOM_STEP = 0.2;

const clampZoom = (value: number): number => {
  return Math.min(Math.max(value, MIN_ZOOM_LEVEL), MAX_ZOOM_LEVEL);
};

interface CosmosCanvasProps {
  users: CosmosUser[];
  selfUserId: string | null;
  worldWidth: number;
  worldHeight: number;
}

export const CosmosCanvas = ({ users, selfUserId, worldWidth, worldHeight }: CosmosCanvasProps) => {
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null);
  const avatarsRef = useRef<Map<string, UserAvatar>>(new Map());
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    const element = containerElement;
    if (!element) {
      return;
    }

    const updateViewport = () => {
      const rect = element.getBoundingClientRect();
      const nextWidth = Math.max(Math.floor(rect.width), 1);
      const nextHeight = Math.max(Math.floor(rect.height), 1);
      setViewport((previous) => {
        if (previous.width === nextWidth && previous.height === nextHeight) {
          return previous;
        }

        return { width: nextWidth, height: nextHeight };
      });
    };

    updateViewport();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateViewport);
      return () => {
        window.removeEventListener("resize", updateViewport);
      };
    }

    const observer = new ResizeObserver(() => {
      updateViewport();
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [containerElement]);

  const { app } = usePixi({
    containerElement,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    worldWidth,
    worldHeight,
    zoomLevel,
  });

  useEffect(() => {
    if (!app) {
      return;
    }

    const animate = () => {
      avatarsRef.current.forEach((avatar) => {
        avatar.animate();
      });
    };

    app.ticker.add(animate);

    return () => {
      app.ticker.remove(animate);
    };
  }, [app]);

  useEffect(() => {
    if (!app) {
      return;
    }

    const activeUserIds = new Set(users.map((user) => user.id));

    avatarsRef.current.forEach((avatar, userId) => {
      if (activeUserIds.has(userId)) {
        return;
      }

      app.stage.removeChild(avatar.container);
      avatar.destroy();
      avatarsRef.current.delete(userId);
    });

    users.forEach((user) => {
      const isSelf = user.id === selfUserId;
      let avatar = avatarsRef.current.get(user.id);

      if (!avatar) {
        avatar = new UserAvatar(user.id, user.displayName, user.avatar, isSelf, { x: user.x, y: user.y });
        avatarsRef.current.set(user.id, avatar);
        app.stage.addChild(avatar.container);
      }

      avatar.syncIdentity(user.displayName, user.avatar, isSelf);
      avatar.setTargetPosition(user.x, user.y);
    });
  }, [app, users, selfUserId]);

  useEffect(() => {
    return () => {
      avatarsRef.current.forEach((avatar) => avatar.destroy());
      avatarsRef.current.clear();
    };
  }, []);

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-2xl border border-cosmos-700/60 shadow-panel">
      <div ref={setContainerElement} className="h-full w-full" />

      <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-lg border border-cosmos-700/70 bg-cosmos-900/80 p-1.5 shadow-panel">
        <button
          type="button"
          onClick={() => setZoomLevel((current) => clampZoom(current - ZOOM_STEP))}
          className="pointer-events-auto h-8 w-8 rounded-md border border-cosmos-700/70 bg-cosmos-800/70 text-base font-bold text-slate-100 transition hover:border-cosmos-400"
          aria-label="Zoom out map"
        >
          -
        </button>

        <button
          type="button"
          onClick={() => setZoomLevel(1)}
          className="pointer-events-auto min-w-14 rounded-md border border-cosmos-700/70 bg-cosmos-800/70 px-2 py-1 text-xs font-semibold text-slate-200 transition hover:border-cosmos-400"
          aria-label="Reset map zoom"
        >
          {Math.round(zoomLevel * 100)}%
        </button>

        <button
          type="button"
          onClick={() => setZoomLevel((current) => clampZoom(current + ZOOM_STEP))}
          className="pointer-events-auto h-8 w-8 rounded-md border border-cosmos-700/70 bg-cosmos-800/70 text-base font-bold text-slate-100 transition hover:border-cosmos-400"
          aria-label="Zoom in map"
        >
          +
        </button>
      </div>
    </div>
  );
};
