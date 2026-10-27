/*
 * Copyright (c) 2026-present Ailrid
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Description: WebSocket plugin for virid, managing multiple connections through a global pool and message-driven architecture.
 */
import {
  MessageWriter,
  Newable,
  ViridPlugin,
  type ViridApp,
} from "@virid/core";
import { type WebSocketPluginOption } from "./interfaces";
import { FromWebSocketMessage } from "./websocket";
import { VIRID_WEBSOCKET_METADATA } from "./websocket/constant";
import { createWebSocketMiddleware } from "./websocket/middleware";
import { WebSocketPool } from "./websocket/pool";

export * from "./interfaces";
export * from "./websocket";

export class WebSocketPlugin implements ViridPlugin<WebSocketPluginOption> {
  name = "@virid/websocket";
  public message_map = new Map<string, Newable<FromWebSocketMessage>>();
  private pool!: WebSocketPool;

  install(app: ViridApp, options: WebSocketPluginOption) {
    const reconnectInterval = options?.reconnectInterval || 3000;

    // Initialize the global websocket pool with a data receiving callback
    this.pool = new WebSocketPool(reconnectInterval, (url, rawData) => {
      this.handleIncomingData(url, rawData);
    });

    // Register middleware to intercept BootstrapSocketMessage and ToWebSocketMessage
    app.useMiddleware(createWebSocketMiddleware(this.pool));
  }

  private handleIncomingData(url: string, rawdata: string): void {
    try {
      const packet = JSON.parse(rawdata);
      const { type, payload } = packet;

      if (!type || !this.message_map.has(type)) {
        return;
      }

      const MessageClass = this.message_map.get(type)!;
      const instance = new MessageClass();
      instance.__virid_message_type = type;
      instance.__virid_websocket_url = url;

      if (payload) {
        Object.assign(instance, payload);
      }

      MessageWriter.write(instance);
    } catch (e) {
      MessageWriter.error(
        new Error(`[Virid WebSocket] Failed to parse incoming packet: ${e}`),
      );
    }
  }

  bindRoute(target: Newable<FromWebSocketMessage>) {
    const route = Reflect.getMetadata(VIRID_WEBSOCKET_METADATA.FROM_WS, target);
    if (this.message_map.has(route)) {
      MessageWriter.error(
        new Error(
          `[Virid WebSocket] Duplicate WebSocket Message: Registration for route: ${route}, message class: ${target}`,
        ),
      );
    }
    this.message_map.set(route, target);
  }

  public close() {
    if (this.pool) {
      this.pool.closeAll();
    }
  }
}
