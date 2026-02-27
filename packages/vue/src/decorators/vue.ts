/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Vue
 */
import { VIRID_METADATA } from "./constants";
import type { WatchOptions } from "vue";
import { type Newable } from "@virid/core";
import { type ControllerMessage } from "./types";

/**
 * @description:实现Watch
 */

// 重载 1: 监听 Controller 自身变量
export function Watch<T>(
  source: (instance: T) => any,
  options?: WatchOptions,
): any;

// 重载 2: 监听全局 Component 变量
export function Watch<C>(
  component: new (...args: any[]) => C,
  source: (comp: C) => any,
  options?: WatchOptions,
): any;

// 实现逻辑
export function Watch(arg1: any, arg2?: any, arg3?: any) {
  return (target: any, methodName: string) => {
    const existing = Reflect.getMetadata(VIRID_METADATA.WATCH, target) || [];

    if (typeof arg2 === "function") {
      // 重载 2: Watch(Component, (c) => c.prop, options)
      existing.push({
        type: "component",
        componentClass: arg1,
        source: arg2,
        options: arg3,
        methodName,
      });
    } else {
      // 重载 1: Watch((i) => i.prop, options)
      existing.push({
        type: "local",
        source: arg1,
        options: arg2,
        methodName,
      });
    }

    Reflect.defineMetadata(VIRID_METADATA.WATCH, existing, target);
  };
}
/**
 * @description: 实现数据投影
 * 用法：@Project() 或 @Project('a.b.c')
 */
// 重载 1: 内部投影 @Project(i => i.someService.data)
export function Project<T>(source: (instance: T) => any): any;

// 重载 2: 跨组件投影 @Project(UserComponent, c => c.name)
export function Project<C>(
  component: new (...args: any[]) => C,
  source: (comp: C) => any,
): any;

// 实现逻辑
export function Project(arg1: any, arg2?: any) {
  return (
    target: any,
    propertyKey: string,
    descriptor?: PropertyDescriptor,
  ) => {
    const existing = Reflect.getMetadata(VIRID_METADATA.PROJECT, target) || [];

    const metadata = {
      propertyKey,
      isAccessor: !!(descriptor?.get || descriptor?.set),
      // 这里的逻辑和 Watch 保持高度一致
      type: typeof arg2 === "function" ? "component" : "local",
      componentClass: typeof arg2 === "function" ? arg1 : null,
      source: typeof arg2 === "function" ? arg2 : arg1,
    };

    existing.push(metadata);
    Reflect.defineMetadata(VIRID_METADATA.PROJECT, existing, target);
  };
}
/**
 * @description: 给数据增加响应式
 * 用法：@Responsive()
 */
export function Responsive(shallow = false) {
  return (target: any, propertyKey: string) => {
    // 记录哪些属性需要变成响应式
    const props = Reflect.getMetadata(VIRID_METADATA.RESPONSIVE, target) || [];
    props.push({ propertyKey, shallow });
    Reflect.defineMetadata(VIRID_METADATA.RESPONSIVE, props, target);
  };
}

/**
 * @description: 声明式生命周期钩子
 * 用法：@OnHook("onMounted")
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
    const existing =
      Reflect.getMetadata(VIRID_METADATA.LIFE_CIRCLE, target) || [];
    existing.push({ hookName, methodName });
    Reflect.defineMetadata(VIRID_METADATA.LIFE_CIRCLE, existing, target);
  };
}
/**
 * @description: 万能 Hook 注入装饰器
 * 用法：@Use(() => useRoute()) public route!: RouteLocationNormalized
 */
export function Use(hookFactory: () => any) {
  return (target: any, propertyKey: string) => {
    const existing =
      Reflect.getMetadata(VIRID_METADATA.USE_HOOKS, target) || [];
    existing.push({ propertyKey, hookFactory });
    Reflect.defineMetadata(VIRID_METADATA.USE_HOOKS, existing, target);
  };
}
/**
 * @description: Inherit注入装饰器
 * 用法：@Inherit(Controller,(instance) => instance.xxxx) public data!: SomeType
 */
export function Inherit<T>(
  token: new (...args: any[]) => T,
  id: string,
  selector?: (instance: T) => any,
) {
  return (target: any, propertyKey: string) => {
    const metadata = Reflect.getMetadata(VIRID_METADATA.INHERIT, target) || [];
    metadata.push({ propertyKey, token, id, selector });
    Reflect.defineMetadata(VIRID_METADATA.INHERIT, metadata, target);
  };
}

/**
 * @description: 标记一个属性是从外部环境(context)注入的
 * 纯元数据标记，什么也不干，方便后期做自动化文档或 TS 类型提示
 */
export function Env() {
  return (_target: any, _propertyKey: string) => {
    // 即使现在不存元数据，有了这个装饰器，Controller 看起来也会更清晰
  };
}

/**
 * @description: Listener 装饰器 - 标记 Controller 的成员方法为消息监听器
 */
export function Listener<T extends ControllerMessage>(
  eventClass: Newable<T>,
  priority: number = 0,
  single = true,
) {
  return (target: any, propertyKey: string) => {
    // 获取该 Controller 原型上已有的监听器元数据
    const listeners =
      Reflect.getMetadata(VIRID_METADATA.CONTROLLER_LISTENERS, target) || [];

    // 存入当前方法的配置：哪个方法(propertyKey) 听 哪个消息(eventClass)
    listeners.push({
      propertyKey,
      eventClass,
      priority,
      single,
    });

    // 将元数据重新定义回类原型，供 useController 在实例化时扫描
    Reflect.defineMetadata(
      VIRID_METADATA.CONTROLLER_LISTENERS,
      listeners,
      target,
    );
  };
}
