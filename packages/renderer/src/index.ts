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
 * Description: Electron renderer process adapter for virid, responsible for forwarding and receiving messages from the main process.
 */
import {
  MessageWriter,
  Newable,
  ViridPlugin,
  type ViridApp,
} from "@virid/core";
import { type PluginOption } from "./interfaces";
import { FromMainMessage } from "./renderer";
import { middleWare, ToMainMessage } from "./renderer";
import { VIRID_RENDERER_METADATA } from "./renderer/constant";

export * from "./interfaces";
export * from "./renderer";

export class RendererPlugin implements ViridPlugin<PluginOption> {
  name = "@virid/renderer";
  public message_map = new Map<string, Newable<FromMainMessage>>();

  install(app: ViridApp, options: PluginOption) {
    // first, check if the preload script has been loaded
    if (!window.__VIRID_BRIDGE__) {
      MessageWriter.error(
        new Error(
          `[Virid Render] Preloading Failed: Please initialize in the preloaded script first.`,
        ),
      );
      return;
    }
    // check whether parameters are passed
    if (!options.windowId) {
      MessageWriter.error(
        new Error(
          `[Virid Render] Activate Failed: Please provide the windowId:${options?.windowId}.`,
        ),
      );
      return;
    }
    // register your own id, so that all messages sent to the main process will carry your own id in the future
    ToMainMessage.__virid_source = options.windowId;
    // Subscribe to the ipc channel, and convert all returned messages into our own message types according to the registry
    window.__VIRID_BRIDGE__.subscribe(this.convertFromMainMessage.bind(this));
    // actively send a registration message to the main process to register itself
    window.__VIRID_BRIDGE__.post({
      __virid_source: options.windowId,
      __virid_target: "main",
      __virid_message_type: "VIRID_INTERNAL_REGISTER",
      payload: {
        windowId: options.windowId,
      },
    });
    // register your own middleware function to intercept messages of type ToMainMessage and forward them to the main process of electron
    app.useMiddleware(middleWare);
  }
  bindRoute(target: Newable<FromMainMessage>) {
    const route = Reflect.getMetadata(VIRID_RENDERER_METADATA.FROMMAIN, target);
    if (this.message_map.has(route)) {
      MessageWriter.error(
        new Error(
          `[Virid Renderer] Duplicate IpcMessage: Registration for route: ${route}, message class: ${target}`,
        ),
      );
    }
    this.message_map.set(route, target);
  }

  convertFromMainMessage(ipcMessage: any): void {
    const { __virid_source, __virid_target, __virid_message_type, payload } =
      ipcMessage;
    if (!__virid_message_type || !__virid_source || !__virid_target) {
      MessageWriter.error(
        new Error(
          `[Virid Render] Incomplete Data:\n__virid_source: ${__virid_source}\n__virid_target:${__virid_target}\n__virid_message_type: ${__virid_message_type}.`,
        ),
      );
      return;
    }
    if (!this.message_map.has(__virid_message_type)) {
      MessageWriter.error(
        new Error(`[Virid Render] Unregistered type: ${__virid_message_type} `),
      );
      return;
    }
    // Find the corresponding constructor
    const MessageClass = this.message_map.get(__virid_message_type)!;
    // Instantiate and inject parameters
    const instance = new MessageClass();

    // Explicitly assigning base class identifiers to ensure complete identity information of instances
    instance.__virid_source = __virid_source;
    instance.__virid_target = __virid_target;
    instance.__virid_message_type = __virid_message_type;

    // Restore data
    if (payload) {
      Object.assign(instance, payload);
    }

    // Redistribution
    MessageWriter.write(instance);
  }
}
