"use client";

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

let currentTime = Date.now();

let timer: ReturnType<typeof setInterval> | null = null;

function startTimer() {
  if (timer) {
    return;
  }

  timer = setInterval(() => {
    currentTime = Date.now();

    for (const listener of listeners) {
      listener();
    }
  }, 30_000);
}

function stopTimer() {
  if (listeners.size === 0 && timer) {
    clearInterval(timer);

    timer = null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  startTimer();

  return () => {
    listeners.delete(listener);

    stopTimer();
  };
}

function getSnapshot() {
  return currentTime;
}

function getServerSnapshot() {
  return 0;
}

export function useCurrentTime() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
