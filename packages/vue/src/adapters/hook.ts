/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Vue
 */
import {
  bindProject,
  bindWatch,
  bindHooks,
  bindUseHooks,
  bindListener,
  GlobalRegistry,
  bindInherit,
} from "./bind";
import { onUnmounted, useAttrs } from "vue";
import { VIRID_VUE_METADATA } from "../decorators/constant";
import { MessageWriter } from "@virid/core";
import { viridApp } from "../app";
/**
 * @description: vue的hooks适配器，注入IOC容器中的Controller实例，并挂在vue的各种方法
 * @param token
 * @return {*}
 */
export function useController<T>(
  token: new (...args: any[]) => T,
  options?: { id?: string; context?: any },
): Readonly<T> {
  const instance = viridApp.get(token) as any;

  //注入vue的乱七八糟的context
  const reactiveContext = options?.context || useAttrs();
  if (reactiveContext) {
    injectContext(reactiveContext, instance);
  }

  // 检查身份 Controller
  const isController = Reflect.hasMetadata(
    VIRID_VUE_METADATA.CONTROLLER,
    token,
  );
  if (!isController) {
    // 确保非 Controller 的实例不能被其他 Controller 访问
    MessageWriter.error(
      new Error(
        `[Virid Controller] ${token.name} is not a Controller.Use @Controller to inject it.`,
      ),
    );
    return;
  }

  //绑定各种魔法装饰器
  const proto = Object.getPrototypeOf(instance);
  // @Project装饰器
  bindProject(proto, instance);
  // @Use装饰器
  bindUseHooks(proto, instance);
  // @Watch装饰器
  const stops = bindWatch(proto, instance);
  // @Listener装饰器
  // 运行时动态挂载监听器
  const unbindList = bindListener(proto, instance);
  // 生命周期钩子
  bindHooks(proto, instance);
  // @Inherit装饰器
  bindInherit(proto, instance);
  //绑定全局注册表
  //如果有id,就去注册
  let unbindRegister = () => true;
  if (options?.id) {
    unbindRegister = GlobalRegistry.set(options?.id, instance);
  }
  onUnmounted(() => {
    stops.forEach((stop) => stop());
    unbindList.forEach((stop) => stop());
    unbindRegister();
    // 自动卸载信号处理器，防止 Controller 销毁后残留
  });

  return instance;
}

/**
u* @description: 把槽或者其他乱七八糟的东西传递过来的上下文注入到controller里
 * @param {*} context 上下文对象
 * @param {*} instance controller实例
 */
function injectContext(context: any, instance: any) {
  if (context && typeof context === "object") {
    Object.keys(context).forEach((key) => {
      Object.defineProperty(instance, key, {
        // Getter 确保了 @Watch 的依赖收集能一路穿透到 Vue 源头
        get: () => context[key],
        // 处理写入逻辑
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
}
