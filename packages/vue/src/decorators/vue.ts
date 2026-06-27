/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Vue
 */
import { VIRID_VUE_METADATA } from "./constant";
import type { WatchOptions } from "vue";
import {
  MessageWriter,
  type Newable,
  BaseMessage,
  SingleMessage,
} from "@virid/core";
import {
  type WatchMetadata,
  type ProjectMetadata,
  type InheritMetadata,
  type UseMetadata,
  type ResponsiveMetadata,
  type OnHookMetadata,
  type ListenerMetadata,
  type ListenerConfig,
  EnvMetadata,
} from "../interfaces";

/**
 * Overload 1: Monitor Controller's own variables
 * @param source Watching closure functions
 * @param options Watch options
 */
export function Watch<T>(
  source: (instance: T) => any | Promise<any>,
  options?: WatchOptions,
): any;

/**
 * Overload 2: Monitor Component's variables
 * @param componentClass Component class
 * @param source Watching closure functions
 * @param options Watch options
 */

export function Watch<C>(
  component: Newable<C>,
  source: (comp: C) => any | Promise<any>,
  options?: WatchOptions,
): any;

export function Watch(arg1: any, arg2?: any, arg3?: any) {
  return (target: any, methodName: string) => {
    const existing: WatchMetadata =
      Reflect.getMetadata(VIRID_VUE_METADATA.WATCH, target) || [];

    if (typeof arg2 === "function") {
      // Watch(Component, (c) => c.prop, options)
      existing.push({
        type: "component",
        componentClass: arg1,
        source: arg2,
        options: arg3,
        methodName,
      });
    } else {
      //  Watch((i) => i.prop, options)
      existing.push({
        type: "local",
        componentClass: null,
        source: arg1,
        options: arg2,
        methodName,
      });
    }

    Reflect.defineMetadata(VIRID_VUE_METADATA.WATCH, existing, target);
  };
}

/**
 * Overload 1: Internal Projection
 * @param source Projection closure functions
 */

export function Project<T>(source: (instance: T) => any): any;

/**
 * Overload 1: Component Projection
 * @param source Projection closure functions
 */
export function Project<C>(
  component: new (...args: any[]) => C,
  source: (comp: C) => any,
): any;
// Overload 3: Internal get set projection @Project() Public get name() {}
export function Project<T>(): any;

export function Project(arg1?: any, arg2?: any) {
  return (target: any, key: string, descriptor?: PropertyDescriptor) => {
    const existing: ProjectMetadata =
      Reflect.getMetadata(VIRID_VUE_METADATA.PROJECT, target) || [];
    const isAccessor = !!(descriptor?.get || descriptor?.set);
    if (!arg1 && !arg2 && !isAccessor) {
      MessageWriter.error(
        new Error(
          `[Virid Project] Invalid Usage: @Project() can only be used on getter or setter.`,
        ),
      );
      return;
    }
    const metadata = {
      key,
      isAccessor: isAccessor,
      // 这里的逻辑和 Watch 保持高度一致
      type: typeof arg2 === "function" ? "component" : "local",
      componentClass: typeof arg2 === "function" ? arg1 : null,
      source: typeof arg2 === "function" ? arg2 : isAccessor ? null : arg1,
    } as const;

    existing.push(metadata);
    Reflect.defineMetadata(VIRID_VUE_METADATA.PROJECT, existing, target);
  };
}
/**
 * Add responsiveness to data
 */
export function Responsive(shallow = false) {
  return (target: any, key: string) => {
    // 记录哪些属性需要变成响应式
    const props: ResponsiveMetadata =
      Reflect.getMetadata(VIRID_VUE_METADATA.RESPONSIVE, target) || [];
    props.push({ key, shallow });
    Reflect.defineMetadata(VIRID_VUE_METADATA.RESPONSIVE, props, target);
  };
}

/**
 * Declarative lifecycle hook @OnHook("onMounted")
 */
export function OnHook(
  hookName:
    | "onMounted"
    | "onUnmounted"
    | "onUpdated"
    | "onActivated"
    | "onDeactivated"
    | "onSetup",
) {
  return (target: any, methodName: string) => {
    const existing: OnHookMetadata =
      Reflect.getMetadata(VIRID_VUE_METADATA.LIFE_CIRCLE, target) || [];
    existing.push({ hookName, methodName });
    Reflect.defineMetadata(VIRID_VUE_METADATA.LIFE_CIRCLE, existing, target);
  };
}
/**
 * Universal Hook Injection Decorator
 * Usage: @ Use()=>useRoute() Public route! : RouteLocationNormalized
 */
