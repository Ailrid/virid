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
  type SystemContext,
  type SystemConfig,
} from "./interfaces";
import {
  BaseMessage,
  MessageWriter,
  MessageEngine,
  EventMessage,
  SingleMessage,
} from "./core";
import { handleResult, Component } from "./decorators";

export interface ViridPlugin<T = any> {
  name: string;
  install: (app: ViridApp, options: T) => void;
}

@Component()
export class ViridApp {
  public container: ViridContainer = new ViridContainer();
  private MessageEngine: MessageEngine;
  private installedPlugins = new Set<string>();

  constructor(maxDepth: number, manual: boolean) {
    this.MessageEngine = new MessageEngine(maxDepth, manual);
    this.container.spawn(this);
  }

  /**
   * Register an activation hook
   * @param hook An activation hook
   * @param front Is the hook order inserted from the front or added
   */
  onActivate(hook: (instance: any) => any, front: boolean = false) {
    this.container.addActivationHook(hook, front);
  }

  /**
   * Opening a new tick
   */
  tick() {
    this.MessageEngine.tick();
  }

  /**
   * Obtain a Component or Controller instance
   * @param identifier Constructor of components or controllers
   */
  get<T>(identifier: Newable<T>): T {
    return this.container.get(identifier);
  }

  /**
   * Static binding component or controller
   * @param identifier Constructor of components or controllers
   */
  bind<T>(identifier: Newable<T>) {
    this.container.bind(identifier);
  }
  /**
   * Dynamically register a component
   * @param instance Component instance
   */
  spawn(instance: object) {
    this.container.spawn(instance);
  }
  useMiddleware(mw: Middleware, front = false) {
    this.MessageEngine.useMiddleware(mw, front);
  }
  onBeforeExecute<T extends BaseMessage>(
    type: MessageIdentifier<T>,
    hook: ExecuteHook<T>,
    front = false,
  ) {
    this.MessageEngine.onBeforeExecute(type, hook, front);
  }
  onAfterExecute<T extends BaseMessage>(
    type: MessageIdentifier<T>,
    hook: ExecuteHook<T>,
    front = false,
  ) {
    this.MessageEngine.onAfterExecute(type, hook, front);
  }
  onBeforeTick(hook: TickHook, front = false) {
    this.MessageEngine.onBeforeTick(hook, front);
  }
  onAfterTick(hook: TickHook, front = false) {
    this.MessageEngine.onAfterTick(hook, front);
  }

  use<T>(plugin: ViridPlugin<T>, options: T): this {
    if (this.installedPlugins.has(plugin.name)) {
      MessageWriter.warn(
        `[Virid Plugin] Duplicate Installation: Plugin ${plugin.name} has already been installed.`,
      );
      return this;
    }
    try {
      plugin.install(this, options);
      this.installedPlugins.add(plugin.name);
    } catch (e) {
      MessageWriter.error(
        e as Error,
        `[Virid Plugin]: Install Failed: ${plugin.name}`,
      );
    }
    return this;
  }
  /**
   * Register message to registrar
   * @param systemFn System functions
   */
  register(systemFn: (...args: any[]) => any): () => void {
    const systemContext: SystemContext = (systemFn as any).systemContext;
    const systemConfig: SystemConfig = (systemFn as any).systemConfig;

    if (!systemContext || !systemConfig) {
      throw new Error(
        `[Virid System] System Parameter Loss: Please declare ${systemFn.name} using the @System decorator first.`,
      );
    }

    const { params: types, targetClass, originalMethod } = systemContext;
    const { messageClass, messageIdx, priority, batchMode } = systemConfig;

    const handleResultFn =
      typeof handleResult === "function" ? handleResult : (res: any) => res;
    const processResult = (result: any) => {
      return result instanceof Promise
        ? result.then(handleResultFn)
        : handleResultFn(result);
    };

    const cachedComponents = new Array(types.length);
    let isInitialized = false;

    const initDeps = () => {
      for (let i = 0; i < types.length; i++) {
        if (i !== messageIdx) {
          const dep = this.get(types[i]);
          if (!dep) {
            throw new Error(
              `[Virid System] Unknown Inject Data Types: ${types[i].name || types[i]} is not registered in the container for system '${systemFn.name}'!`,
            );
          }
          cachedComponents[i] = dep;
        }
      }
      isInitialized = true;
    };

    let wrappedSystem: (currentMessage: EventMessage | SingleMessage[]) => any;

    if (messageIdx === -1) {
      wrappedSystem = () => {
        if (!isInitialized) initDeps();
        return processResult(
          originalMethod.apply(targetClass, cachedComponents),
        );
      };
    } else if (types.length === 1) {
      if (batchMode) {
        wrappedSystem = (currentMessage: EventMessage | SingleMessage[]) => {
          const payload = Array.isArray(currentMessage)
            ? currentMessage
            : [currentMessage];

          if (payload.length > 0 && !(payload[0] instanceof messageClass)) {
            throw new Error(
              `[Virid System] Type Mismatch: Expected list of ${messageClass.name}, but got ${payload[0]?.constructor?.name}`,
            );
          }

          return processResult(originalMethod.call(targetClass, payload));
        };
      } else {
        wrappedSystem = (currentMessage: EventMessage | SingleMessage[]) => {
          const payload = Array.isArray(currentMessage)
            ? currentMessage[currentMessage.length - 1]
            : currentMessage;

          if (!(payload instanceof messageClass)) {
            throw new Error(
              `[Virid System] Type Mismatch: Expected ${messageClass.name}, but got ${(payload as any)?.constructor?.name}`,
            );
          }

          return processResult(originalMethod.call(targetClass, payload));
        };
      }
    } else {
      if (batchMode) {
        wrappedSystem = (currentMessage: EventMessage | SingleMessage[]) => {
          if (!isInitialized) initDeps();
          const payload = Array.isArray(currentMessage)
            ? currentMessage
            : [currentMessage];

          if (payload.length > 0 && !(payload[0] instanceof messageClass)) {
            throw new Error(
              `[Virid System] Type Mismatch: Expected list of ${messageClass.name}, but got ${payload[0]?.constructor?.name}`,
            );
          }

          const callArgs = [...cachedComponents];
          callArgs[messageIdx] = payload;
          return processResult(originalMethod.apply(targetClass, callArgs));
        };
      } else {
        wrappedSystem = (currentMessage: EventMessage | SingleMessage[]) => {
          if (!isInitialized) initDeps();
          const payload = Array.isArray(currentMessage)
            ? currentMessage[currentMessage.length - 1]
            : currentMessage;

          if (!(payload instanceof messageClass)) {
            throw new Error(
              `[Virid System] Type Mismatch: Expected ${messageClass.name}, but got ${(payload as any)?.constructor?.name}`,
            );
          }

          const callArgs = [...cachedComponents];
          callArgs[messageIdx] = payload;
          return processResult(originalMethod.apply(targetClass, callArgs));
        };
      }
    }

    (wrappedSystem as any).systemContext = systemContext;

    return this.MessageEngine.register(messageClass, wrappedSystem, priority);
  }
}
