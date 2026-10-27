/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid WebSocket
 */
import { Newable } from "@virid/core";
import { type FromWebSocketMessage } from "./message";
import { VIRID_WEBSOCKET_METADATA } from "./constant";

export function FromWebSocket(type: string) {
  return function (target: Newable<FromWebSocketMessage>) {
    Reflect.defineMetadata(VIRID_WEBSOCKET_METADATA.FROM_WS, type, target);
  };
}
