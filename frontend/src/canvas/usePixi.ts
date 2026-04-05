import { useEffect, useRef, useState } from "react";
import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import { COSMOS_ROOMS } from "../utils/rooms";

interface UsePixiOptions {
  containerElement: HTMLDivElement | null;
  viewportWidth: number;
  viewportHeight: number;
  worldWidth: number;
  worldHeight: number;
  zoomLevel: number;
}

interface UsePixiResult {
  app: Application | null;
}

const ROOM_TITLE_STYLE = new TextStyle({
  fontFamily: "Space Grotesk, sans-serif",
  fontSize: 22,
  fontWeight: "700",
  fill: 0xe2e8f0,
});

const ROOM_SUBTITLE_STYLE = new TextStyle({
  fontFamily: "Space Grotesk, sans-serif",
  fontSize: 13,
  fontWeight: "500",
  fill: 0x94a3b8,
});

const drawOuterLandscape = (layer: Container, worldWidth: number, worldHeight: number): void => {
  const frame = new Graphics();
  frame.roundRect(0, 0, worldWidth, worldHeight, 26).fill({ color: 0x1c3a1f });
  frame.roundRect(42, 42, worldWidth - 84, worldHeight - 84, 20).fill({ color: 0x2b2635 });
  layer.addChild(frame);

  const hedges = new Graphics();
  const hedgeSpacing = 22;
  for (let x = 18; x < worldWidth - 14; x += hedgeSpacing) {
    hedges.circle(x, 20, 8).fill({ color: 0x2f6a32, alpha: 0.95 });
    hedges.circle(x, worldHeight - 20, 8).fill({ color: 0x2f6a32, alpha: 0.95 });
  }

  for (let y = 18; y < worldHeight - 14; y += hedgeSpacing) {
    hedges.circle(20, y, 8).fill({ color: 0x2f6a32, alpha: 0.95 });
    hedges.circle(worldWidth - 20, y, 8).fill({ color: 0x2f6a32, alpha: 0.95 });
  }
  layer.addChild(hedges);
};

const drawInteriorFloor = (layer: Container, worldWidth: number, worldHeight: number): void => {
  const floor = new Graphics();
  const x = 58;
  const y = 58;
  const width = worldWidth - 116;
  const height = worldHeight - 116;

  floor.roundRect(x, y, width, height, 18).fill({ color: 0xc4a77f, alpha: 0.96 });
  floor.roundRect(x, y, width, height, 18).stroke({ color: 0x8b6f4d, width: 3, alpha: 0.75 });

  for (let stripe = 0; stripe < height; stripe += 18) {
    floor
      .moveTo(x + 8, y + stripe)
      .lineTo(x + width - 8, y + stripe)
      .stroke({ color: 0x8e7658, width: 1, alpha: stripe % 36 === 0 ? 0.23 : 0.12 });
  }

  layer.addChild(floor);
};

const drawSharedCorridors = (layer: Container, worldWidth: number, worldHeight: number): void => {
  const corridor = new Graphics();
  const corridorWidth = 56;
  corridor
    .roundRect(worldWidth / 2 - corridorWidth / 2, 58, corridorWidth, worldHeight - 116, 12)
    .fill({ color: 0xe5d7bf, alpha: 0.95 });
  corridor
    .roundRect(58, worldHeight / 2 - corridorWidth / 2, worldWidth - 116, corridorWidth, 12)
    .fill({ color: 0xe5d7bf, alpha: 0.95 });

  corridor
    .roundRect(worldWidth / 2 - corridorWidth / 2, 58, corridorWidth, worldHeight - 116, 12)
    .stroke({ color: 0xb69c77, width: 2, alpha: 0.45 });
  corridor
    .roundRect(58, worldHeight / 2 - corridorWidth / 2, worldWidth - 116, corridorWidth, 12)
    .stroke({ color: 0xb69c77, width: 2, alpha: 0.45 });

  layer.addChild(corridor);
};

const drawDesks = (graphics: Graphics, x: number, y: number, columns: number, rows: number, color: number): void => {
  const deskWidth = 34;
  const deskHeight = 20;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const deskX = x + column * (deskWidth + 14);
      const deskY = y + row * (deskHeight + 10);
      graphics.roundRect(deskX, deskY, deskWidth, deskHeight, 5).fill({ color, alpha: 0.78 });
      graphics.roundRect(deskX + 8, deskY + 3, deskWidth - 16, 5, 2).fill({ color: 0xe2e8f0, alpha: 0.72 });
    }
  }
};

