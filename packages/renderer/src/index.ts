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
import { ViridPlugin, type ViridApp } from "@virid/core";
export { ToMainMessage, FromMainMessage } from "./renderer";
export * from "./interfaces";
export * from "./renderer";
import { activateApp } from "./app";
import { type PluginOption } from "./interfaces";
export const RenderPlugin: ViridPlugin<PluginOption> = {
  name: "@virid/render",
  install(app: ViridApp, options) {
    activateApp(app, options);
  },
};
