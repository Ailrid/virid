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
  bindEnv,
} from "./bind";
import { onUnmounted, useAttrs } from "vue";
import { VIRID_VUE_METADATA } from "../decorators/constant";
import { MessageWriter, Newable } from "@virid/core";
import { viridApp } from "../app";
/**
 * @description: Vue hooks adapter, injecting Controller instances into IOC containers, and mounting various methods of Vue
 */
export function useController<T>(
  token: Newable<T>,
  options?: { id?: string; context?: object },
): T {
  const instance = viridApp.get(token) as any;

  const isController = Reflect.hasMetadata(
    VIRID_VUE_METADATA.CONTROLLER,
    token,
  );
  if (!isController) {
    MessageWriter.error(
      new Error(
        `[Virid Controller] ${token.name} is not a Controller.Use @Controller to inject it.`,
      ),
    );
    return null as T;
  }


  const proto = Object.getPrototypeOf(instance);

  const reactiveContext = options?.context || useAttrs();
  if (reactiveContext) {
    bindEnv(proto, instance, reactiveContext);
  }
  bindUseHooks(proto, instance);
  bindInherit(proto, instance);
  bindProject(proto, instance);
  const unbindList = bindListener(proto, instance);
  bindHooks(proto, instance);
  const stops = bindWatch(proto, instance);
  let unbindRegister = () => true;
  if (options?.id) {
    unbindRegister = GlobalRegistry.set(options.id, instance);
  }
  onUnmounted(() => {
    stops.forEach((stop) => stop());
    unbindList.forEach((stop) => stop());
    unbindRegister();
  });

  return instance;
}