const drawRoomDetails = (roomLayer: Graphics, roomId: string, x: number, y: number, width: number, height: number): void => {
  if (roomId === "social-lounge") {
    drawDesks(roomLayer, x + 26, y + 78, 2, 2, 0x7b8aad);
    roomLayer.roundRect(x + width * 0.55, y + 88, 90, 28, 12).fill({ color: 0x6b7280, alpha: 0.8 });
    roomLayer.circle(x + width * 0.78, y + 128, 14).fill({ color: 0x334155, alpha: 0.9 });
    roomLayer.circle(x + width * 0.78, y + 128, 7).fill({ color: 0x94a3b8, alpha: 0.9 });
  }

  if (roomId === "innovation-hub") {
    drawDesks(roomLayer, x + 24, y + 80, 3, 3, 0x0f172a);
    roomLayer.roundRect(x + width * 0.62, y + 84, 92, 74, 10).fill({ color: 0x1f2937, alpha: 0.9 });
    roomLayer.roundRect(x + width * 0.65, y + 98, 30, 10, 3).fill({ color: 0x38bdf8, alpha: 0.75 });
    roomLayer.roundRect(x + width * 0.72, y + 98, 30, 10, 3).fill({ color: 0x22d3ee, alpha: 0.75 });
  }

  if (roomId === "game-arena") {
    roomLayer.roundRect(x + 30, y + 84, width - 60, 44, 12).fill({ color: 0x7f1d1d, alpha: 0.82 });
    roomLayer.roundRect(x + 45, y + 94, width - 90, 16, 6).fill({ color: 0xf97316, alpha: 0.7 });
    for (let row = 0; row < 4; row += 1) {
      for (let seat = 0; seat < 8; seat += 1) {
        roomLayer
          .roundRect(x + 34 + seat * 34, y + 146 + row * 18, 22, 10, 3)
          .fill({ color: 0xd4d4d8, alpha: 0.8 });
      }
    }
  }

  if (roomId === "zen-garden") {
    roomLayer.circle(x + width * 0.34, y + height * 0.52, 40).fill({ color: 0x164e63, alpha: 0.68 });
    roomLayer.circle(x + width * 0.34, y + height * 0.52, 24).fill({ color: 0x22d3ee, alpha: 0.5 });
    for (let pebble = 0; pebble < 18; pebble += 1) {
      const pebbleX = x + 58 + (pebble * 23) % (width - 90);
      const pebbleY = y + 86 + ((pebble * 41) % (height - 120));
      const radius = pebble % 3 === 0 ? 5 : 3.5;
      roomLayer.circle(pebbleX, pebbleY, radius).fill({ color: 0xcbd5e1, alpha: 0.55 });
    }
    roomLayer.roundRect(x + width * 0.62, y + 92, 92, 54, 8).fill({ color: 0x3f3f46, alpha: 0.8 });
  }
};

const createRoomMap = (worldWidth: number, worldHeight: number): Container => {
  const layer = new Container();

  drawOuterLandscape(layer, worldWidth, worldHeight);
  drawInteriorFloor(layer, worldWidth, worldHeight);
  drawSharedCorridors(layer, worldWidth, worldHeight);

  const zones = new Graphics();
  COSMOS_ROOMS.forEach((room, roomIndex) => {
    const x = room.bounds.x;
    const y = room.bounds.y;
    const width = room.bounds.width;
    const height = room.bounds.height;

    zones.roundRect(x, y, width, height, 16).fill({ color: room.fillColor, alpha: 0.22 });
    zones.roundRect(x, y, width, height, 16).stroke({ color: room.borderColor, width: 2, alpha: 0.82 });

    for (let stripe = 0; stripe < 6; stripe += 1) {
      const stripeY = y + 22 + stripe * 18;
      const stripeAlpha = 0.05 + (roomIndex % 2 === 0 ? stripe * 0.008 : stripe * 0.006);
      zones
        .moveTo(x + 16, stripeY)
        .lineTo(x + Math.max(width - 22 - stripe * 12, 30), stripeY)
        .stroke({ color: room.borderColor, width: 1, alpha: stripeAlpha });
    }

    drawRoomDetails(zones, room.id, x, y, width, height);
  });
  layer.addChild(zones);

  const centerBeacon = new Graphics();
  centerBeacon.roundRect(worldWidth / 2 - 30, worldHeight / 2 - 20, 60, 40, 10).fill({ color: 0x111827, alpha: 0.75 });
  centerBeacon.roundRect(worldWidth / 2 - 18, worldHeight / 2 - 8, 36, 16, 6).fill({ color: 0x0ea5e9, alpha: 0.65 });
  centerBeacon.roundRect(worldWidth / 2 - 30, worldHeight / 2 - 20, 60, 40, 10).stroke({ color: 0x93c5fd, width: 1.5, alpha: 0.6 });
  layer.addChild(centerBeacon);

  COSMOS_ROOMS.forEach((room) => {
    const title = new Text({ text: room.name, style: ROOM_TITLE_STYLE });
    title.position.set(room.bounds.x + 20, room.bounds.y + 18);
    layer.addChild(title);

    const subtitle = new Text({ text: room.accentName, style: ROOM_SUBTITLE_STYLE });
    subtitle.position.set(room.bounds.x + 22, room.bounds.y + 46);
    layer.addChild(subtitle);
  });

  return layer;
};

