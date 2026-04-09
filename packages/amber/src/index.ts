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
 * Description: Add replay, redo, undo and other functions to virid.
 */
import { ViridPlugin, type ViridApp } from "@virid/core";
import { activateApp } from "./app";
import { PluginOptions } from "./interfaces";
export * from "./amber";
export * from "./decorators";
export * from "./interfaces";
export const AmberPlugin: ViridPlugin<PluginOptions> = {
  name: "@virid/amber",
  install(app: ViridApp, options) {
    activateApp(app, options);
  },
};
