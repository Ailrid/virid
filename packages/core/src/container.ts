/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */

import { Newable } from "./core";

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

    // 获取/创建 实例
    let instance: T;
    if (binding?.type === "singleton") {
      if (!this.singletonInstances.has(identifier)) {
        this.singletonInstances.set(identifier, new TargetCtor());
      }
      instance = this.singletonInstances.get(identifier);
    } else {
      instance = new TargetCtor();
    }

    // 执行激活钩子 (仅在第一次创建单例或每次创建多例时)
    return onActivate(instance);
  }
}
