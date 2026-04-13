import { type ViridApp } from "@virid/core";
import { activateAsyncQueue } from "./async";
import { activateDeTh } from "./deth";
export * from "./async";
export * from "./deth";

export function activateMessages(app: ViridApp) {
  activateAsyncQueue(app);
  activateDeTh(app);
}
