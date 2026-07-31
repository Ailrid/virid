/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Vue
 */
import { VIRID_VUE_METADATA } from "../decorators/constant";
import {
  watch,
  computed,
  type WatchStopHandle,
  ref,
  shallowReactive,
  onMounted,
  onUnmounted,
  onUpdated,
  onActivated,
  onDeactivated,
  shallowRef,
  type WritableComputedRef,
} from "vue";
import { MessageWriter, type SystemContext, SystemConfig } from "@virid/core";
import { viridApp } from "../app";
import { createBorrowChecker } from "./borrow_checker";
import {
  type WatchMetadata,
  type ProjectMetadata,
  type InheritMetadata,
  type UseMetadata,
  type ResponsiveMetadata,
  type OnHookMetadata,
  type ListenerMetadata,
  EnvMetadata,
} from "../interfaces";

// Controller Registry
export class GlobalRegistry {
  private static globalRegistry = shallowReactive(new Map<string, any>());
  static set(id: string, instance: any): () => boolean {
    if (!this.globalRegistry.has(id)) {
      this.globalRegistry.set(id, instance);
      return () => {
        this.globalRegistry.delete(id);
        return true;
      };
    } else {
      MessageWriter.error(
        new Error(
          `[Virid UseController] Duplicate ID: Controller ${id} already exists`,
        ),
      );
      return () => false;
    }
  }
  static get(id: string): any {
    if (!this.globalRegistry.has(id)) {
      MessageWriter.error(
        new Error(
          `[Virid UseController] ID Not Found: No Controller found with ID: ${id}`,
        ),
      );
      return null;
    }
    return this.globalRegistry.get(id);
  }
}
/**
 * @Project connects components, only reading the value of one component
 */
export function bindProject(proto: any, instance: any) {
  const projects: ProjectMetadata = Reflect.getMetadata(
    VIRID_VUE_METADATA.PROJECT,
    proto,
  );

  projects?.forEach((config) => {
    const { key, isAccessor, type, componentClass, source } = config;
    let project: WritableComputedRef<any, any>;

    const readOnlySetter = (_val: any) => {
      MessageWriter.error(
        new Error(
          `[Virid Project] Read-only: Property "${key}" in "${instance.constructor.name}" is a protected projection.\n`,
        ),
      );
    };

    if (isAccessor) {
      if (type === "component") {
        MessageWriter.error(
          new Error(
            `[Virid Project] Architecture Violation: Manual get/set is forbidden on ${componentClass} projection "${key}". Please use functional source.`,
          ),
        );
        return;
      }

      // Only non component types have reached this point, supporting read and write operations
      const rawDescriptor = Object.getOwnPropertyDescriptor(proto, key);
      project = computed({
        get: () => rawDescriptor?.get?.call(instance),
        set: (val) => {
          if (rawDescriptor?.set) {
            rawDescriptor.set.call(instance, val);
          } else {
            readOnlySetter(val);
          }
        },
      });
    } else {
      project = computed({
        get: () => {
          const isFromComponent = type === "component";
          const target = isFromComponent
            ? viridApp.get(componentClass)
            : instance;
          const val = source(target);

          // Add borrowing check for data from component
          if (isFromComponent) {
            return createBorrowChecker(val, componentClass!.name, key);
          }

          return val;
        },
        set: readOnlySetter,
      });
    }

    const currentDescriptor = Object.getOwnPropertyDescriptor(instance, key);
    if (currentDescriptor && currentDescriptor.configurable === false) return;

    Object.defineProperty(instance, key, {
      get: () => project.value,
      set: (val) => (project.value = val),
      enumerable: true,
      configurable: true,
    });
  });
}
/**
 * @Watch Automatically turn the function into a watch
 */

export function bindWatch(proto: any, instance: any) {
  const watches: WatchMetadata =
    Reflect.getMetadata(VIRID_VUE_METADATA.WATCH, proto) || [];
  const stops: WatchStopHandle[] = [];

  watches.forEach((config) => {
    const { type, source, methodName, options, componentClass } = config;

    const target =
      type === "component" ? viridApp.get(componentClass) : instance;

    if (target && !target.__ccs_processed__) {
      bindResponsive(target);
    }

    const getter = () => {
      try {
        return source(target);
      } catch (e) {
        MessageWriter.error(
          e as Error,
          `[Virid Watch] Getter error in ${methodName}`,
        );
        return undefined;
      }
    };
    // Use bind to ensure that the 'this' inside the callback function points to the current Controller/Instance
    const callback = (instance[methodName] as any).bind(instance);
    const stop = watch(
      getter,
      (newVal, oldVal) => {
        callback(newVal, oldVal);
      },
      {
        ...options,
      },
    );
    stops.push(stop);
  });

  return stops;
}

/**
 * @Responsive Recursive processing, supporting nesting on the basis of Observer
 */
