/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */
/**
 * @description: 事件调度器
 */
import { MessageWriter } from "./io";
import {
  SingleMessage,
  EventMessage,
  type BaseMessage,
  type ExecuteHook,
  type ExecuteHookContext,
  type SystemTask,
  type MessageIdentifier,
  type SystemContext,
  type TickHook,
  type TickHookContext,
} from "./types";
import { type EventHub } from "./eventHub";

export class Dispatcher {
  private dirtySignalTypes = new Set<any>();
  private eventQueue: EventMessage[] = [];
  private isRunning = false;
  private globalTick = 0; // 整个 App 生命周期内唯一、单调递增
  private internalDepth = 0; // 用于死循环防御，单次任务链执行完归零
  private eventHub: EventHub;
  private tickPayload: { [key: string]: any } = {};
  // 两个execute钩子
  private beforeExecuteHooks: Array<{
    type: MessageIdentifier<any>;
    handler: ExecuteHook<any>;
  }> = [];
  private afterExecuteHooks: Array<{
    type: MessageIdentifier<any>;
    handler: ExecuteHook<any>;
  }> = [];
  // 两个tick钩子
  private beforeTickHooks: Array<TickHook> = [];
  private afterTickHooks: Array<TickHook> = [];
  // 两个tick钩子
  constructor(eventHub: EventHub) {
    this.eventHub = eventHub;
  }
  // 添加执行钩子
  public addBeforeExecute<T extends BaseMessage>(
    type: MessageIdentifier<T>,
    hook: ExecuteHook<T>,
    front: boolean,
  ) {
    //从前面插入
    if (front)
      this.beforeExecuteHooks.unshift({
        type,
        handler: hook as ExecuteHook<any>,
      });
    else
      this.beforeExecuteHooks.push({ type, handler: hook as ExecuteHook<any> });
  }
  public addAfterExecute<T extends BaseMessage>(
    type: MessageIdentifier<T>,
    hook: ExecuteHook<T>,
    front: boolean,
  ) {
    //从前面插入
    if (front)
      this.afterExecuteHooks.unshift({
        type,
        handler: hook as ExecuteHook<any>,
      });
    else
      this.afterExecuteHooks.push({ type, handler: hook as ExecuteHook<any> });
  }
  // 添加执行钩子
  public addBeforeTick(hook: TickHook, front: boolean) {
    if (front) this.beforeTickHooks.unshift(hook);
    else this.beforeTickHooks.push(hook);
  }
  public addAfterTick(hook: TickHook, front: boolean) {
    if (front) this.afterTickHooks.unshift(hook);
    else this.afterTickHooks.push(hook);
  }

  /**
   * 标记脏数据：根据基类判断进入哪个池子
   */
  public markDirty(message: any) {
    if (message instanceof EventMessage) {
      // EventMessage：顺序追加，不合并
      this.eventQueue.push(message);
    } else if (message instanceof SingleMessage) {
      // SingleMessage：按类型合并
      this.dirtySignalTypes.add(message.constructor);
    }
  }

