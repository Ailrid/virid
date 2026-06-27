/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */

import { Newable } from "./interfaces";
import { VIRID_METADATA } from "./decorators/constant";

interface Binding {
  type: "singleton" | "transient";
  ctor: Newable<any>;
}

export class ViridContainer {
  private bindings = new Map<any, Binding>();
  private singletonInstances = new Map<any, any>();
  private activationHooks: Array<(instance: any) => any> = [];
  /**
   * Register an activation hook
   * @param hook An activation hook
   * @param front Is the hook order inserted from the front or added
   */
  public addActivationHook(hook: (instance: any) => any, front: boolean) {
    if (front) this.activationHooks.unshift(hook);
    else this.activationHooks.push(hook);
  }
  /**
   * Static binding component or controller
   * @param identifier Constructor of components or controllers
   */
  public bind<T>(identifier: Newable<T>) {
    //Check if the constructor has mandatory parameters
    if (identifier.length > 0) {
      throw new Error(
        `[Virid Container] Cannot Bind Component Or Controller: The Class ${identifier.name} should not have mandatory parameters.`,
      );
    }
    if (Reflect.getMetadata(VIRID_METADATA.COMPONENT, identifier)) {
      const binding: Binding = {
        type: "singleton",
        ctor: identifier,
      };
      this.bindings.set(identifier, binding);
    } else if (Reflect.getMetadata(VIRID_METADATA.CONTROLLER, identifier)) {
      const binding: Binding = { type: "transient", ctor: identifier };
      this.bindings.set(identifier, binding);
    } else {
      throw new Error(
        `[Virid Container] Cannot Bind Component Or Controller: The Class ${identifier.name} is not decorated with @Component or @Controller`,
      );
    }
  }
  /**
   * Dynamically register a component
   * @param instance Component instance
   */
  public spawn(instance: object) {
    const identifier = instance.constructor as Newable<any>;
    if (Reflect.hasMetadata(VIRID_METADATA.COMPONENT, identifier)) {
      const binding: Binding = { type: "singleton", ctor: identifier };
      this.bindings.set(identifier, binding);
      this.singletonInstances.set(identifier, instance);
    } else {
      throw new Error(
        `[Virid Container] Cannot spawn Component: The Class ${identifier.name} is not decorated with @Component`,
      );
    }
  }
  /**
   * Obtain a Component or Controller instance
   * @param identifier Constructor of components or controllers
   */
  public get<T>(identifier: Newable<T>): T {
    const binding = this.bindings.get(identifier);
    if (!binding) {
      throw new Error(
        `[Virid Container] Cannot Get Component Or Controller: No binding found for ${identifier}`,
      );
    }
    const TargetCtor = binding.ctor;

    if (binding.type === "singleton") {
      if (!this.singletonInstances.has(identifier)) {
        // first creation
        const rawInstance = new TargetCtor();
        const processedInstance = this.handleActivation(rawInstance);
        this.singletonInstances.set(identifier, processedInstance);
      }
      return this.singletonInstances.get(identifier);
    }

    // Transient
    const instance = new TargetCtor();
    return this.handleActivation(instance);
  }
  private handleActivation<T>(instance: T): T {
    for (const hook of this.activationHooks) {
      instance = hook(instance);
    }
    return instance;
  }
}
