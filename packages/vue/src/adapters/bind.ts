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
import { type ControllerMessage } from "../decorators";
import { MessageWriter, type SystemContext } from "@virid/core";
import { viridApp } from "../app";
import { createDeepShield } from "./shield";
import {
  type WatchMetadata,
  type ProjectMetadata,
  type InheritMetadata,
  type UseMetadata,
  type ResponsiveMetadata,
  type OnHookMetadata,
  type ListenerMetadata,
} from "../interfaces";

// controller注册表

export class GlobalRegistry {
  private static globalRegistry = shallowReactive(new Map<string, any>());
  static set(id: string, instance: any): () => boolean {
    if (!this.globalRegistry.has(id)) {
      this.globalRegistry.set(id, instance);
      //返回卸载函数
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
    //如果找不见，直接报错
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
 * @Project 连接component，只读一个component的值
 */
export function bindProject(proto: any, instance: any) {
  const projects: ProjectMetadata = Reflect.getMetadata(
    VIRID_VUE_METADATA.PROJECT,
    proto,
  );

  projects?.forEach((config) => {
    const { key, isAccessor, type, componentClass, source } = config;
    let project: WritableComputedRef<any, any>;

    // 统一报错 Setter
    const readOnlySetter = (_val: any) => {
      MessageWriter.error(
        new Error(
          `[Virid Project] Read-only: Property "${key}" in "${instance.constructor.name}" is a protected projection.\n`,
        ),
      );
    };

    // 手写 Accessor
    if (isAccessor) {
      if (type === "component") {
        MessageWriter.error(
          new Error(
            `[Virid Project] Architecture Violation: Manual get/set is forbidden on ${componentClass} projection "${key}". Please use functional source.`,
          ),
        );
        return;
      }

      // 只有非 component 类型才走到这里，不套盾，支持读写
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
    }
    //函数式投影
    else {
      project = computed({
        get: () => {
          const isFromComponent = type === "component";
          const target = isFromComponent
            ? viridApp.get(componentClass)
            : instance;
          const val = source(target);

          // 来自 component 的数据套盾
          if (isFromComponent) {
            return createDeepShield(val, componentClass.name, key);
          }

          // 来自自己的投影，直接返回
          return val;
        },
        set: readOnlySetter,
      });
    }

    const currentDescriptor = Object.getOwnPropertyDescriptor(
      instance,
      key,
    );
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
 * @Watch 自动把函数变成watch
 */

export function bindWatch(proto: any, instance: any) {
  const watches: WatchMetadata =
    Reflect.getMetadata(VIRID_VUE_METADATA.WATCH, proto) || [];
  const stops: WatchStopHandle[] = [];

  watches.forEach((config) => {
    const { type, source, methodName, options, componentClass } = config;

    // 获取目标实例
    const target =
      type === "component" ? viridApp.get(componentClass) : instance;
    // 确保目标实例已经过响应式处理
    if (target && !target.__ccs_processed__) {
      bindResponsive(target);
    }
    // 封装 getter
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
    // 使用 bind 确保回调函数内部的 this 指向当前的 Controller/Instance
    const callback = (instance[methodName] as any).bind(instance);
    // 执行监听
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
 * @Responsive 递归处理，支持在 Observer 基础上套娃
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

    // 【关键逻辑】检查是否已经被 bindObservers 劫持过
    const existingBox = (descriptor?.get as any)?.__virid_box__;

    // 在 bindResponsive 内部
    if (existingBox) {
      const rawValue = existingBox.value;
      const vRef = config.shallow ? shallowRef(rawValue) : ref(rawValue);
      const autoValueProxy = new Proxy(vRef, {
        get(target, prop) {
          // 当访问这个代理时，它自动去拿 vRef.value 的内容
          const inner = target.value;
          // 如果是函数，需要绑定原始对象
          const val = Reflect.get(inner, prop);
          return typeof val === "function" ? val.bind(inner) : val;
        },
        set(target, prop, newVal) {
          // 它自动写进 vRef.value
          return Reflect.set(target.value, prop, newVal);
        },
      });
      // 现在 logicProxy 访问 existingBox.value 拿到的就是这个 autoValueProxy
      existingBox.value = autoValueProxy;
    } else {
      // 普通属性，按照原逻辑处理
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

  // 递归处理子对象
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
 * 解析 @OnHook 并将其绑定到 Vue 生命周期
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
      // 可以根据需要扩展更多的钩子
    }
  });
}

/**
 * 执行并绑定万能 Hooks
 */
export function bindUseHooks(proto: any, instance: any) {
  const hooks: UseMetadata = Reflect.getMetadata(
    VIRID_VUE_METADATA.HOOK,
    proto,
  );

  hooks?.forEach((config) => {
    // 在 useController 运行期间执行 hookFactory()
    const hookResult = config.hookFactory();
    // 直接赋值给实例
    instance[config.key] = hookResult;
  });
}

/**
 * @description: 启动@Listener 为 Controller 实例绑定监听器并返回销毁函数列表
 **/
export function bindListener(proto: any, instance: any): (() => void)[] {
  const listenerConfigs: ListenerMetadata =
    Reflect.getMetadata(VIRID_VUE_METADATA.LISTENER, proto) || [];
  const unbindFunctions: (() => void)[] = [];

  listenerConfigs.forEach(({ key, eventClass, priority, single }) => {
    const originalMethod = instance[key];

    // 强制只能接受一个参数且是 SingleMessage
    const wrappedHandler = function (msgs: ControllerMessage[]) {
      const sample = Array.isArray(msgs) ? msgs[0] : msgs;
      if (!(sample instanceof eventClass)) {
        // 如果类型不匹配，说明 Dispatcher 路由逻辑或元数据配置有问题
        MessageWriter.error(
          new Error(
            `[Virid Listener] Type Mismatch: Expected ${eventClass.name}, but received ${sample?.constructor.name}`,
          ),
        );
        return null;
      }
      // 只有当确实有消息时才触发，没消息不空跑
      const message: ControllerMessage | ControllerMessage[] =
        single && Array.isArray(msgs) ? msgs[msgs.length - 1] : msgs;
      if (msgs.length > 0) {
        // 直接注入快照数组副本，实现所有权转移
        originalMethod.apply(instance, [message]);
      }
    };

    // 给包装后的函数挂载上下文信息（供 Dispatcher 读取）
    const taskContext: SystemContext = {
      params: [eventClass],
      targetClass: instance.constructor,
      methodName: key,
      originalMethod: originalMethod,
    };
    (wrappedHandler as any).ccsContext = taskContext;

    const unregister = viridApp.register(eventClass, wrappedHandler, priority);
    unbindFunctions.push(unregister);
  });

  return unbindFunctions;
}

/**
 * @description: 启动@Inherit 使能够只读其他的controller
 **/
export function bindInherit(proto: any, instance: any) {
  const inherits: InheritMetadata = Reflect.getMetadata(
    VIRID_VUE_METADATA.INHERIT,
    proto,
  );
  if (!inherits) return;

  // @ts-ignore : token
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  inherits.forEach(({ key, _token, id, selector }) => {
    // 为每个继承属性创建一个私有的 computed 引用
    // 这个 computed 就像一个隧道，一头连着 Registry，一头连着子组件
    const tunnel = computed(() => {
      const target = GlobalRegistry.get(id); // 自动依赖 Registry 的增删
      if (!target) {
        MessageWriter.warn(
          `[Virid Inherit] Warning:\n Inherit target not found: ${id}`,
        );
        return null;
      }
      // 这里的 selector(target) 也会触发依赖收集
      // 如果 target.state.count 变了，这个 computed 也会感知到
      return selector ? selector(target) : target;
    });

    Object.defineProperty(instance, key, {
      get: () => {
        const val = tunnel.value; // 访问 computed.value
        // 返回时依然套上护盾，确保“弱引用”也是“只读引用”
        return val ? createDeepShield(val, key, "") : null;
      },
      set: () => {
        MessageWriter.error(
          new Error(
            `[Virid Inherit] No Modification:\nAttempted to set read-only Inherit property: ${key}`,
          ),
        );
      },
      enumerable: true,
      configurable: true,
    });
  });
}
