/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Electron Main
 */
import { MessageWriter } from "@virid/core";
import { BrowserWindow } from "electron";
import { type FromRenderMessage } from "./types";
export const VIRID_CHANNEL = "VIRID_INTERNAL_BUS";
export const ROUTER_MAP = new Map<string, BrowserWindow>();
let MESSAGE_MAP = new Map<string, any>();

export function registerMessage(
  registerMap:
    | Record<string, new (...args: any[]) => FromRenderMessage>
    | Map<string, new (...args: any[]) => FromRenderMessage>,
): void {
  if (registerMap instanceof Map) {
    MESSAGE_MAP = registerMap;
  } else {
    // 如果是普通对象，转换成 Map
    MESSAGE_MAP = new Map(Object.entries(registerMap));
  }
}
//主进程接收消息并发给自己的system
function ReceiveMessages(message: any): void {
  const { __virid_source, __virid_messageType, __virid_target, payload } =
    message;
  if (!MESSAGE_MAP.has(__virid_messageType)) {
    // 主进程没注册这个消息,直接报错
    MessageWriter.error(
      new Error(
        `[Virid Main] unknown Message Type: Cannot find ${__virid_messageType} in the main process registry.`,
      ),
    );
    return;
  }
  // 查找主进程注册的消息类
  const MessageClass = MESSAGE_MAP.get(__virid_messageType);
  // 实例化
  let instance = new (MessageClass as any)();
  // 数据还原
  if (payload) {
    Object.assign(instance, payload);
  }
  // 注入身份元数据
  instance.__virid_source = __virid_source;
  instance.__virid_target = __virid_target;
  instance.__virid_messageType = __virid_messageType;
  // 注入物理上下文
  const context = ROUTER_MAP.get(__virid_source);
  if (context) {
    instance.senderWindow = context;
  }

  // 派发给主进程的 System 群
  MessageWriter.write(instance);
}

function TransmitMessages(message: any): void {
  const { __virid_source, __virid_messageType, __virid_target, payload } =
    message;
  // 查找主进程注册的消息类
  const targetWindow = ROUTER_MAP.get(__virid_target);
  if (!targetWindow) {
    // 主进程没注册这个消息,直接报错
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