export function Use(hookFactory: () => any) {
  return (target: any, key: string) => {
    const existing: UseMetadata =
      Reflect.getMetadata(VIRID_VUE_METADATA.HOOK, target) || [];
    existing.push({ key, hookFactory });
    Reflect.defineMetadata(VIRID_VUE_METADATA.HOOK, existing, target);
  };
}
/**
 * Inherit injection decorator
 * Usage: @Inherit(Controller, (instance)=>instance. xxxx) public data! : SomeType
 */
export function Inherit<T>(
  token: Newable<T>,
  id: string,
  selector: (instance: T) => any,
) {
  return (target: any, key: string) => {
    const metadata: InheritMetadata =
      Reflect.getMetadata(VIRID_VUE_METADATA.INHERIT, target) || [];
    metadata.push({ key, token, id, selector });
    Reflect.defineMetadata(VIRID_VUE_METADATA.INHERIT, metadata, target);
  };
}

/**
 * Marking an attribute as injected from the external environment (context)
 */
export function Env() {
  return (target: any, key: string) => {
    const metadata: EnvMetadata =
      Reflect.getMetadata(VIRID_VUE_METADATA.ENV, target) || [];
    metadata.push({ key });
    Reflect.defineMetadata(VIRID_VUE_METADATA.ENV, metadata, target);
  };
}

/**
 * Listener Decorator - Tag Controller's member methods as message listeners
 */
export function Listener(
  config: ListenerConfig = {
    messageClass: null,
    priority: 0,
    batchMode: false,
  },
) {
  return (target: any, key: string, descriptor?: PropertyDescriptor) => {
    if (typeof target === "function") {
      throw new Error(
        `[Virid Listener] Method Type Error: The Method "${key}" is a static method. @Listener can only be used on instance member methods.`,
      );
    }

    // Get parameter type metadata
    const types: Array<any> =
      Reflect.getMetadata("design:paramtypes", target, key) || [];

    // Verify if there are undefined parameters (to prevent circular references or incomplete imports)
    const undefinedIndices = types
      .map((t, i) => (t === undefined ? i : -1))
      .filter((i) => i !== -1);
    if (undefinedIndices.length > 0) {
      throw new Error(
        `[Virid Listener] Parameter Metadata Loss in "${key}": One or more parameters have 'undefined' types. Check indices: [${undefinedIndices.join(", ")}]`,
      );
    }

    // The parameter must have only one
    if (types.length > 1) {
      throw new Error(
        `[Virid Listener] Multiple Parameters Not Allowed: Listener method "${key}" can have at most ONE parameter (BaseMessage subclass or Array).`,
      );
    }

    // Prepare variables for final storage in metadata
    let finalMessageClass = config.messageClass;
    let finalBatchMode = config.batchMode ?? false;

    // Split processing: 0 parameters vs 1 parameter
    if (types.length === 0) {
      // No parameters are allowed, but it must be written in messageClass
      if (!config.messageClass) {
        throw new Error(
          `[Virid Listener] Rule Violation in "${key}": When the method has no parameters, you MUST specify "messageClass" in the decorator options.`,
        );
      }
    } else {
      // There is only one parameter available
      const paramType = types[0];

      if (paramType === Array) {
        // If it is a list (Array), messageClass must be written
        if (!config.messageClass) {
          throw new Error(
            `[Virid Listener] Rule Violation in "${key}": When using batch processing mode with Array, the "messageClass" parameter must be specified in decorator options.`,
          );
        }
        // Batch, verify if it inherits from SingleMessage
        if (!(config.messageClass.prototype instanceof SingleMessage)) {
          throw new Error(
            `[Virid Listener] Type Mismatch in "${key}": Batch processing mode (Array) is only supported for subclasses of SingleMessage.`,
          );
        }
        finalBatchMode = true;
      } else if (
        paramType === BaseMessage ||
        (paramType && paramType.prototype instanceof BaseMessage)
      ) {
        // If it is a single BaseMessage, messageClass cannot be written
        if (config.messageClass) {
          throw new Error(
            `[Virid Listener] Rule Violation in "${key}": Cannot specify "messageClass" in decorator options when it is already declared as a method parameter.`,
          );
        }
        finalMessageClass = paramType;
        // If batchMode is not explicitly specified, batch mode will not be enabled by default for single messages
        finalBatchMode = config.batchMode ?? false;
      } else {
        // I have written parameters, but they are neither BaseMessage nor Array
        throw new Error(
          `[Virid Listener] Invalid Parameter in "${key}": The single parameter must be either a subclass of BaseMessage or an Array.`,
        );
      }
    }

    const listeners: ListenerMetadata =
      Reflect.getMetadata(VIRID_VUE_METADATA.LISTENER, target) || [];

    listeners.push({
      key,
      messageClass: finalMessageClass as any,
      priority: config.priority || 0,
      batchMode: finalBatchMode,
    });

    Reflect.defineMetadata(VIRID_VUE_METADATA.LISTENER, listeners, target);
  };
}