  public tick(systemTaskMap: Map<any, SystemTask[]>) {
    if (
      this.isRunning ||
      (this.dirtySignalTypes.size === 0 && this.eventQueue.length === 0)
    )
      return;

    // 死循环防御
    if (this.internalDepth > 100) {
      this.internalDepth = 0;
      // 立即清空队列
      this.dirtySignalTypes.clear();
      this.eventQueue = [];
      // 立即清空hub
      this.eventHub.reset();
      // 递归爆炸💥
      MessageWriter.error(
        new Error("[Virid Dispatcher] Deadlock: Recursive loop detected 💥."),
      );
      return;
    }

    this.isRunning = true;
    this.internalDepth++;

    queueMicrotask(() => {
      let signalSnapshot: Set<any> | undefined;
      let eventSnapshot: EventMessage[] | undefined;
      try {
        //执行tick钩子,只在第一次才触发
        if (this.internalDepth == 0) {
          this.tickPayload = {};
          this.executeTickHooks(this.beforeTickHooks);
        }

        //准备开始执行
        const snapshot = this.prepareSnapshot();
        signalSnapshot = snapshot.signalSnapshot;
        eventSnapshot = snapshot.eventSnapshot;
        //收集这一tick应该执行的任务
        const tasks = this.collectTasks(
          eventSnapshot,
          signalSnapshot,
          systemTaskMap,
        );
        //执行这一帧的任务
        this.executeTasks(tasks);
      } catch (e) {
        MessageWriter.error(e as Error, "[Virid Dispatcher] Unhandled Error");
      } finally {
        // 清理
        if (signalSnapshot && eventSnapshot) {
          this.clear(eventSnapshot, signalSnapshot);
        }
        // 释放锁并尝试下一轮执行
        this.isRunning = false;
        if (this.dirtySignalTypes.size > 0 || this.eventQueue.length > 0) {
          // 此时 tick 立即进入下一轮
          this.tick(systemTaskMap);
        } else {
          this.executeTickHooks(this.afterTickHooks);
          //标记当前tick
          this.globalTick++;
          // 重置内部状态
          this.internalDepth = 0;
        }
      }
    });
  }
  private collectTasks(
    eventSnapshot: EventMessage[],
    signalSnapshot: Set<any>,
    systemTaskMap: Map<any, SystemTask[]>,
  ): ExecutionTask[] {
    const tasks: ExecutionTask[] = [];
    // 收集 EVENT 任务 ,从前往后每一条消息执行所有关联 System
    for (const msg of eventSnapshot) {
      const systems = systemTaskMap.get(msg.constructor) || [];
      systems.forEach((s) => {
        //拿到Context
        tasks.push(
          new ExecutionTask(s.fn, s.priority, msg, {
            context: (s.fn as any).systemContext as SystemContext,
            tick: this.globalTick,
            payload: {},
          }),
        );
      });
    }
    // 收集 SIGNAL 任务 (每个 System 针对该类型只跑一次)
    // 对 System 函数引用进行去重，防止同一个类型触发多次重复的 SIGNAL 处理
    const signalFnSet = new Set<any>();
    for (const type of signalSnapshot) {
      const systems = systemTaskMap.get(type) || [];
      systems.forEach((s) => {
        if (!signalFnSet.has(s.fn)) {
          tasks.push(
            new ExecutionTask(
              s.fn,
              s.priority,
              this.eventHub.peekSignal(type),
              {
                context: (s.fn as any).systemContext as SystemContext,
                tick: this.globalTick,
                payload: {},
              },
            ),
          );
          signalFnSet.add(s.fn);
        }
      });
    }
    return tasks;
  }
  private executeTasks(tasks: ExecutionTask[]) {
    // 无论消息类型，按照 System 定义的优先级排序
    tasks.sort((a, b) => b.priority - a.priority);
    // 执行任务流
    for (const task of tasks) {
      try {
        const result = task.execute(
          this.beforeExecuteHooks,
          this.afterExecuteHooks,
        );
        // 如果是 Promise，只管注册一个 catch 防止崩溃，不 await 它
        if (result instanceof Promise) {
          result.catch((e) =>
            MessageWriter.error(
              e,
              `[Virid Dispatcher] Async Error:\ntargetClass:${task.hookContext.context.targetClass.name}\nmethodName:${task.hookContext.context.methodName}
                `,
            ),
          );
        }
      } catch (e) {
        MessageWriter.error(
          e as Error,
          `[Virid Dispatcher] Sync Error:\ntargetClass:${task.hookContext.context.targetClass.name}\nmethodName:${task.hookContext.context.methodName}
                `,
        );
      }
    }
  }
  private prepareSnapshot() {
    // 交换双缓冲区，锁定当前 Tick 数据
    this.eventHub.flip();
    // 拍下当前待处理任务的快照
    const signalSnapshot = new Set(this.dirtySignalTypes);
    const eventSnapshot = [...this.eventQueue];
    // 立即清空队列，允许 System 在执行时产生新消息进入 staging
    this.dirtySignalTypes.clear();
    this.eventQueue = [];
    return { signalSnapshot, eventSnapshot };
  }
  private clear(eventSnapshot: EventMessage[], signalSnapshot: Set<any>) {
    // 进行清理
    const processedTypes = new Set(signalSnapshot);
    eventSnapshot.forEach((m) => processedTypes.add(m.constructor));
    // 清理 SIGNAL
    this.eventHub.clearSignals(processedTypes);
    // 清理已执行完的 EVENT 队列
    this.eventHub.clearEvents();
  }
  private executeTickHooks(hooks: TickHook[]) {
    const hooksContext: TickHookContext = {
      tick: this.globalTick,
      timestamp: Date.now(),
      payload: this.tickPayload,
    };
    hooks.forEach((h) => h(hooksContext));
  }
}

export class ExecutionTask {
  constructor(
    public fn: (...args: any[]) => any,
    public priority: number,
    public message: any, // 运行时可能是 T 或 T[]
    public hookContext: ExecuteHookContext,
  ) {}

  private triggerHooks(
    hooks: Array<{ type: MessageIdentifier<any>; handler: ExecuteHook<any> }>,
  ) {
    const sample = Array.isArray(this.message) ? this.message[0] : this.message;
    if (!sample) return;

    for (const hook of hooks) {
      if (sample instanceof hook.type) {
        try {
          const result = hook.handler(this.message, this.hookContext);
          if (result instanceof Promise) {
            result.catch((e) =>
              MessageWriter.error(
                e,
                `[Virid Hook] Async Hook Error:\nIt is prohibited to use asynchronous hooks within Hook:\n${hook.type.name}`,
              ),
            );
          }
        } catch (e) {
          MessageWriter.error(
            e as Error,
            `[Virid Hook] Hook Execute Failed:\nTriggered by: ${sample.constructor.name}\n Registered type: ${hook.type.name}`,
          );
        }
      }
    }
  }

  public execute(
    beforeExecuteHooks: Array<{
      type: MessageIdentifier<any>;
      handler: ExecuteHook<any>;
    }>,
    afterExecuteHooks: Array<{
      type: MessageIdentifier<any>;
      handler: ExecuteHook<any>;
    }>,
  ): any {
    //执行前置钩子
    this.triggerHooks(beforeExecuteHooks);
    const runAfter = () => this.triggerHooks(afterExecuteHooks);

    try {
      const result = this.fn(this.message);

      if (result instanceof Promise) {
        // 异步模式利用 .finally 确保钩子执行
        return result.finally(() => runAfter());
      }
      // 如果是同步，直接后置钩子执行并返回
      runAfter();
      return result;
    } catch (e) {
      // 如果报错了，也执行后置钩子
      runAfter();
      throw e; // 抛给 Dispatcher 的 try-catch 处理
    }
  }
}
