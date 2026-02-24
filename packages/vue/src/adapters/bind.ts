/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Vue
 */
import { VIRID_METADATA } from "../decorators/constants";
import {
  watch,
  computed,
  type WatchStopHandle,
  isRef,
  ref,
  shallowReactive,
  onMounted,
  onUnmounted,
  onUpdated,
  onActivated,
  onDeactivated,
  shallowRef,
} from "vue";
import { ControllerMessage } from "../decorators";
import { MessageWriter, type SystemContext } from "@virid/core";
import { viridApp } from "../app";
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
export function bindProject(
  proto: any,
  instance: any,
  rawDeps: Record<string, any>,
) {
  const projects = Reflect.getMetadata(VIRID_METADATA.PROJECT, proto);

  projects?.forEach((config: any) => {
    const { propertyKey, isAccessor, type, componentClass, source } = config;
    let c: any;
    let setter: (val: any) => void = () => {
      MessageWriter.error(
        new Error(
          `[Virid Shield] Property "${propertyKey}" is read-only.\n` +
            `If you need to mutate, define an explicit setter and ensure the dependency is injected.`,
        ),
      );
    };
    // 获取目标对象（确保它是已经 bindResponsive 过的）
    const getTarget = () => {
      const target =
        type === "component" ? viridApp.get(componentClass) : instance;
      if (target && !target.__ccs_processed__) {
        // 兜底：如果没处理过，现场处理（虽然最好在外部流转中处理好）
        bindResponsive(target);
      }
      return target;
    };

    // 手写 get/set (支持提权写入)
    if (isAccessor) {
      const rawDescriptor = Object.getOwnPropertyDescriptor(proto, propertyKey);

      //如果有set，就警告
      if (rawDescriptor?.set) {
        MessageWriter.warn(
          `[Virid Project] Possible Implicit Modification:\nManual Set on "${propertyKey}".` +
            `If this is not intentional, please do not use set.`,
        );
        setter = (val) => {
          // 只有在这里，我们允许绕过 Shield
          const elevatedContext = new Proxy(instance, {
            get(target, key) {
              if (typeof key === "string" && rawDeps[key]) {
                return rawDeps[key]; // 返回未经 Proxy 劫持的原始对象
              }
              return Reflect.get(target, key);
            },
          });
          // 执行用户手写的 setter
          rawDescriptor?.set?.call(elevatedContext, val);
        };
      }
      c = computed({
        get: () => {
          // 这里的 this 绑定必须非常明确
          return rawDescriptor?.get?.call(instance);
        },
        set: setter,
      });
    }
    // 函数式投影 (只读契约)
    else {
      // 处理普通的函数式投影
      c = computed(() => {
        const target = getTarget();
        // 调试用：console.log(`[Project Debug] Tracking ${propertyKey} from`, target);
        return source(target);
      });
    }

    const currentDescriptor = Object.getOwnPropertyDescriptor(
      instance,
      propertyKey,
    );
    if (currentDescriptor && currentDescriptor.configurable === false) return;

    Object.defineProperty(instance, propertyKey, {
      get: () => c.value,
      set: (val) => (c.value = val), // computed 如果没设 setter，这里赋值会报错，符合你 read-only 的预期
      enumerable: true,
      configurable: true,
    });
  });
}
/**
 * @Watch 自动把函数变成watch
 */

