/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */

import { MessageWriter } from "./io";
import {
  type ExecuteHook,
  type ExecuteHookContext,
  type SystemTask,
  type MessageIdentifier,
  type SystemContext,
  type TickHook,
  type TickHookContext,
} from "../interfaces";
import { type BaseMessage } from "./message";
import { Staging } from "./staging";

export class Dispatcher {
  constructor(private maxDepth: number) {}
  private isRunning = false;
  private globalTick = 0;
  private internalDepth = 0;
  private staging = new Staging();

  private tickPayload: { [key: string]: any } = {};

  private beforeExecuteHooks: Array<{
    type: MessageIdentifier<any>;
    handler: ExecuteHook<any>;
  }> = [];
  private afterExecuteHooks: Array<{
    type: MessageIdentifier<any>;
    handler: ExecuteHook<any>;
  }> = [];

  private beforeTickHooks: Array<TickHook> = [];
  private afterTickHooks: Array<TickHook> = [];

  public addBeforeExecute<T extends BaseMessage>(
    type: MessageIdentifier<T>,
    hook: ExecuteHook<T>,
    front: boolean,
  ) {
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
    if (front)
      this.afterExecuteHooks.unshift({
        type,
        handler: hook as ExecuteHook<any>,
      });
    else
      this.afterExecuteHooks.push({ type, handler: hook as ExecuteHook<any> });
  }
  public addBeforeTick(hook: TickHook, front: boolean) {
    if (front) this.beforeTickHooks.unshift(hook);
    else this.beforeTickHooks.push(hook);
  }
  public addAfterTick(hook: TickHook, front: boolean) {
    if (front) this.afterTickHooks.unshift(hook);
    else this.afterTickHooks.push(hook);
  }

  /**
   * Marking dirty data, Determine which pool to enter based on the base class
   */
  public stage(message: BaseMessage) {
    this.staging.stage(message);
  }

