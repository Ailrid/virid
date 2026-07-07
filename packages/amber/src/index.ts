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
import { BaseMessage, ViridPlugin, type ViridApp } from "@virid/core";
import { PluginOptions } from "./interfaces";
import {
  getAfterTickHooks,
  afterExecuteHooks,
  Amber,
  AmberTickStore,
  AmberComponentStore,
} from "./amber";
import { VIRID_AMBER_METADATA } from "./decorators/constant";
export * from "./amber";
export * from "./decorators";
export * from "./interfaces";

export class AmberPlugin implements ViridPlugin<PluginOptions> {
  name = "@virid/amber";
  install(app: ViridApp, options: PluginOptions) {
    const tickStore = new AmberTickStore(app, options);
    const amberComponentStore = new AmberComponentStore(app, options);
    const amber = new Amber(amberComponentStore, tickStore);
    const afterTickHooks = getAfterTickHooks(amberComponentStore, tickStore);
    //Register Hook
    app.onAfterTick(afterTickHooks, true);
    app.onAfterExecute(BaseMessage, afterExecuteHooks, true);

    const amberInitHook = (instance: any) => {
      if (
        instance &&
        Reflect.hasMetadata(VIRID_AMBER_METADATA.VERSION, instance.constructor)
      ) {
        //实例化的时候，init第一个版本
        amberComponentStore.initComponent(instance);
      }
      return instance;
    };
    app.onActivate(amberInitHook);
    app.spawn(amber);
  }
}
