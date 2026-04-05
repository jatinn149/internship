import { useCallback, useEffect, useRef, useState } from "react";
import { Position } from "../types/user";
import { MOVEMENT_SPEED } from "../utils/constants";

interface UseMovementOptions {
  initialPosition: Position;
  worldWidth: number;
  worldHeight: number;
  speed?: number;
  onMove?: (position: Position) => void;
}

interface UseMovementResult {
  position: Position;
  setPosition: (nextPosition: Position) => void;
}

const MOVEMENT_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowleft",
  "arrowdown",
  "arrowright",
]);

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const isEditableElement = (element: EventTarget | null): boolean => {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const tag = element.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || element.isContentEditable;
};

export const useMovement = ({
  initialPosition,
  worldWidth,
  worldHeight,
  speed = MOVEMENT_SPEED,
  onMove,
}: UseMovementOptions): UseMovementResult => {
  const [position, setPositionState] = useState<Position>(initialPosition);
  const positionRef = useRef<Position>(initialPosition);
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const onMoveRef = useRef<typeof onMove>(onMove);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  const setPosition = useCallback((nextPosition: Position) => {
    positionRef.current = nextPosition;
    setPositionState(nextPosition);
  }, []);

  useEffect(() => {
    setPosition(initialPosition);
  }, [initialPosition, setPosition]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!MOVEMENT_KEYS.has(key)) {
        return;
      }

      if (isEditableElement(event.target) || isEditableElement(document.activeElement)) {
        pressedKeysRef.current.clear();
        return;
      }

      event.preventDefault();
      pressedKeysRef.current.add(key);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      pressedKeysRef.current.delete(event.key.toLowerCase());
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (isEditableElement(event.target)) {
        pressedKeysRef.current.clear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("focusin", handleFocusIn);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("focusin", handleFocusIn);
    };
  }, []);

  useEffect(() => {
    let frameId = 0;
    let previousTime = performance.now();

    const updateMovement = (currentTime: number) => {
      const deltaTime = (currentTime - previousTime) / 1000;
      previousTime = currentTime;

      const keys = pressedKeysRef.current;
      const vertical = Number(keys.has("s") || keys.has("arrowdown")) - Number(keys.has("w") || keys.has("arrowup"));
      const horizontal = Number(keys.has("d") || keys.has("arrowright")) - Number(keys.has("a") || keys.has("arrowleft"));

      if (vertical !== 0 || horizontal !== 0) {
        const magnitude = Math.hypot(horizontal, vertical) || 1;
        const normalizedX = horizontal / magnitude;
        const normalizedY = vertical / magnitude;

        const nextPosition: Position = {
          x: clamp(positionRef.current.x + normalizedX * speed * deltaTime, 0, worldWidth),
          y: clamp(positionRef.current.y + normalizedY * speed * deltaTime, 0, worldHeight),
        };

        positionRef.current = nextPosition;
        setPositionState(nextPosition);
        onMoveRef.current?.(nextPosition);
      }

      frameId = window.requestAnimationFrame(updateMovement);
    };

    frameId = window.requestAnimationFrame(updateMovement);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [speed, worldWidth, worldHeight]);

  return {
    position,
    setPosition,
  };
};
