/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Amber
 */
import { amberComponentStore, amberTickStore } from "./store";
import { VIRID_METADATA } from "../decorators/constants";

export class Amber {
  /**
   * 获取组件当前的逻辑版本号
   */
  public static getVersion(compClass: any): number {
    return Reflect.getMetadata(VIRID_METADATA.VERSION, compClass) || 0;
  }

  public static canUndo(compClass: any): boolean {
    const current = this.getVersion(compClass);
    const min = amberComponentStore.getMinVersion(compClass);

    return current > min;
  }

  public static canRedo(compClass: any): boolean {
    const current = this.getVersion(compClass);
    const max = amberComponentStore.getMaxVersion(compClass);

    return current < max;
  }

  /**
   * 局部撤销：将单个组件回退一个版本
   * 结果：产生新 Tick，代表“我回到了过去”
   */
  public static undo(compClass: any): boolean {
    if (!this.canUndo(compClass)) return false;
    const current = this.getVersion(compClass);
    const result = amberComponentStore.seek(compClass, current - 1);

    return result;
  }

  /**
   * 局部重做：将单个组件向前进一个版本
   */
  public static redo(compClass: any): boolean {
    if (!this.canRedo(compClass)) return false;
    const current = this.getVersion(compClass);
    const result = amberComponentStore.seek(compClass, current + 1);

    return result;
  }
  /**
   * 全局撤销
   */
  public static undoTick(): boolean {
    if (!this.canUndoTick()) return false;
    const targetTick = amberTickStore.currentTick - 1;
    amberTickStore.travel(targetTick);
    return true;
  }

  /**
   * 全局重做
   */
  public static redoTick(): boolean {
    if (!this.canRedoTick()) return false;
    const targetTick = amberTickStore.currentTick + 1;
    amberTickStore.travel(targetTick);
    return true;
  }

  /**
   * UI 状态判断：是否还能点撤销
   */
  public static canUndoTick(): boolean {
    const currentTick = amberTickStore.currentTick;
    const minTick = amberTickStore.getMinTick();

    return currentTick > minTick;
  }

  /**
   * UI 状态判断：是否还能点重做
   */
  public static canRedoTick(): boolean {
    const currentTick = amberTickStore.currentTick;
    const maxTick = amberTickStore.getMaxTick();

    return currentTick < maxTick;
  }

  /**
   * 重置宏观时间轴
   * 清空所有全局快照，用户无法再进行 undoTick/redoTick，
   * 但各个组件当前的微观版本栈保持不变。
   */
  public static resetTick(): void {
    amberTickStore.resetTickStore();
  }

  /**
   * 重置特定组件的历史
   * 该组件的旧版本被物理抹除，当前状态变为 V0。
   * 会自动触发一次 updateTickHistory，记录这一时刻的全局状态。
   */
  public static resetComponent(compClass: any): void {
    amberComponentStore.resetComponent(compClass);
  }
  // 建议添加到 Amber 类中
  public static resetAll(): void {
    // 获取所有存活组件
    const classes = Array.from(amberComponentStore.componentHistory.keys());
    // 清空每个组件（静默重置，不触发 updateTickHistory）
    classes.forEach((compClass) => {
      // 我们可以给 resetComponent 加个参数，或者拆分出一个内部方法
      amberComponentStore.resetComponentInternal(compClass);
    });
    // 重置宏观磁带
    amberTickStore.resetTickStore();
  }
}
