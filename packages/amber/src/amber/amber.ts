/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Amber
 */
import { AmberTickStore, AmberComponentStore } from "./store";
import { VIRID_AMBER_METADATA } from "../decorators/constant";
import { Component } from "@virid/core";

@Component()
export class Amber {
  private amberComponentStore: AmberComponentStore;
  private amberTickStore: AmberTickStore;
  constructor(
    amberComponentStore: AmberComponentStore,
    amberTickStore: AmberTickStore,
  ) {
    this.amberComponentStore = amberComponentStore;
    this.amberTickStore = amberTickStore;
  }
  public getVersion(compClass: any): number {
    return Reflect.getMetadata(VIRID_AMBER_METADATA.VERSION, compClass) || 0;
  }

  public canUndo(compClass: any): boolean {
    const current = this.getVersion(compClass);
    const min = this.amberComponentStore.getMinVersion(compClass);

    return current > min;
  }

  public canRedo(compClass: any): boolean {
    const current = this.getVersion(compClass);
    const max = this.amberComponentStore.getMaxVersion(compClass);

    return current < max;
  }

  public undo(compClass: any): boolean {
    if (!this.canUndo(compClass)) return false;
    const current = this.getVersion(compClass);
    const result = this.amberComponentStore.seek(
      compClass,
      current - 1,
      this.amberTickStore,
    );

    return result;
  }

  public redo(compClass: any): boolean {
    if (!this.canRedo(compClass)) return false;
    const current = this.getVersion(compClass);
    const result = this.amberComponentStore.seek(
      compClass,
      current + 1,
      this.amberTickStore,
    );

    return result;
  }

  public undoTick(): boolean {
    if (!this.canUndoTick()) return false;
    const targetTick = this.amberTickStore.currentTick - 1;
    this.amberTickStore.travel(targetTick, this.amberComponentStore);
    return true;
  }

  public redoTick(): boolean {
    if (!this.canRedoTick()) return false;
    const targetTick = this.amberTickStore.currentTick + 1;
    this.amberTickStore.travel(targetTick, this.amberComponentStore);
    return true;
  }

  /**
   *Is it still possible to cancel
   */
  public canUndoTick(): boolean {
    const currentTick = this.amberTickStore.currentTick;
    const minTick = this.amberTickStore.getMinTick();

    return currentTick > minTick;
  }

  /**
   * Is it still possible to click redo
   */
  public canRedoTick(): boolean {
    const currentTick = this.amberTickStore.currentTick;
    const maxTick = this.amberTickStore.getMaxTick();

    return currentTick < maxTick;
  }

  /**
   *Reset macro timeline
   *Clear all global snapshots, users can no longer perform undo Tick/redo Tick,
   *But the current micro version stack of each component remains unchanged.
   */
  public resetTick(): void {
    this.amberTickStore.resetTickStore(this.amberComponentStore);
  }

  /**
   *Reset the history of a specific component
   *The old version of this component has been physically erased and its current state has changed to V0.
   *It will automatically trigger an updateTickHistory to record the global status at that moment.
   */
  public resetComponent(compClass: any): void {
    this.amberComponentStore.resetComponent(compClass, this.amberTickStore);
  }

  public resetAll(): void {
    // 获取所有存活组件
    const classes = Array.from(
      this.amberComponentStore.componentHistory.keys(),
    );
    // 清空每个组件（静默重置，不触发 updateTickHistory）
    classes.forEach((compClass) => {
      // 我们可以给 resetComponent 加个参数，或者拆分出一个内部方法
      this.amberComponentStore.resetComponentInternal(compClass);
    });
    // 重置宏观磁带
    this.amberTickStore.resetTickStore(this.amberComponentStore);
  }
}
