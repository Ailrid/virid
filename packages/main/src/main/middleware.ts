/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Main
 */
import { type Middleware, MessageWriter } from "@virid/core";
import { ToRendererMessage } from "./message";
import { ROUTER_MAP, VIRID_CHANNEL } from "./router";
export const middleWare: Middleware = (message, next) => {
  //If the message is inherited from MainRequestMessage, intercept and send it to the corresponding rendering process
  if (message instanceof ToRendererMessage) {
    const { __virid_target, __virid_messageType, ...payload } = message;
    //Don't send it to yourself
    if (__virid_target == "main") {
      MessageWriter.warn(
        `[Virid Main] Prohibit Sending To Oneself: ${__virid_target} is not allowed in ToRendererMessage.`,
      );
    }
    // 准备要发送的数据包
    const packet = {
      __virid_source: ToRendererMessage.__virid_source,
      __virid_target,
      __virid_messageType,
      payload,
    };

    const targetWindows =
      __virid_target === "*" || __virid_target === "all"
        ? Array.from(ROUTER_MAP.values())
        : [ROUTER_MAP.get(__virid_target)].filter(Boolean);

    if (targetWindows.length > 0) {
      targetWindows.forEach((win) =>
        win!.webContents.send(VIRID_CHANNEL, packet),
      );
    } else {
      MessageWriter.error(
        new Error(
          `[Virid Main] No Window Found: Message target ${__virid_target} cannot be found.`,
        ),
      );
    }
  } else {
    next();
  }
};