export function bindResponsive(instance: any) {
  if (!instance || typeof instance !== "object") return instance;
  if (instance.__virid_responsive_processed__) return instance;

  Object.defineProperty(instance, "__virid_responsive_processed__", {
    value: true,
    enumerable: false,
  });

  const props: ResponsiveMetadata =
    Reflect.getMetadata(VIRID_VUE_METADATA.RESPONSIVE, instance) || [];

  props.forEach((config) => {
    const key = config.key;
    const descriptor = Object.getOwnPropertyDescriptor(instance, key);

    // Check if it has been hijacked by bindObservers
    const existingBox = (descriptor?.get as any)?.__virid_box__;

    if (existingBox) {
      const rawValue = existingBox.value;
      const vRef = config.shallow ? shallowRef(rawValue) : ref(rawValue);

      Object.defineProperty(existingBox, "value", {
        get: () => vRef.value,
        set: (val) => {
          vRef.value = val;
        },
        enumerable: true,
        configurable: true,
      });
    } else {
      // Normal attribute, processed according to the original logic
      if (descriptor && descriptor.get) return;

      const rawValue = instance[key];
      const internalState = config.shallow
        ? shallowRef(rawValue)
        : ref(rawValue);

      Object.defineProperty(instance, key, {
        get: () => internalState.value,
        set: (val) => {
          internalState.value = val;
        },
        enumerable: true,
        configurable: true,
      });
    }
  });

  // Recursive processing of sub objects
  Reflect.ownKeys(instance).forEach((key) => {
    if (key === "__virid_responsive_processed__") return;
    const val = instance[key];
    if (val && typeof val === "object") {
      bindResponsive(val);
    }
  });
  return instance;
}

/**
 * Resolve @ OnHook and bind it to the Vue lifecycle
 */
export function bindHooks(proto: any, instance: any) {
  const hooks: OnHookMetadata = Reflect.getMetadata(
    VIRID_VUE_METADATA.LIFE_CIRCLE,
    proto,
  );

  hooks?.forEach((config) => {
    const { hookName, methodName } = config;
    const fn = instance[methodName].bind(instance);

    switch (hookName) {
      case "onMounted":
        onMounted(fn);
        break;
      case "onUnmounted":
        onUnmounted(fn);
        break;
      case "onUpdated":
        onUpdated(fn);
        break;
      case "onActivated":
        onActivated(fn);
        break;
      case "onDeactivated":
        onDeactivated(fn);
        break;
      case "onSetup":
        fn();
        break;
    }
  });
}

/**
 * Execute and bind universal hooks
 */
export function bindUseHooks(proto: any, instance: any) {
  const hooks: UseMetadata = Reflect.getMetadata(
    VIRID_VUE_METADATA.HOOK,
    proto,
  );

  hooks?.forEach((config) => {
    // Execute HookFactory during useController runtime
    const hookResult = config.hookFactory();
    instance[config.key] = hookResult;
  });
}

/**
 * Start @ Listener to bind a listener to the Controller instance and return a list of destruction functions
 **/
export function bindListener(proto: any, instance: any): (() => void)[] {
  const listenerConfigs: ListenerMetadata =
    Reflect.getMetadata(VIRID_VUE_METADATA.LISTENER, proto) || [];
  const unbindFunctions: (() => void)[] = [];

  listenerConfigs.forEach(({ key, messageClass, priority, batchMode }) => {
    const originalMethod = instance[key].bind(instance);

    const listenerContext: SystemContext = {
      params: [messageClass],
      targetClass: instance.constructor,
      methodName: key,
      originalMethod: originalMethod,
    };

    const listenerConfig: SystemConfig = {
      messageClass: messageClass,
      messageIdx: 0,
      batchMode: batchMode,
      priority: priority,
    };
    (instance[key] as any).systemContext = listenerContext;
    (instance[key] as any).systemConfig = listenerConfig;

    const unregister = viridApp.register(instance[key]);
    unbindFunctions.push(unregister);
  });

  return unbindFunctions;
}

/**
 * Activate @ Inherit to enable read-only access to other controllers
 **/
export function bindInherit(proto: any, instance: any) {
  const inherits: InheritMetadata = Reflect.getMetadata(
    VIRID_VUE_METADATA.INHERIT,
    proto,
  );
  if (!inherits) return;

  inherits.forEach(({ key, id, selector }) => {
    const tunnel = computed(() => {
      const target = GlobalRegistry.get(id);
      if (!target) {
        MessageWriter.warn(
          `[Virid Inherit] Warning: Inherit target not found: ${id}`,
        );
        return null;
      }
      return selector ? selector(target) : target;
    });

    Object.defineProperty(instance, key, {
      get: () => {
        const val = tunnel.value;
        return val ? createBorrowChecker(val, key, "") : null;
      },
      set: () => {
        MessageWriter.error(
          new Error(
            `[Virid Inherit] No Modification: Attempted to set read-only Inherit property: ${key}`,
          ),
        );
      },
      enumerable: true,
      configurable: true,
    });
  });
}

/**
 * Inject the context passed over by slots or other miscellaneous things into the controller
 */
export function bindEnv(proto: any, instance: any, context: any) {
  const envs: EnvMetadata = Reflect.getMetadata(VIRID_VUE_METADATA.ENV, proto);
  if (!envs) return;

  envs.forEach(({ key }) => {
    if (key in context === false) {
      MessageWriter.warn(
        `[Virid Context] Env Not Found: The "${key}" is not defined in the context.`,
      );
      return;
    }
    Object.defineProperty(instance, key, {
      get: () => context[key],
      set: (val) => {
        if (context[key] === val) return;
        try {
          context[key] = val;
        } catch (e) {
          MessageWriter.error(
            e as Error,
            `[Virid Context] Set Failed:\n "${key}" is only readable.`,
          );
        }
      },
      enumerable: true,
      configurable: true,
    });
  });
}
