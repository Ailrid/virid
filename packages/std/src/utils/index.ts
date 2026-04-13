import { activateNextTick } from "./nexttick";
import { activateGroupMessages } from "./message-group";
import { type ViridApp } from "@virid/core";
export function activateUtils(app: ViridApp) {
  activateNextTick(app)
  activateGroupMessages(app);
}

export * from "./message-group";
export * from "./nexttick";
