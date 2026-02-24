/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */
import { MessageWriter } from "./io";

export type Newable<
  TInstance = unknownn,
  TArgs extends unknownn[] = any[],
> = new (...args: TArgs) => TInstance;

type AnyConstructor = abstract new (...args: any[]) => any;

export abstract class BaseMessage {
  static send<T extends AnyConstructor>(
    this: T,
    ...args: ConstructorParameters<T>
  ) {
    // 实例化并传递给 Writer
    MessageWriter.write(this as any, ...args);
  }
}
/**
 * 可合并的信号基类
 */
export abstract class SingleMessage extends BaseMessage {
  // @ts-ignore 只用来区分的标识符
  private readonly __kind = "SingleMessage" as const;
  constructor() {
    super();
  }
}

/**
 * 不可合并的消息基类
 */
export abstract class EventMessage extends BaseMessage {
  // @ts-ignore 只用来区分的标识符
  private readonly __kind = "EventMessage" as const;
  constructor() {
    super();
  }
}

/**
 * 基础错误消息：不可合并，必须被精准捕获
 */
export class ErrorMessage extends EventMessage {
  constructor(
    public readonly error: Error,
    public readonly context?: string,
  ) {
    super();
  }
}
/**
 * 基础警告消息：不可合并，必须被精准捕获
 */
export class WarnMessage extends EventMessage {
  constructor(public readonly context: string) {
    super();
  }
}
/**
 * 基础信息消息：不可合并，必须被精准捕获
 */
export class InfoMessage extends EventMessage {
  constructor(public readonly context: string) {
    super();
  }
}

/**
 * 原子修改消息：不可合并，带上组件类型、修改逻辑和语义标签
 */
export class AtomicModifyMessage<T> extends EventMessage {
  constructor(
    public readonly ComponentClass: Newable<T>, // 你要改哪个组件？
    public readonly recipe: (comp: T) => void, // 你打算怎么改？
    public readonly label: string, // 为什么要改？
  ) {
    super();
  }
}
//-----------------------------------------------------------------------
export type Middleware = (message: BaseMessage, next: () => void) => void;

// 修改 Hook 定义，增加对基类的处理逻辑
export type ExecuteHook<T extends BaseMessage> = (
  message: [BaseMessage] extends [T]
    ? SingleMessage[] | EventMessage // 如果是基类本身，可能是数组也可能是单体
    : T extends SingleMessage
      ? T[]
      : T,
  context: ExecuteHookContext,
) => void | Promise<void>;

export interface ExecuteHookContext {
  context: SystemContext;
  tick: number;
  //一个可以在两个钩子之间传递任意数据的载荷
  payload: { [key: string]: any };
}

// 定义在 types.ts 中
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

//-------------------------------------------------------------------

export type TickHook = (context: TickHookContext) => void | Promise<void>;

export interface TickHookContext {
  tick: number;
  // 事务开始的时间戳（由 Dispatcher 统一提供）
  timestamp: number;
  // 在 Before 和 After 之间传递数据的载荷
  payload: { [key: string]: any };
}
