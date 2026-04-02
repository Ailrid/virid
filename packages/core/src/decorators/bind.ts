/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */
import { type ObserverItem } from "../interfaces";
import { handleResult } from "./ccs";
import { VIRID_METADATA } from "./constant";
const ARRAY_MUTABLE_METHODS = [
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
];
export function bindObservers(instance: any) {
  if (!instance || typeof instance !== "object") return instance;
  if (
    Object.prototype.hasOwnProperty.call(
      instance,
      "__virid_observer_processed__",
    )
  )
    return instance;

  Object.defineProperty(instance, "__virid_observer_processed__", {
    value: true,
    enumerable: false,
    configurable: true,
  });

  const observerConfigs: ObserverItem[] =
    Reflect.getMetadata(VIRID_METADATA.OBSERVER, instance) || [];

  observerConfigs.forEach(({ propertyKey, callback }) => {
    console.log("instance :>> ", instance);
    console.log("propertyKey :>> ", propertyKey);

    // 创建逻辑单元：一个闭包 Box
    const box = { value: instance[propertyKey] };
    const logicProxy = new Proxy(box, {
      get(target, prop) {
        const value = target.value;

        // 数组变动拦截
        if (
          Array.isArray(value) &&
          ARRAY_MUTABLE_METHODS.includes(prop as string)
        ) {
          return (...args: any[]) => {
            const oldVal = [...value];
            const result = (value as any)[prop].apply(value, args);
            const observerResult = callback.call(instance, oldVal, value);
            handleResult(observerResult);

            return result;
          };
        }
        return value;
      },
      set(target, _prop, newVal) {
        const oldVal = target.value;
        if (newVal === oldVal) return true;

        target.value = newVal;
        const result = callback.call(instance, oldVal, newVal);
        handleResult(result);
        return true;
      },
    });
    // 在 bindObservers 的 forEach 内部
    const getter = () => logicProxy.value;
    (getter as any).__virid_box__ = box; // 重点：把闭包里的 box 暴露给后续插件

    Object.defineProperty(instance, propertyKey, {
      get: getter, // 纯转发
      set: (v) => {
        logicProxy.value = v;
      }, // 纯转发
      enumerable: true,
      configurable: true,
    });

    // 初次递归扫描
    if (box.value && typeof box.value === "object") {
      bindObservers(box.value);
    }
  });

  // 处理未标记但属于子组件的对象
  Reflect.ownKeys(instance).forEach((key) => {
    if (key === "__virid_observer_processed__") return;
    const desc = Object.getOwnPropertyDescriptor(instance, key);
    if (desc && desc.get) return;
    const val = instance[key];
    if (val && typeof val === "object") {
      bindObservers(val);
    }
  });
  return instance;
}
