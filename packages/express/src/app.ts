/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Express
 */
import { type ViridApp, MessageWriter } from "@virid/core";
import { type PluginOptions } from "./http";

import { registerHttpSystem, registerHttpRoute } from "./decorators/register";

export interface IViridApp {
  get(identifier: any): any;
}

let activeApp: IViridApp | null = null;

export function activateApp(app: ViridApp, options: PluginOptions) {
  //看看用户提供的配置
  activeApp = app;
  // 注册http相关的系统
  registerHttpSystem(app);
  //初始化express的路由
  registerHttpRoute(options.server);
}

/**
 * viridApp 代理
 */
export const viridApp: IViridApp = new Proxy({} as IViridApp, {
  get(_, prop: keyof IViridApp) {
    return (...args: any[]) => {
      // 检查实例是否存在
      if (!activeApp) {
        MessageWriter.warn(
          `[Virid Vue] App method "${String(prop)}" called before initialization.`,
        );
        return null;
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
