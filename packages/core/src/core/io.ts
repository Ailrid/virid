/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */
import { type MessageInternal } from "./internal";
import { BaseMessage, ErrorMessage, InfoMessage, WarnMessage } from "./types";
// 描述 dispatch 的结构
export interface IMessagePublisher {
  dispatch(message: BaseMessage): void;
}
// 导出这个“壳子”
let activeInstance: MessageInternal | null = null;
export function activatInstance(instance: MessageInternal) {
  activeInstance = instance;
}
export const publisher: IMessagePublisher = new Proxy({} as IMessagePublisher, {
  get(_, prop) {
    if (prop === "dispatch") {
      return (message: BaseMessage) => {
        if (!activeInstance) {
          console.error(
            `[Virid] Message dispatched before system init: ${message.constructor.name}`,
          );
          return;
        }
        // 确保调用时 this 永远指向 activeInstance
        return activeInstance.dispatch(message);
      };
    }
    // 如果以后 publisher 增加了别的方法，这里也可以照常处理
    return Reflect.get(activeInstance || {}, prop);
  },
});

export class MessageWriter {
  /**
   * 核心入口：无论是类还是实例，统一交给 Internal 处理
   */
  public static write<
    T extends BaseMessage,
    K extends new (...args: any[]) => T,
  >(target: K | T, ...args: ConstructorParameters<K>): void {
    const instance =
      typeof target === "function"
        ? new (target as any)(...args)
        : (target as T);

    // 所有的存储、标记脏数据、触发 Tick，全部收拢到 dispatch 一个方法里
    publisher.dispatch(instance);
  }

  /**
   * 快捷方式：系统内部常用
   */
  public static error(e: Error, context: string = ""): void {
    this.write(new ErrorMessage(e, context));
  }

  public static warn(context: string): void {
    this.write(new WarnMessage(context));
  }
  public static info(context: string): void {
    this.write(new InfoMessage(context));
  }
}