const createFallbackMap = (worldWidth: number, worldHeight: number): Container => {
  const layer = new Container();
  const background = new Graphics();
  background.roundRect(0, 0, worldWidth, worldHeight, 20).fill({ color: 0x0f172a, alpha: 1 });
  background
    .roundRect(24, 24, worldWidth - 48, worldHeight - 48, 16)
    .stroke({ color: 0x334155, width: 2, alpha: 0.85 });
  layer.addChild(background);

  const label = new Text({
    text: "Cosmos Map",
    style: new TextStyle({
      fontFamily: "Space Grotesk, sans-serif",
      fontSize: 28,
      fontWeight: "700",
      fill: 0xe2e8f0,
    }),
  });
  label.anchor.set(0.5);
  label.position.set(worldWidth / 2, worldHeight / 2);
  layer.addChild(label);

  return layer;
};

const resolveViewportSize = (
  application: Application,
  requestedWidth: number,
  requestedHeight: number
): { width: number; height: number } => {
  const parentElement = application.canvas.parentElement;
  const fallbackWidth = parentElement ? Math.floor(parentElement.clientWidth) : 0;
  const fallbackHeight = parentElement ? Math.floor(parentElement.clientHeight) : 0;

  return {
    width: Math.max(requestedWidth, fallbackWidth, 1),
    height: Math.max(requestedHeight, fallbackHeight, 1),
  };
};

const fitStageToViewport = (
  application: Application,
  viewportWidth: number,
  viewportHeight: number,
  worldWidth: number,
  worldHeight: number,
  zoomLevel: number
): void => {
  const resolvedViewport = resolveViewportSize(application, viewportWidth, viewportHeight);

  application.renderer.resize(resolvedViewport.width, resolvedViewport.height);

  const baseScale = Math.min(resolvedViewport.width / worldWidth, resolvedViewport.height / worldHeight);
  const scale = baseScale * zoomLevel;
  application.stage.scale.set(scale);
  application.stage.position.set(
    (resolvedViewport.width - worldWidth * scale) / 2,
    (resolvedViewport.height - worldHeight * scale) / 2
  );
};

export const usePixi = ({
  containerElement,
  viewportWidth,
  viewportHeight,
  worldWidth,
  worldHeight,
  zoomLevel,
}: UsePixiOptions): UsePixiResult => {
  const [app, setApp] = useState<Application | null>(null);
  const appRef = useRef<Application | null>(null);

  useEffect(() => {
    if (!containerElement) {
      return;
    }

    if (appRef.current) {
      return;
    }

    const application = new Application();
    let isDestroyed = false;

    const initialize = async () => {
      try {
        await application.init({
          width: Math.max(viewportWidth, 1),
          height: Math.max(viewportHeight, 1),
          antialias: true,
          autoDensity: true,
          resolution: window.devicePixelRatio || 1,
          preference: "webgl",
          backgroundAlpha: 0,
        });

        if (isDestroyed) {
          application.destroy(true);
          return;
        }

        let roomMap: Container;
        try {
          roomMap = createRoomMap(worldWidth, worldHeight);
        } catch (mapError) {
          console.error("Failed to create detailed room map. Falling back to basic map.", mapError);
          roomMap = createFallbackMap(worldWidth, worldHeight);
        }

        application.stage.addChild(roomMap);
        containerElement.appendChild(application.canvas);
        appRef.current = application;
        setApp(application);
        fitStageToViewport(application, viewportWidth, viewportHeight, worldWidth, worldHeight, zoomLevel);
      } catch (initError) {
        console.error("Failed to initialize Pixi application", initError);
      }
    };

    void initialize();

    return () => {
      isDestroyed = true;
      appRef.current = null;
      setApp(null);
      application.destroy(true, {
        children: true,
      });
    };
  }, [containerElement, worldWidth, worldHeight]);

  useEffect(() => {
    if (!app) {
      return;
    }

    fitStageToViewport(app, viewportWidth, viewportHeight, worldWidth, worldHeight, zoomLevel);
  }, [app, viewportWidth, viewportHeight, worldWidth, worldHeight, zoomLevel]);

  return { app };
};
