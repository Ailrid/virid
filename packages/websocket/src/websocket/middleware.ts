/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid WebSocket
 */
import { type Middleware, MessageWriter } from "@virid/core";
import {
  ToWebSocketMessage,
  ConnectWebSocketMessage,
  DisconnectWebMessage,
} from "./message";
import { WebSocketPool } from "./pool";

export const createWebSocketMiddleware = (pool: WebSocketPool): Middleware => {
  return (message, next) => {
    // Handle bootstrap connection request
    if (message instanceof ConnectWebSocketMessage) {
      const url = message.__virid_websocket_url;
      if (url) {
        pool.getOrCreate(url);
      } else {
        MessageWriter.error(
          new Error(
            `[Virid WebSocket] Failed to connect: __virid_websocket_url is missing.`,
          ),
        );
      }
      return;
    }
    if (message instanceof DisconnectWebMessage) {
      const url = message.__virid_websocket_url;
      if (url) {
        pool.close(url);
      } else {
        MessageWriter.error(
          new Error(
            `[Virid WebSocket] Failed to Disconnect: __virid_websocket_url is missing.`,
          ),
        );
      }
      return;
    }

    // Handle data message sent to the WebSocket server
    if (message instanceof ToWebSocketMessage) {
      const url = message.__virid_websocket_url;
      const type = message.__virid_message_type;

      if (!url) {
        MessageWriter.error(
          new Error(
            `[Virid WebSocket] Failed to send message: __virid_websocket_url is missing.`,
          ),
        );
        return;
      }

      if (!type) {
        MessageWriter.error(
          new Error(
            `[Virid WebSocket] Failed to send message: __virid_message_type is missing.`,
          ),
        );
        return;
      }

      const { __virid_websocket_url, __virid_message_type, ...payload } =
        message;

      const packet = JSON.stringify({
        type: type,
        payload: payload,
      });

      pool.send(url, packet);
      return;
    }

    // For other messages, pass through to the next middleware or dispatcher
    next();
  };
};
