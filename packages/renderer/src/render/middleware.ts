/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Renderer
 */
import { type Middleware, MessageWriter } from "@virid/core";
import { ToMainMessage } from "./message";
export const middleWare: Middleware = (message, next) => {
  //如果消息继承自ToMainMessage，拦截并发往主进程
  if (message instanceof ToMainMessage) {
    const { __virid_target, __virid_messageType, ...payload } = message;
    //禁止发给自己
    if (__virid_target == ToMainMessage.__virid_source) {
      MessageWriter.warn(
        `[Virid Render] Prohibit Sending To Oneself: ${__virid_target} is not allowed in ToRenderMessage.`,
      );
      return;
    }
    window.__VIRID_BRIDGE__.post({
      __virid_source: ToMainMessage.__virid_source,
      __virid_target: __virid_target,
      __virid_messageType: __virid_messageType,
      payload: payload, // 展开实例上的所有属性
    });
  } else {
    next();
  }
};