export function bindWatch(proto: any, instance: any) {
  const watches: any[] = Reflect.getMetadata(VIRID_METADATA.WATCH, proto) || [];
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
  if (!instance || typeof instance !== "object") return;
  if (instance.__virid_responsive_processed__) return;

  Object.defineProperty(instance, "__virid_responsive_processed__", {
    value: true,
    enumerable: false,
  });

  const props = Reflect.getMetadata(VIRID_METADATA.RESPONSIVE, instance) || [];

  props.forEach((config: any) => {
    const key = config.propertyKey;
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
}
/**
 * 递归物理护盾：将对象及其所有后代变为硬只读
 */
export function createDeepShield(
  target: any,
  rootName: string,
  path: string = "",
): any {
  // 基本类型处理
  if (
    target === null ||
    (typeof target !== "object" && typeof target !== "function")
  ) {
    return target;
  }

  // 防止重复包装
  if (target.__ccs_shield__) return target;

  return new Proxy(target, {
    get(obj, prop) {
      // 内部标识，用于识别是否已被包装
      if (prop === "__ccs_shield__") return true;
      // 允许访问原始对象（仅限框架内部使用）
      if (prop === "__raw__") return obj;

      const value = Reflect.get(obj, prop);
      const currentPath = path ? `${path}.${String(prop)}` : String(prop);
      // 函数拦截
      if (typeof value === "function") {
        return (...args: any[]) => {
          // 检查该方法是否有 @Safe 标记
          // target 可能是实例，元数据通常存在 constructor.prototype 上
          const safeMethods =
            Reflect.getMetadata(
              VIRID_METADATA.SAFE,
              obj.constructor?.prototype,
            ) || new Set();

          if (!safeMethods.has(prop)) {
            const errorMsg = [
              `[Virid Security Violation]`,
              `------------------------------------------------`,
              `Location: ${rootName}.${currentPath}()`,
              `Status: BLOCKED`,
              `Reason: This method is NOT marked with @Safe.`,
              `Constraint: In Virid, UI/Controller can only call READ-ONLY(Safe) methods.`,
              `------------------------------------------------`,
            ].join("\n");
            MessageWriter.error(new Error(errorMsg));
            return null; // 拒绝执行
          }

          // 安全执行：如果是 Safe 的，执行它
          const result = value.apply(obj, args);
          // 对返回值递归套盾
          return createDeepShield(result, rootName, `${currentPath}()`);
        };
      }
      // 自动给子对象也穿上护盾
      return createDeepShield(value, rootName, currentPath);
    },

    set(_obj, prop) {
      const currentPath = path ? `${path}.${String(prop)}` : String(prop);

      // 优雅地失败，并给出修复建议
      const errorMsg = [
        `[Virid Security Violation]`,
        `------------------------------------------------`,
        `Component: ${rootName}`,
        `Code: this.${rootName}.${currentPath}`,
        `Result: Rejected`,
        `Repair suggestion: Please use @ Project (${currentPath}) to create a projection in the Controller.`,
        `------------------------------------------------`,
      ].join("\n");
      MessageWriter.error(new Error(errorMsg));
      return false;
    },

    deleteProperty(_obj, prop) {
      MessageWriter.error(
        new Error(
          `[Virid DeepShield] Physical Protection:\nProhibit Deletion of Component Attributes ${String(prop)}`,
        ),
      );
      return false;
    },

    // 拦截 Object.defineProperty 等底层操作
    defineProperty() {
      MessageWriter.error(
        new Error(
          `[Virid DeepShield] Physical Protection:\nProhibit redefining component attribute structure`,
        ),
      );
      return false;
    },
  });
}

/**
 * 解析 @OnHook 并将其绑定到 Vue 生命周期
 */
export function bindHooks(proto: any, instance: any) {
  const hooks = Reflect.getMetadata(VIRID_METADATA.LIFE_CRICLE, proto);

  hooks?.forEach((config: any) => {
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
  const hooks = Reflect.getMetadata(VIRID_METADATA.USE_HOOKS, proto);

  hooks?.forEach((config: any) => {
    // 在 useController 运行期间执行 hookFactory()
    const hookResult = config.hookFactory();
    // 直接赋值给实例
    instance[config.propertyKey] = hookResult;
  });
}

/**
 * @description: 启动@Listener 为 Controller 实例绑定监听器并返回销毁函数列表
 **/
export function bindListener(proto: any, instance: any): (() => void)[] {
  const listenerConfigs: any[] =
    Reflect.getMetadata(VIRID_METADATA.CONTROLLER_LISTENERS, proto) || [];
  const unbindFunctions: (() => void)[] = [];

  listenerConfigs.forEach(({ propertyKey, eventClass, priority, single }) => {
    const originalMethod = instance[propertyKey];

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
      params: eventClass,
      targetClass: instance.constructor,
      methodName: propertyKey,
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
  const inherits = Reflect.getMetadata(VIRID_METADATA.INHERIT, proto);
  if (!inherits) return;

  // @ts-ignore : token
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  inherits.forEach(({ propertyKey, token, id, selector }) => {
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

    Object.defineProperty(instance, propertyKey, {
      get: () => {
        const val = tunnel.value; // 访问 computed.value
        // 返回时依然套上护盾，确保“弱引用”也是“只读引用”
        return val ? createDeepShield(val, propertyKey, "") : null;
      },
      set: () => {
        MessageWriter.error(
          new Error(
            `[Virid Inherit] No Modification:\nAttempted to set read-only Inherit property: ${propertyKey}`,
          ),
        );
      },
      enumerable: true,
      configurable: true,
    });
  });
}
