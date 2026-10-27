/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid WebSocket
 */
import { EventMessage } from "@virid/core";

export abstract class FromWebSocketMessage extends EventMessage {
  public __virid_source: string = "websocket";
  public __virid_message_type: string = "";
  public abstract __virid_websocket_url: string;
}

export abstract class ToWebSocketMessage extends EventMessage {
  public abstract __virid_websocket_url: string;
  public abstract __virid_message_type: string;
}

export class ConnectWebSocketMessage extends EventMessage {
  constructor(public __virid_websocket_url: string) {
    super();
  }
}

export class DisconnectWebMessage extends EventMessage {
  constructor(public __virid_websocket_url: string) {
    super();
  }
}
