/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Renderer
 */

import { MessageWriter, type ViridApp } from "@virid/core";
import { middleWare, convertFromMainMessage, ToMainMessage } from "./renderer";
import { type PluginOption } from "./interfaces";
export function activateApp(app: ViridApp, options: PluginOption) {
  // first, check if the preload script has been loaded
  if (!window.__VIRID_BRIDGE__) {
    MessageWriter.error(
      new Error(
        `[Virid Render] Preloading Failed: Please initialize in the preloaded script first.`,
      ),
    );
  }
  // check whether parameters are passed
  if (!options?.windowId) {
    MessageWriter.error(
      new Error(
        `[Virid Render] Activate Failed:\nPlease provide the windowId:${options?.windowId}.`,
      ),
    );
  }
  // register your own id, so that all messages sent to the main process will carry your own id in the future
  ToMainMessage.__virid_source = options.windowId;
  // actively send a registration message to the main process to register itself
  window.__VIRID_BRIDGE__.post({
    __virid_source: options.windowId,
    __virid_target: "main",
    __virid_messageType: "VIRID_INTERNAL_REGISTER",
    payload: {
      windowId: options.windowId,
    },
  });
  // Subscribe to the ipc channel, and convert all returned messages into our own message types according to the registry
  window.__VIRID_BRIDGE__.subscribe(convertFromMainMessage);
  // register your own middleware function to intercept messages of type ToMainMessage and forward them to the main process of electron
  app.useMiddleware(middleWare);
}
