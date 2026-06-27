/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Main
 */
import { MessageWriter, type Newable } from "@virid/core";
import { type BrowserWindow } from "electron";
import { type FromRendererMessage } from "./message";
export const VIRID_CHANNEL = "VIRID_INTERNAL_BUS";
export const ROUTER_MAP = new Map<string, BrowserWindow>();
const MESSAGE_MAP = new Map<string, Newable<FromRendererMessage>>();

export function FromRenderer(type: string) {
  return function (target: Newable<FromRendererMessage>) {
    if (MESSAGE_MAP.has(type)) {
      MessageWriter.warn(
        `[Virid Main] Duplicate IpcMessage: Registration for type: ${type}`,
      );
    }
    MESSAGE_MAP.set(type, target);
  };
}
//主进程接收消息并发给自己的system
function ReceiveMessages(message: any): void {
  const { __virid_source, __virid_messageType, __virid_target, payload } =
    message;
  if (!MESSAGE_MAP.has(__virid_messageType)) {
    // The main process did not register this message and reported an error directly
    MessageWriter.error(
      new Error(
        `[Virid Main] unknown Message Type: Cannot find ${__virid_messageType} in the main process registry.`,
      ),
    );
    return;
  }
  // Search for message classes registered by the main process
  const MessageClass = MESSAGE_MAP.get(__virid_messageType);
  const instance = new (MessageClass as any)();
  if (payload) {
    Object.assign(instance, payload);
  }
  // Inject identity metadata
  instance.__virid_source = __virid_source;
  instance.__virid_target = __virid_target;
  instance.__virid_messageType = __virid_messageType;
  // Inject context
  const context = ROUTER_MAP.get(__virid_source);
  if (context) {
    instance.senderWindow = context;
  }

  // System group assigned to the main process
  MessageWriter.write(instance);
}

function TransmitMessages(message: any): void {
  const { __virid_source, __virid_messageType, __virid_target, payload } =
    message;
  // Search for message classes registered by the main process
  const targetWindow = ROUTER_MAP.get(__virid_target);
  if (!targetWindow) {
    // The main process did not register this message and reported an error directly
    MessageWriter.error(
      new Error(
        `[Virid Main] unknown Window: Cannot find ${__virid_target} in the windows registry.`,
      ),
    );
    return;
  }
  targetWindow.webContents.send(VIRID_CHANNEL, {
    __virid_source,
    __virid_messageType,
    __virid_target,
    payload,
  });
}
function broadcastMessage(message: any) {
  const { __virid_source, __virid_messageType, __virid_target, payload } =
    message;
  ROUTER_MAP.forEach((window) => {
    window.webContents.send(VIRID_CHANNEL, {
      __virid_source,
      __virid_messageType,
      __virid_target,
      payload,
    });
  });
}

export function processMessage(message: any) {
  const { __virid_target, __virid_source, __virid_messageType } = message;
  if (__virid_target === "main") return ReceiveMessages(message);
  else if (__virid_target === "all" || __virid_target === "*")
    return broadcastMessage(message);
  else return TransmitMessages(message);
}
