/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Renderer
 */
import { MessageWriter, Newable } from "@virid/core";
import { type FromMainMessage } from "./message";
const MESSAGE_MAP = new Map<string, Newable<FromMainMessage>>();

export function FromMain(type: string) {
  return function (target: Newable<FromMainMessage>) {
    if (MESSAGE_MAP.has(type)) {
      MessageWriter.error(
        new Error(
          `[Virid Main] Duplicate IpcMessage: Registration for type: ${type}`,
        ),
      );
    }
    MESSAGE_MAP.set(type, target);
  };
}
export function convertFromMainMessage(ipcMessage: any): void {
  const { __virid_source, __virid_target, __virid_messageType, payload } =
    ipcMessage;
  if (!__virid_messageType || !__virid_source || !__virid_target) {
    MessageWriter.error(
      new Error(
        `[Virid Render] Incomplete Data:\n__virid_source: ${__virid_source}\n__virid_target:${__virid_target}\n__virid_messageType: ${__virid_messageType}.`,
      ),
    );
    return;
  }
  if (!MESSAGE_MAP.has(__virid_messageType)) {
    MessageWriter.error(
      new Error(`[Virid Render] Unregistered type: ${__virid_messageType} `),
    );
    return;
  }
  // Find the corresponding constructor
  const MessageClass = MESSAGE_MAP.get(__virid_messageType)!;
  // Instantiate and inject parameters
  const instance = new MessageClass();

  // Explicitly assigning base class identifiers to ensure complete identity information of instances
  instance.__virid_source = __virid_source;
  instance.__virid_target = __virid_target;
  instance.__virid_messageType = __virid_messageType;

  // Restore data
  if (payload) {
    Object.assign(instance, payload);
  }

  // Redistribution
  MessageWriter.write(instance);
}
