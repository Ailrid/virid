/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */
import { Dispatcher } from "./dispatcher";
import { EventHub } from "./eventHub";
import {
  BaseMessage,
  type ExecuteHook,
  type TickHook,
  type MessageIdentifier,
  type Middleware,
} from "./types";
import { MessageRegistry } from "./registry";
import { MessageWriter, activateInstance } from "./io";

export class MessageInternal {
  private eventHub = new EventHub();
  private dispatcher = new Dispatcher(this.eventHub);
  private registry = new MessageRegistry();
  private middlewares: Middleware[] = [];

  constructor() {
    // 修改
    activateInstance(this);
  }

  useMiddleware(mw: Middleware, front: boolean) {
    this.middlewares.push(mw);
  }
  onBeforeExecute<T extends BaseMessage>(
    type: MessageIdentifier<T>,
    hook: ExecuteHook<T>,
    front: boolean,
  ) {
    this.dispatcher.addBeforeExecute(type, hook, front);
  }
  onAfterExecute<T extends BaseMessage>(
    type: MessageIdentifier<T>,
    hook: ExecuteHook<T>,
    front: boolean,
  ) {
    this.dispatcher.addAfterExecute(type, hook, front);
  }
  onBeforeTick(hook: TickHook, front: boolean) {
    this.dispatcher.addBeforeTick(hook, front);
  }
  onAfterTick(hook: TickHook, front: boolean) {
    this.dispatcher.addAfterTick(hook, front);
  }

  /**
   * 消息进入系统的唯一入口
   */
  dispatch(message: BaseMessage) {
    // 不是继承自BaseMessage就报错
    if (!(message instanceof BaseMessage)) {
      MessageWriter.error(
        new Error(
          `[Virid Dispatch] Type Error: Message must be an instance of BaseMessage,message:${message}`,
        ),
      );
      return;
    }
    // 运行中间件管道
    this.pipeline(message, () => {
      //看看这个消息的处理函数在this.systemTaskMap里有吗？没有就报错
      if (!this.registry.systemTaskMap.has(message.constructor)) {
        MessageWriter.error(
          new Error(
            `[Virid Dispatch] No handler for message: ${message.constructor.name}`,
          ),
        );
        return;
      }
      // 存入 Hub (根据 Single/Event 策略存入不同池子)
      this.eventHub.push(message);

      // 标记 Dispatcher 为脏，并尝试触发 Tick
      this.dispatcher.markDirty(message);
      // 启动调度循环
      this.dispatcher.tick(this.registry.systemTaskMap);
    });
  }

  private pipeline(message: BaseMessage, finalAction: () => void) {
    let index = 0;
    const next = () => {
      if (index < this.middlewares.length) {
        this.middlewares[index++](message, next);
      } else {
        finalAction();
      }
    };
    next();
  }

  register(
    eventClass: any,
    systemFn: (...args: any[]) => any,
    priority: number = 0,
  ): () => void {
    return this.registry.register(eventClass, systemFn, priority);
  }
}
