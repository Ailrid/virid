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
 * Description: Electron main process adapter for Virid, responsible for sending, receiving, and broadcasting rendering process messages.
 */
const VIRID_CHANNEL = "VIRID_INTERNAL_BUS";
import {
  BaseMessage,
  MessageWriter,
  Newable,
  ViridPlugin,
  type ViridApp,
} from "@virid/core";
import { type PluginOption } from "./interfaces";
import { BrowserWindow, ipcMain } from "electron";
import { FromRendererMessage, ToRendererMessage } from "./main";
import { VIRID_MAIN_METADATA } from "./main/constant";

export * from "./main";
export * from "./interfaces";

export class MainPlugin implements ViridPlugin<PluginOption> {
  name = "@virid/main";
  public message_map = new Map<string, Newable<FromRendererMessage>>();
  public route_map = new Map<string, BrowserWindow>();
  install(app: ViridApp, options: PluginOption) {
    //Check parameters
    if (!options?.electronApp) {
      MessageWriter.error(
        new Error(
          `[Virid Main] Missing Initialization Parameters: electronApp:${options?.electronApp}.`,
        ),
      );
      return;
    }
    //Bind Electron main process callback
    ipcMain.on(VIRID_CHANNEL, (event, message) => {
      const { __virid_target, __virid_source, __virid_message_type } = message;
      if (!__virid_target || !__virid_source || !__virid_message_type) {
        MessageWriter.error(
          new Error(
            `[Virid Main] Incomplete Message: The message is incomplete and requires __virid_target${__virid_target}, __virid_source${__virid_source}, __virid_message_type${__virid_message_type}`,
          ),
        );
        return;
      }
      // If it is a registration message, then register this rendering process
      if (__virid_message_type === "VIRID_INTERNAL_REGISTER") {
        // Obtain the physical instance through event.sender and bind it with the logical ID
        const win = BrowserWindow.fromWebContents(event.sender);
        //Unable to find window, error reported
        if (!win) {
          MessageWriter.error(
            new Error(
              `[Virid Main] unknown Window: Unable to find the window corresponding to event.sender`,
            ),
          );
          return;
        }
        //If it already exists, report an error
        if (this.route_map.has(__virid_source)) {
          MessageWriter.error(
            new Error(
              `[Virid Main] Duplicate Registration: This ID has already been registered: ${__virid_source}`,
            ),
          );
          return;
        }
        // Store in routing table
        this.route_map.set(__virid_source, win);
        // Automatically delete oneself when closed
        win.once("closed", () => {
          this.route_map.delete(__virid_source);
          MessageWriter.info(
            `[Virid Main] Window unregistered: ${__virid_source}`,
          );
        });
        MessageWriter.info(`[Virid Main] Window registered: ${__virid_source}`);
        return;
      }
      //Distribute messages
      this.processMessage(message);
    });
    //Register your own middleware function to intercept ToRenderMessage and send it to the specified rendering process
    app.useMiddleware(this.middleWare.bind(this));
  }
  bindRoute(target: Newable<FromRendererMessage>) {
    const route = Reflect.getMetadata(VIRID_MAIN_METADATA.FROMRENDERER, target);
    if (this.message_map.has(route)) {
      MessageWriter.error(
        new Error(
          `[Virid Main] Duplicate IpcMessage: Registration for route: ${route}, message class: ${target}`,
        ),
      );
    }
    this.message_map.set(route, target);
  }
  middleWare(message: BaseMessage, next: () => void) {
    //If the message is inherited from MainRequestMessage, intercept and send it to the corresponding rendering process
    if (message instanceof ToRendererMessage) {
      const { __virid_target, __virid_message_type, ...payload } = message;
      //Don't send it to yourself
      if (__virid_target == "main") {
        MessageWriter.warn(
          `[Virid Main] Prohibit Sending To Oneself: ${__virid_target} is not allowed in ToRendererMessage.`,
        );
        return;
      }
      const packet = {
        __virid_source: ToRendererMessage.__virid_source,
        __virid_target,
        __virid_message_type,
        payload,
      };

      const targetWindows =
        __virid_target === "*" || __virid_target === "all"
          ? Array.from(this.route_map.values())
          : [this.route_map.get(__virid_target)].filter(Boolean);

      if (targetWindows.length > 0) {
        targetWindows.forEach((win) =>
          win!.webContents.send(VIRID_CHANNEL, packet),
        );
      } else {
        MessageWriter.error(
          new Error(
            `[Virid Main] No Window Found: Message target ${__virid_target} cannot be found.`,
          ),
        );
        return;
      }
    } else {
      next();
    }
  }

  // The main process receives the message and sends it to its own system
  receiveMessages(message: any): void {
    const { __virid_source, __virid_message_type, __virid_target, payload } =
      message;
    if (!this.message_map.has(__virid_message_type)) {
      // The main process did not register this message and reported an error directly
      MessageWriter.error(
        new Error(
          `[Virid Main] unknown Message Type: Cannot find ${__virid_message_type} in the main process registry.`,
        ),
      );
      return;
    }
    // Search for message classes registered by the main process
    const MessageClass = this.message_map.get(__virid_message_type);
    const instance = new (MessageClass as any)();
    if (payload) {
      Object.assign(instance, payload);
    }
    // Inject identity metadata
    instance.__virid_source = __virid_source;
    instance.__virid_target = __virid_target;
    instance.__virid_message_type = __virid_message_type;
    // Inject context
    const context = this.route_map.get(__virid_source);
    if (context) {
      instance.senderWindow = context;
    }

    // System group assigned to the main process
    MessageWriter.write(instance);
  }

  transmitMessages(message: any): void {
    const { __virid_source, __virid_message_type, __virid_target, payload } =
      message;
    // Search for message classes registered by the main process
    const targetWindow = this.route_map.get(__virid_target);
    if (!targetWindow) {
      // The main process did not register this message and reported an error directly
      MessageWriter.error(
        new Error(
          `[Virid Main] unknown Window: Cannot find ${__virid_target} in the windows registry.`,
        ),
      );
      return;
    }
    targetWindow.webContents.send(VIRID_CHANNEL, {
      __virid_source,
      __virid_message_type,
      __virid_target,
      payload,
    });
  }
  broadcastMessage(message: any) {
    const { __virid_source, __virid_message_type, __virid_target, payload } =
      message;
    this.route_map.forEach((window: BrowserWindow) => {
      window.webContents.send(VIRID_CHANNEL, {
        __virid_source,
        __virid_message_type,
        __virid_target,
        payload,
      });
    });
  }

  processMessage(message: any) {
    const { __virid_target, __virid_source, __virid_message_type } = message;
    if (__virid_target === "main") return this.receiveMessages(message);
    else if (__virid_target === "all" || __virid_target === "*")
      return this.broadcastMessage(message);
    else return this.transmitMessages(message);
  }
}
