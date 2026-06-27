/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */
import { type SystemTask } from "../interfaces";
import { MessageWriter } from "./io";

export class MessageRegistry {
  systemTaskMap = new Map<any, SystemTask[]>();

  /**
   * Register the message and corresponding system and return an uninstallation function
   */
  register(
    messageClass: any,
    systemFn: (...args: any[]) => any,
    priority: number = 0,
  ): () => void {
    const systems = this.systemTaskMap.get(messageClass) || [];
    const existingIndex = systems.findIndex(
      (s) =>
        (s.fn as any).systemContext.originalMethod ===
        (systemFn as any).systemContext.originalMethod,
    );
    if (existingIndex === -1) {
      systems.push({ fn: systemFn, priority });
      systems.sort((a, b) => b.priority - a.priority);
      this.systemTaskMap.set(messageClass, systems);
    } else {
      // Check for duplicate registrations
      const funcName = (systemFn as any).methodName;
      const targetClass = (systemFn as any).targetClass;
      MessageWriter.error(
        new Error(
          `[Virid Error] System Already Registered: Message Class ${messageClass.name}, Location ${targetClass.name}.${funcName}`,
        ),
      );
      return () => {};
    }

    return () => {
      const currentSystems = this.systemTaskMap.get(messageClass);
      if (currentSystems) {
        const index = currentSystems.findIndex((s) => s.fn === systemFn);
        if (index !== -1) {
          currentSystems.splice(index, 1);
          // 如果该消息类型没有任何监听者了，清理掉 Key，保持内存干净
          if (currentSystems.length === 0) {
            this.systemTaskMap.delete(messageClass);
          }
        }
      }
    };
  }
}
