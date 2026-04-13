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
 * Description: The virid standard library provides commonly used features in development.
 */
import { ViridPlugin, type ViridApp } from "@virid/core";
export * from "./utils";
export * from "./messages";
import { activateApp } from "./app";
export const StdPlugin: ViridPlugin = {
  name: "@virid/std",
  install(app: ViridApp, _options) {
    activateApp(app);
  },
};
