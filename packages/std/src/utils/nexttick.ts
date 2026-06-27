import { type ViridApp } from "@virid/core";

let tickTaskQueue: Array<() => void> = [];

function afterTickHook() {
  if (tickTaskQueue.length == 0) return;
  for (const task of tickTaskQueue) {
    task();
  }
  tickTaskQueue = [];
}

export function nextTick(task: () => void) {
  tickTaskQueue.push(task);
}

export function activateNextTick(app: ViridApp) {
  app.onAfterTick(afterTickHook);
}
