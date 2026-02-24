/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Vue
 */
import { type ViridApp } from "@virid/core";
import { bindResponsive } from "./adapters/bind";
export interface IViridApp {
  register(
    eventClass: any,
    systemFn: (...args: any[]) => any,
    priority: number,
  ): () => void;
  get(identifier: any): any;
  bindComponent<T>(identifier: new (...args: any[]) => T);
}

let activeApp: IViridApp | null = null;

/**
 * 激活真正的 App 实例
 */
export function activateApp(app: ViridApp) {
  const bindResponsiveHook = (_context, instance) => {
    if (instance) {
      bindResponsive(instance);
    }
  };
  app.addActivationHook(bindResponsiveHook);
  activeApp = app;
}

/**
 * viridApp 代理
 */
export const viridApp: IViridApp = new Proxy({} as IViridApp, {
  get(_, prop: keyof IViridApp) {
    return (...args: any[]) => {
      // 检查实例是否存在
      if (!activeApp) {
        console.warn(
          `[Virid Vue] App method "${String(prop)}" called before initialization.`,
        );

        // 针对 register 这种有返回值的函数做特殊处理
        if (prop === "register") {
          return () => {
            console.warn(
              "[Virid Vue] Cleanup ignored: source listener was never registered.",
            );
          };
        }
        return undefined;
      }

      // 正常转发调用
      // 使用 Reflect 确保 this 指向正确，或者直接从 activeApp 调用
      const targetMethod = activeApp[prop];
      if (typeof targetMethod === "function") {
        // @ts-ignore
        return targetMethod.apply(activeApp, args);
      }
    };
  },
});
