/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */
import { Newable } from "../interfaces";
import { MessageWriter } from "./io";

export abstract class BaseMessage {
  static send<T extends Newable<any>>(
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
  private readonly __kind = "SingleMessage" as const;
  constructor() {
    super();
  }
}

/**
 * 不可合并的消息基类
 */
export abstract class EventMessage extends BaseMessage {
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
