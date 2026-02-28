/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */
import { type SystemTask } from "../interfaces";
import { MessageWriter } from "./io";

/**
 * @description: 消息注册器 - 负责将系统函数或监听器与消息类型关联
 */
export class MessageRegistry {
  systemTaskMap = new Map<any, SystemTask[]>();

  /**
   * 注册消息并返回一个卸载函数
   * 这种模式能完美适配 Controller 的生命周期销毁
   */
  register(
    messageClass: any,
    systemFn: (...args: any[]) => any,
    priority: number = 0,
  ): () => void {
    const systems = this.systemTaskMap.get(messageClass) || [];
    const existingIndex = systems.findIndex((s) => s.fn === systemFn);
    if (existingIndex === -1) {
      systems.push({ fn: systemFn, priority });
      systems.sort((a, b) => b.priority - a.priority);
      this.systemTaskMap.set(messageClass, systems);
    } else {
      // 检查重复注册
      const funcName = systemFn.name || "Anonymous";
      MessageWriter.error(
        new Error(
          `[Virid Error] System Already Registered:\nClass ${messageClass.name}\nFunction ${funcName}`,
        ),
      );
      return () => {};
    }

    /**
     * 返回卸载函数
     */
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
