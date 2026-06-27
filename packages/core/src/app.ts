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

  constructor(maxDepth: number) {
    this.MessageEngine = new MessageEngine(maxDepth);
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
  /**
   * Register message to registrar
   * @param systemFn System functions
   */
  register(systemFn: (...args: any[]) => any): () => void {
    const systemContext: SystemContext = (systemFn as any).systemContext;
    const systemConfig: SystemConfig = (systemFn as any).systemConfig;

    if (!systemContext || !systemConfig) {
      throw new Error(
        `[Virid System] System Parameter Loss: Please declare ${systemFn.name} using the System decorator first.`,
      );
    }

    const { params: types, targetClass, originalMethod } = systemContext;
    const { messageClass, messageIdx, priority, batchMode } = systemConfig;

    // The closure variable belongs to the currently registered instance of wrappedSystem
    let cachedDeps: any[] | null = null;
    const buildArgs = (currentMessage: EventMessage | SingleMessage[]) => {
      let processedMessage: any = null;

      const sample = Array.isArray(currentMessage)
        ? currentMessage[0]
        : currentMessage;

      if (sample && !(sample instanceof messageClass)) {
        const receivedName = (sample as any).constructor?.name || typeof sample;
        throw new Error(
          `[Virid System] Type Mismatch: Expected ${messageClass.name}, but received ${receivedName}`,
        );
      }

      // Processing SingleMessage (Merge and Batch Processing Type)
      if (sample instanceof SingleMessage) {
        if (!batchMode) {
          processedMessage = Array.isArray(currentMessage)
            ? currentMessage[currentMessage.length - 1]
            : currentMessage;
        } else {
          processedMessage = Array.isArray(currentMessage)
            ? currentMessage
            : [currentMessage];
        }
      }
      // Process EventMessage (Sequential Single Order Type)
      else if (sample instanceof EventMessage) {
        processedMessage = currentMessage;
      } else if (sample) {
        throw new Error(
          `[Virid System] unknown Message Types: Message ${messageClass.name} is not a subclass of SingleMessage or EventMessage!`,
        );
      }

      if (!cachedDeps) {
        // First execution: Retrieve regular dependencies from the DI container on site and fill the cache
        cachedDeps = types.map((type: any, index: number) => {
          // If the current index is the position of the Message parameter, first store a null placeholder, and then dynamically fill it in later
          if (index === messageIdx) {
            return null;
          }
          const param = this.get(type);
          if (!param) {
            throw new Error(
              `[Virid System] unknown Inject Data Types: ${type.name || type} is not registered in the container!`,
            );
          }
          return param;
        });
      }

      const finalArgs = cachedDeps.map((dep, index) => {
        if (index === messageIdx) {
          return processedMessage;
        }
        return dep;
      });
      return finalArgs;
    };

    const wrappedSystem = (currentMessage: EventMessage | SingleMessage[]) => {
      const finalArgs = buildArgs(currentMessage);
      const result = originalMethod.apply(targetClass, finalArgs);

      const handleResultFn =
        typeof handleResult === "function" ? handleResult : (res: any) => res;

      return result instanceof Promise
        ? result.then(handleResultFn)
        : handleResultFn(result);
    };
    (wrappedSystem as any).systemContext = systemContext;

    return this.MessageEngine.register(messageClass, wrappedSystem, priority);
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
}
