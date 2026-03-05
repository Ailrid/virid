/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Renderer
 */

import { MessageWriter, type ViridApp } from "@virid/core";
import { middleWare, convertFromMainMessage, ToMainMessage } from "./renderer";
import { type PluginOption } from "./interfaces";
export function activateApp(app: ViridApp, options: PluginOption) {
  // 先检查预加载脚本是否已经加载
  if (!window.__VIRID_BRIDGE__) {
    MessageWriter.error(
      new Error(
        `[Virid Render] Preloading Failed: Please initialize in the preloaded script first.`,
      ),
    );
  }
  // 检查参数是否传递
  if (!options?.windowId) {
    MessageWriter.error(
      new Error(
        `[Virid Render] Activate Failed:\nPlease provide the windowId:${options?.windowId}.`,
      ),
    );
  }
  //注册自己的id，以后所有发往主进程的消息都会携带自己的id
  ToMainMessage.__virid_source = options.windowId;
  //主动向主进程发一个注册消息来注册自己
  window.__VIRID_BRIDGE__.post({
    __virid_source: options.windowId,
    __virid_target: "main",
    __virid_messageType: "VIRID_INTERNAL_REGISTER",
    payload: {
      windowId: options.windowId,
    },
  });
  // 订阅ipc通道，所有返回的消息，全部转换按照注册表转换成自己的消息类型
  window.__VIRID_BRIDGE__.subscribe(convertFromMainMessage);
  //注册自己的中间件函数，把ToMainMessage类型的消息拦截发往electron主进程
  app.useMiddleware(middleWare);
}
