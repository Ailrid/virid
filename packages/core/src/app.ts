/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */
import { ViridContainer } from "./container";
import {
  type ExecuteHook,
  type MessageIdentifier,
  type Middleware,
  type TickHook,
  type Newable,
} from "./interfaces";
import { type BaseMessage, MessageWriter, MessageInternal } from "./core";
import { bindObservers } from "./decorators";
import { initializeGlobalSystems } from "./utils";

export interface ViridPlugin<T = any> {
  name: string;
  install: (app: ViridApp, options?: T) => void;
}

// 维护一个已安装插件的列表，防止重复安装
const installedPlugins = new Set<string>();
/**
 * 创建 virid 核心实例
 */
export class ViridApp {
  public container: ViridContainer = new ViridContainer();
  private messageInternal: MessageInternal = new MessageInternal();
  // Core 内部提供一个中间件数组
  private activationHooks: Array<(instance: any) => any> = [];
  public addActivationHook(hook: (instance: any) => any) {
    this.activationHooks.push(hook);
  }

  public get<T>(identifier: Newable<T>): T {
    if (identifier.length > 0) {
      MessageWriter.error(
        new Error(
          `[Virid Container] Violation: Component "${identifier.name}" should not have constructor arguments. Dependency Injection is only allowed in Systems.`,
        ),
      );
    }
    return this.container.get(identifier, (ins) => this.handleActivation(ins));
  }

  private handleActivation<T>(instance: T): T {
    if (!instance) return instance;

    // 前一个 Hook 的输出是后一个 Hook 的输入
    return this.activationHooks.reduce((currentInstance, hook) => {
      try {
        const nextInstance = hook(currentInstance);
        // 如果 Hook 忘记写 return，则保留上一步的结果
        // 同时，弹一个警告
        if (nextInstance === undefined) {
          MessageWriter.warn(
            `[Virid Container] Hook Does Bot Return A Value: Hook "${hook.name}" should return a instance to continue.`,
          );
        }
        return nextInstance !== undefined ? nextInstance : currentInstance;
      } catch (e) {
        MessageWriter.error(e, `[Virid Container] Activation Hook Failed`);
        return currentInstance;
      }
    }, instance);
  }
  /**
   * 绑定多例 (Controller 通常是多例)
   */
  bindController<T>(identifier: Newable<T>) {
    this.container.bind(identifier).toSelf();
    // 保持链式调用风格，即便现在后面没接东西
    return { inSingletonScope: () => ({ onActivation: () => {} }) };
  }

  /**
   * 绑定单例 (Component 是单例)
   */
  bindComponent<T>(identifier: Newable<T>) {
    this.container.bind(identifier).toSelf().inSingletonScope();
    return { onActivation: () => {} };
  }
  useMiddleware(mw: Middleware, front = false) {
    this.messageInternal.useMiddleware(mw, front);
  }
  onBeforeExecute<T extends BaseMessage>(
    type: MessageIdentifier<T>,
    hook: ExecuteHook<T>,
    front = false,
  ) {
    this.messageInternal.onBeforeExecute(type, hook, front);
  }
  onAfterExecute<T extends BaseMessage>(
    type: MessageIdentifier<T>,
    hook: ExecuteHook<T>,
    front = false,
  ) {
    this.messageInternal.onAfterExecute(type, hook, front);
  }
  onBeforeTick(hook: TickHook, front = false) {
    this.messageInternal.onBeforeTick(hook, front);
  }
  onAfterTick(hook: TickHook, front = false) {
    this.messageInternal.onAfterTick(hook, front);
  }
  register(
    messageClass: any,
    systemFn: (...args: any[]) => any,
    priority: number = 0,
  ): () => void {
    return this.messageInternal.register(messageClass, systemFn, priority);
  }
  use<T>(plugin: ViridPlugin<T>, options: T): this {
    if (installedPlugins.has(plugin.name)) {
      MessageWriter.warn(
        `[Virid Plugin] Duplicate Installation: Plugin ${plugin.name} has already been installed.`,
      );
      return this;
    }
    try {
      plugin.install(this, options);
      installedPlugins.add(plugin.name);
    } catch (e) {
      MessageWriter.error(
        e as Error,
        `[Virid Plugin]: Install Failed: ${plugin.name}`,
      );
    }
    return this;
  }
}

export const viridApp = new ViridApp();
viridApp.addActivationHook(bindObservers);
initializeGlobalSystems(viridApp);
