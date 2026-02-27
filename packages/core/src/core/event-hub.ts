/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */
import { MessageWriter } from "./io";
import { EventMessage, SingleMessage } from "./message";

/**
 * @description:  事件中心，存储和分发消息 - 物理隔离 SIGNAL 与 EVENT
 */
export class EventHub {
  // --- SIGNAL 存储 (分类池) ---
  private signalActive = new Map<any, any[]>();
  private signalStaging = new Map<any, any[]>();
  // --- EVENT 存储 (顺序流) ---
  private eventActive: any[] = [];
  private eventStaging: any[] = [];

  /**
   * 写入逻辑：根据消息策略分流
   */
  push(event: any) {
    // 改用 instanceof 判断，与 Dispatcher 保持一致
    if (event instanceof SingleMessage) {
      const type = event.constructor;
      if (!this.signalStaging.has(type)) this.signalStaging.set(type, []);
      this.signalStaging.get(type)!.push(event);
    } else if (event instanceof EventMessage) {
      // EVENT 按顺序推入队列
      this.eventStaging.push(event);
    } else {
      // 如果既不是信号也不是事件，说明该消息没有继承正确的基类
      MessageWriter.error(
        new Error(
          `[Virid Message] Invalid Message:\n${event.constructor.name} must extend SingleMessage or EventMessage`,
        ),
      );
    }
  }

  /**
   * 翻转缓冲区：在 Dispatcher 的 Tick 开始时调用
   */
  flip() {
    // 物理隔离：让 active 永远指向那一帧的快照，Staging 指向全新的容器
    this.signalActive = this.signalStaging;
    this.signalStaging = new Map(); // 不要用 .clear()

    this.eventActive = this.eventStaging;
    this.eventStaging = []; // 不要用 .length = 0
  }
  /**
   * [SIGNAL专用] 批量读取某种类型的信号
   */
  peekSignal<T>(type: new (...args: any[]) => T): T[] {
    return this.signalActive.get(type) || [];
  }

  /**
   * [EVENT专用] 获取当前所有待处理的事件流
   */
  getEventStream(): any[] {
    return this.eventActive;
  }

  /**
   * [新增] 根据索引精准读取 EVENT 里的某个数据
   * 配合 Dispatcher 逐条分发时使用
   */
  peekEventAt(index: number): any {
    return this.eventActive[index];
  }

  /**
   * 清理已处理的内容
   */
  clearSignals(types: Set<any>) {
    types.forEach((type) => this.signalActive.delete(type));
  }

  clearEvents() {
    this.eventActive = [];
  }

  /**
   * 重置所有池子
   */
  reset() {
    this.signalActive.clear();
    this.signalStaging.clear();
    this.eventActive = [];
    this.eventStaging = [];
  }
}
