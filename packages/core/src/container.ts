/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */

import { Newable } from "./interfaces";

interface Binding {
  type: "singleton" | "transient";
  ctor: Newable<any>;
}

export class ViridContainer {
  private bindings = new Map<any, Binding>();
  private singletonInstances = new Map<any, any>();

  public bind<T>(identifier: Newable<T>) {
    const binding: Binding = { type: "transient", ctor: identifier };
    this.bindings.set(identifier, binding);

    return {
      toSelf: () => ({
        inSingletonScope: () => {
          binding.type = "singleton";
          return {
            onActivation: (fn: any) => {},
          };
        },
      }),
    };
  }

  public get<T>(identifier: Newable<T>, onActivate: (instance: T) => T): T {
    const binding = this.bindings.get(identifier);
    if (!binding) {
      throw new Error(
        `[Virid Container] Unbound Constructor: No binding found for ${identifier.name}`,
      );
    }
    const TargetCtor = binding.ctor;

    // 处理单例逻辑
    if (binding.type === "singleton") {
      if (!this.singletonInstances.has(identifier)) {
        // 第一次创建：实例化 -> 走流水线加工 -> 存入成品
        const rawInstance = new TargetCtor();
        const processedInstance = onActivate(rawInstance);
        this.singletonInstances.set(identifier, processedInstance);
      }
      // 后续直接返回加工后的成品
      return this.singletonInstances.get(identifier);
    }

    // 处理多例（Transient）逻辑
    // 每次都创建新实例并走一遍流水线加工
    const instance = new TargetCtor();
    return onActivate(instance);
  }
}
