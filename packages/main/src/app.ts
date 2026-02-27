/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Electron Main
 */
const VIRID_CHANNEL = "VIRID_INTERNAL_BUS";
import { type ViridApp, MessageWriter } from "@virid/core";
import { BrowserWindow, ipcMain } from "electron";
import {
  middleWare,
  processMessage,
  PluginOption,
  ROUTER_MAP,
} from "./main";
export function activateApp(app: ViridApp, options: PluginOption) {
  //检查参数
  if (!options?.electronApp) {
    MessageWriter.error(
      new Error(
        `[Virid Main] Missing Initialization Parameters:\nelectronApp:${options?.electronApp}.`,
      ),
    );
  }
  //绑定electron主进程回调
  ipcMain.on(VIRID_CHANNEL, (event, message) => {
    const { __virid_target, __virid_source, __virid_messageType } = message;
    if (!__virid_target || !__virid_source || !__virid_messageType) {
      MessageWriter.error(
        new Error(
          `[Virid Main] Incomplete Message: The message is incomplete and requires __virid_target${__virid_target}, __virid_source${__virid_source}, __virid_messageType${__virid_messageType}`,
        ),
      );
      return;
    }
    // 如果是注册消息，那么注册这个渲染进程
    if (__virid_messageType === "VIRID_INTERNAL_REGISTER") {
      // 通过 event.sender 拿到物理实例，并与逻辑 ID 绑定
      const win = BrowserWindow.fromWebContents(event.sender);
      //找不见窗口，报错
      if (!win) {
        MessageWriter.error(
          new Error(
            `[Virid Main] unknown Window: Unable to find the window corresponding to event.sender`,
          ),
        );
        return;
      }
      //如果已经存在了，报错
      if (ROUTER_MAP.has(__virid_source)) {
        MessageWriter.error(
          new Error(
            `[Virid Main] Duplicate Registration: This ID has already been registered: ${__virid_source}`,
          ),
        );
        return;
      }
      // 存入路由表
      ROUTER_MAP.set(__virid_source, win);
      // 关闭时自动删除自己
      win.once("closed", () => {
        ROUTER_MAP.delete(__virid_source);
        MessageWriter.info(
          `[Virid Main] Window unregistered: ${__virid_source}`,
        );
      });
      MessageWriter.info(`[Virid Main] Window registered: ${__virid_source}`);
      return;
    }
    //分发消息
    processMessage(message);
  });
  //注册自己的中间件函数，把ToRenderMessage拦截发往指定的渲染进程
  app.useMiddleware(middleWare);
}