  public tick(systemTaskMap: Map<any, SystemTask[]>) {
    if (this.isRunning || this.staging.isEmpty()) return;

    if (this.internalDepth > this.maxDepth) {
      this.internalDepth = 0;
      this.staging.reset();
      console.error(
        new Error(
          `[Virid Dispatcher] Deadlock: Max depth reached ${this.maxDepth}, Possible infinite loop detected. The dispatcher will stop processing this tick.`,
        ),
      );
      return;
    }

    this.isRunning = true;
    this.internalDepth++;

    queueMicrotask(() => {
      try {
        // Execute tick hook, only triggered on the first time
        if (this.internalDepth == 1) {
          this.tickPayload = {};
          this.executeTickHooks(this.beforeTickHooks);
        }
        // Preparing to start execution
        this.staging.flip();
        // The tasks that should be performed to collect this tick
        const tasks = this.collectTasks(systemTaskMap);
        // Execute the task for this frame
        this.executeTasks(tasks);
      } catch (e) {
        MessageWriter.error(e as Error, "[Virid Dispatcher] Unhandled Error");
      } finally {
        // Release the lock and attempt the next round of execution
        this.isRunning = false;
        // Enter the next round of micro tick
        if (!this.staging.isEmpty()) {
          this.tick(systemTaskMap);
        } else {
          // Reset internal status
          this.staging.reset();
          this.internalDepth = 0;
          this.executeTickHooks(this.afterTickHooks);
          this.globalTick++;
        }
      }
    });
  }
  private collectTasks(systemTaskMap: Map<any, SystemTask[]>): ExecutionTask[] {
    const tasks: ExecutionTask[] = [];
    // Collect EVENT tasks and execute all associated systems for each message from front to back
    for (const msg of this.staging.eventActive) {
      const systems = systemTaskMap.get(msg.constructor) || [];
      systems.forEach((s) => {
        tasks.push(
          new ExecutionTask(
            s.fn,
            s.priority,
            msg,
            {
              context: (s.fn as any).systemContext as SystemContext,
              tick: this.globalTick,
              payload: {},
            },
            this.beforeExecuteHooks,
            this.afterExecuteHooks,
          ),
        );
      });
    }
    // Collect SIGNAL tasks (each system only runs once for that type)
    for (const [msg, msg_list] of this.staging.signalActive.entries()) {
      const systems = systemTaskMap.get(msg) || [];
      systems.forEach((s) => {
        tasks.push(
          new ExecutionTask(
            s.fn,
            s.priority,
            msg_list,
            {
              context: (s.fn as any).systemContext as SystemContext,
              tick: this.globalTick,
              payload: {},
            },
            this.beforeExecuteHooks,
            this.afterExecuteHooks,
          ),
        );
      });
    }
    return tasks;
  }
  private executeTasks(tasks: ExecutionTask[]) {
    // Regardless of the message type, sort according to the priority defined by the System
    tasks.sort((a, b) => b.priority - a.priority);
    for (const task of tasks) {
      const msg = Array.isArray(task.message) ? task.message[0] : task.message;
      try {
        const result = task.execute();
        // If it's a Promise, just register a catch to prevent crashes, don't await it
        if (result instanceof Promise) {
          result.catch((e) =>
            MessageWriter.error(
              e,
              `[Virid Dispatcher]: Async System Error.\n` +
                `SystemLocation: ${task.hookContext.context.targetClass.name}.${task.hookContext.context.methodName}\n` +
                `MessageName:    ${msg.constructor.name}\n` +
                `MessageData:    ${JSON.stringify(task.message)}`,
            ),
          );
        }
      } catch (e) {
        MessageWriter.error(
          e as Error,
          `[Virid Dispatcher]: Sync System Error.\n` +
            `SystemLocation: ${task.hookContext.context.targetClass.name}.${task.hookContext.context.methodName}\n` +
            `MessageName:    ${msg.constructor.name}\n` +
            `MessageData:    ${JSON.stringify(task.message)}`,
        );
      }
    }
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
  public success = true;
  constructor(
    public fn: (...args: any[]) => any,
    public priority: number,
    public message: any, //  T or T[]
    public hookContext: ExecuteHookContext,
    public beforeExecuteHooks: Array<{
      type: MessageIdentifier<any>;
      handler: ExecuteHook<any>;
    }>,
    public afterExecuteHooks: Array<{
      type: MessageIdentifier<any>;
      handler: ExecuteHook<any>;
    }>,
  ) {}

  private triggerHooks(
    hooks: Array<{
      type: MessageIdentifier<any>;
      handler: ExecuteHook<any>;
    }>,
  ) {
    const sample = Array.isArray(this.message) ? this.message[0] : this.message;
    if (!sample) return;

    for (const hook of hooks) {
      if (sample instanceof hook.type) {
        try {
          const result = hook.handler(
            this.message,
            this.hookContext,
            this.success,
          );
          if (result instanceof Promise) {
            result.catch((e) => {
              MessageWriter.error(
                e,
                `[Virid Hook] Async Hook Error: It is prohibited to use asynchronous hooks within Hook: ${hook.type.name}`,
              );
            });
          }
        } catch (e) {
          MessageWriter.error(
            e as Error,
            `[Virid Hook] Hook Execute Failed: Triggered by: ${sample.constructor.name}, Registered type: ${hook.type.name}`,
          );
        }
      }
    }
  }

  public execute(): any {
    this.triggerHooks(this.beforeExecuteHooks);
    const runAfter = () => this.triggerHooks(this.afterExecuteHooks);

    try {
      const result = this.fn(this.message);

      if (result instanceof Promise) {
        // Asynchronous mode utilizes. finally to ensure hook execution
        return result.catch(() => (this.success = false)).finally(runAfter);
      }
      // If it is synchronization, execute it directly with a post hook and return it
      runAfter();
      return result;
    } catch (e) {
      // If an error occurs, execute the post hook as well
      this.success = false;
      runAfter();
      throw e; // Try catch processing thrown to Dispatcher
    }
  }
}
