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
 * Description: Electron application preloading script.
 */
import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
const VIRID_CHANNEL = "VIRID_INTERNAL_BUS";

export function injectViridBridge() {
  contextBridge.exposeInMainWorld("__VIRID_BRIDGE__", {
    post: (packet: any) => {
      ipcRenderer.send(VIRID_CHANNEL, packet);
    },

    subscribe: (callback: (packet: any) => void) => {
      const subscription = (_event: IpcRendererEvent, packet: any) => {
        callback(packet);
      };
      ipcRenderer.on(VIRID_CHANNEL, subscription);
      return () => {
        ipcRenderer.removeListener(VIRID_CHANNEL, subscription);
      };
    },
  });
}
