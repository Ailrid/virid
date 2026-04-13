/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */
import { Newable } from "./common";
import {
  type BaseMessage,
  type SingleMessage,
  type EventMessage,
} from "../core";

export type Middleware = (message: BaseMessage, next: () => void) => void;

export type ExecuteHook<T extends BaseMessage> = (
  message: [BaseMessage] extends [T]
    ? SingleMessage[] | EventMessage
    : T extends SingleMessage
      ? T[]
      : T,
  context: ExecuteHookContext,
  success: boolean,
) => void | Promise<void>;

export interface ExecuteHookContext {
  context: SystemContext;
  tick: number;
  //一个可以在两个钩子之间传递任意数据的载荷
  payload: { [key: string]: any };
}

export interface SystemContext {
  params: any[]; // 参数类型定义列表
  targetClass: any; // System 所在的类
  methodName: string; // 方法名
  originalMethod: (...args: any[]) => any;
}

export interface SystemTask {
  fn: (...args: any[]) => any;
  priority: number;
}

export type MessagePayload<T> = T extends SingleMessage
  ? T[]
  : T extends EventMessage
    ? T
    : T | T[]; // BaseMessage 可能是两者之一

// 一个可以接受抽象类和普通类的类型
export type MessageIdentifier<T> =
  | (abstract new (...args: any[]) => T)
  | Newable<T>;

export type TickHook = (context: TickHookContext) => void | Promise<void>;

export interface TickHookContext {
  tick: number;
  // 事务开始的时间戳（由 Dispatcher 统一提供）
  timestamp: number;
  // 在 Before 和 After 之间传递数据的载荷
  payload: { [key: string]: any };
}
