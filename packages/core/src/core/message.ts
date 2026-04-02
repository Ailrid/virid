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



// // 存储 { 类名: 当前活跃的消息实例 }
// const debounceMap = new Map<any, any>();
// // 存储 { 类名: 用于清理的 Timer }
// const timerMap = new Map<any, any>();

// export abstract class DebounceMessage extends SingleMessage {
//   /**
//    * 子类必须定义防抖时间（毫秒）
//    */
//   abstract readonly debounceTime: number;

//   constructor() {
//     super();
//   }

//   static send<T extends Newable<DebounceMessage>>(
//     this: T,
//     ...args: ConstructorParameters<T>
//   ) {
//     // 提前实例化
//     const instance = new this(...args) as InstanceType<T>;
//     const debounceTime = instance.debounceTime;

//     const previousMessage = debounceMap.get(this);
//     if (previousMessage) {
//       instance.debounceCallback(previousMessage);

//       // 有了新消息，就取消掉之前的清理定时器
//       const oldTimer = timerMap.get(this);
//       if (oldTimer) clearTimeout(oldTimer);
//     }

//     // 更新 Map 记录当前最新的消息
//     debounceMap.set(this, instance);

//     // 只有在 debounceTime 毫秒内没有新消息进来，才会彻底从 Map 中移除
//     const timer = setTimeout(() => {
//       debounceMap.delete(this);
//       timerMap.delete(this);
//     }, debounceTime);

//     timerMap.set(this, timer);

//     MessageWriter.write(instance as any);
//   }

//   /**
//    * 子类实现：决定如何处理前一个还在“窗口期”内的消息
//    */
//   debounceCallback(previousMessage: this): void {
//     return;
//   }
// }
