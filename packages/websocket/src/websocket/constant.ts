/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid WebSocket
 */
import { VIRID_METADATA } from "@virid/core";

export const VIRID_WEBSOCKET_METADATA = {
  ...VIRID_METADATA,
  FROM_WS: "virid:websocket:fromws",
} as const;
