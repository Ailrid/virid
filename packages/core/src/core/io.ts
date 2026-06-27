/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */
import { type MessageEngine } from "./engine";
import {
  type BaseMessage,
  ErrorMessage,
  InfoMessage,
  WarnMessage,
} from "./message";
import { type Newable } from "../interfaces";

let activeInstance: MessageEngine | null = null;
export function activateInstance(instance: MessageEngine) {
  activeInstance = instance;
}

function dispatch(message: BaseMessage): void {
  if (activeInstance) {
    activeInstance.dispatch(message);
  } else {
    console.error("[Virid MessageWriter] No active instance found.");
  }
}

export class MessageWriter {
  public static write<T extends BaseMessage, K extends Newable<T>>(
    target: K | T,
    ...args: ConstructorParameters<K>
  ): void {
    const instance =
      typeof target === "function"
        ? new (target as any)(...args)
        : (target as T);

    dispatch(instance);
  }

  public static error(e: Error, context: string = ""): void {
    this.write(new ErrorMessage(e, context));
  }

  public static warn(context: string): void {
    this.write(new WarnMessage(context));
  }
  public static info(context: string): void {
    this.write(new InfoMessage(context));
  }
}
