/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Vue
 */
import { type ViridApp, Newable } from "@virid/core";
import { bindResponsive } from "./adapters/bind";
export interface IViridApp {
  register(systemFn: (...args: any[]) => any): () => void;
  get(identifier: any): any;
  bind<T>(identifier: Newable<T>): void;
}

let activeApp: IViridApp | null = null;

export function activateApp(app: ViridApp) {
  const bindResponsiveHook = (instance: any) => {
    if (instance) {
      bindResponsive(instance);
    }
    return instance;
  };
  app.onActivate(bindResponsiveHook);
  activeApp = app;
}

export const viridApp: IViridApp = new Proxy({} as IViridApp, {
  get(_, prop: keyof IViridApp) {
    return (...args: any[]) => {
      if (!activeApp) {
        console.warn(
          `[Virid Vue] App method "${String(prop)}" called before initialization.`,
        );

        if (prop === "register") {
          return () => {
            console.warn(
              "[Virid Vue] Cleanup ignored: source listener was never registered.",
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
