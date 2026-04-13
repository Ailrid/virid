/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Std
 */

import { type ViridApp } from "@virid/core";
import { activateUtils } from "./utils";
import { activateMessages } from "./messages";
let activeApp: ViridApp | null = null;

/**
 * 激活真正的 App 实例
 */
export function activateApp(app: ViridApp) {
  activateUtils(app);
  activateMessages(app);
  activeApp = app;
}

/**
 * viridApp 代理
 */
export const viridApp: ViridApp = new Proxy({} as ViridApp, {
  get(_, prop: keyof ViridApp) {
    return (...args: any[]) => {
      if (!activeApp) {
        console.warn(
          `[Virid Std] App method "${String(prop)}" called before initialization.`,
        );

        if (prop === "register") {
          return () => {
            console.warn(
              "[Virid Std] Cleanup ignored: source listener was never registered.",
            );
          };
        }
        return undefined;
      }
      const targetMethod = activeApp[prop];
      if (typeof targetMethod === "function") {
        return Reflect.apply(targetMethod, activeApp, args);
      }
    };
  },
});
