/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Renderer
 */
import { type Middleware, MessageWriter } from "@virid/core";
import { ToMainMessage } from "./message";
export const middleWare: Middleware = (message, next) => {
  // If the message inherits from ToMainMessage, intercept concurrency to the main process
  if (message instanceof ToMainMessage) {
    const { __virid_target, __virid_messageType, ...payload } = message;
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
      payload: payload, // Expand all attributes on the instance
    });
  } else {
    next();
  }
};
