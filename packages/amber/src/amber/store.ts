/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Amber
 */
import { MessageWriter } from "@virid/core";
import { viridApp } from "../app";
import { VIRID_AMBER_METADATA } from "../decorators/constant";
import { RestoreDirection, type PluginOptions } from "../interfaces";
import {
  type VersionMetadata,
  type CustomMethodMetadata,
} from "../interfaces";

import { _serialization, _deserialization, _diff } from "./utils";
let config: Required<PluginOptions> = {
  serialization: _serialization,
  deserialization: _deserialization,
  diff: _diff, // 默认总是备份
};

export function activateConfig(customConfig: PluginOptions) {
  config = Object.assign(config, customConfig);
}

class AmberTickStore {
  // 快照镜像
  private tickHistory: Array<Map<any, any>> = [];

  // 记录数组第 0 位对应的真实 Tick 号
  public baseTick = 0;

  public maxTickLength = 20;
  // 当前处于哪个逻辑 Tick
  public currentTick = 0;

  constructor(maxTickLength: number = 20) {
    this.maxTickLength = maxTickLength;
  }
  /**
   * 获取最小可用Tick
   */
  public getMinTick(): number {
    return this.baseTick;
  }

  /**
   * 获取最大的Tick
   */
  public getMaxTick(): number {
    if (this.tickHistory.length === 0) return 0;
    return this.baseTick + this.tickHistory.length - 1;
  }
  /**
   * 记录当前的宏观快照
   */
  public updateTickHistory() {
    // 剪枝
    if (this.currentTick < this.baseTick + this.tickHistory.length) {
      // 剪掉后面的平行宇宙
      this.tickHistory.splice(this.currentTick - this.baseTick + 1);
    }

    // 增加加新快照
    const snapshot = new Map(amberComponentStore.currentHistory);
    this.tickHistory.push(snapshot);

    // 滑动窗口处理
    if (this.tickHistory.length > this.maxTickLength) {
      this.tickHistory.shift();
      this.baseTick++;
    }
    const newLogicalTick = this.baseTick + this.tickHistory.length - 1;
    // 更新指针到最新产生的这个 Tick
    this.currentTick = newLogicalTick;
  }

  /**
   * 全局时空旅行
   */
  public travel(targetTick: number) {
    // 计算物理索引
    const index = targetTick - this.baseTick;
    const historyMap = this.tickHistory[index];

    if (!historyMap) {
      MessageWriter.error(
        new Error(
          `[Virid Amber] Travel Error: Tick ${targetTick} is out of history range.`,
        ),
      );
      return;
    }

    const direction =
      targetTick < this.currentTick
        ? RestoreDirection.UNDO
        : RestoreDirection.REDO;

    // 准备一个队列，用于最后统一执行钩子
    const restoreQueue: Array<{
      strategy: any;
      oldData: any;
      newData: any;
    }> = [];
    // 遍历快照中的所有组件类
    for (const [compClass, historicalData] of historyMap) {
      const currentData = amberComponentStore.getCurrentData(compClass);
      // 只有数据不一致时才处理
      if (historicalData !== currentData) {
        const oldData = currentData;
        // 执行物理恢复
        amberComponentStore.deserializeComponent(compClass, historicalData);

        // 更新微观层的快照记录
        amberComponentStore.seal(compClass);

        // 收集钩子
        const customMethod:CustomMethodMetadata = Reflect.getMetadata(
          VIRID_AMBER_METADATA.CUSTOM_METHOD,
          compClass,
        );
        if (customMethod?.onRestore) {
          restoreQueue.push({
            strategy: customMethod,
            oldData,
            newData: historicalData,
          });
        }
      }
      const instance = viridApp.get(compClass);
    }

    // 更新宏观时空指针
    this.currentTick = targetTick;

    // 统一派发副作用钩子
    restoreQueue.forEach(({ strategy, oldData, newData }) => {
      strategy.onRestore(oldData, newData, direction);
    });
  }
  /**
   * 重置宏观时间轴
   */
  public resetTickStore() {
    // 彻底清空旧的磁带
    this.tickHistory = [];
    this.baseTick = 0;
    this.currentTick = 0;

    // 立刻保存一份当前的“现状”作为新起点
    this.updateTickHistory();
  }
}

class AmberComponentStore {
  public componentHistory = new Map<any, any[]>();
  // 记录每个组件消失的历史总数
  public biasVersions = new Map<any, number>();
  public maxComponentHistorySize = 20;
  // 记录当前每个组件都是什么版本
  public currentHistory = new Map<any, any>();
  // 记录每个组件消失的历史总数
  constructor(maxComponentHistorySize: number = 20) {
    this.maxComponentHistorySize = maxComponentHistorySize;
  }
  /**
   * 将component 的数据进行序列化
   */
  public serializeComponent(compClass: any) {
    const instance = viridApp.get(compClass);
    if (!instance) {
      MessageWriter.error(
        new Error(
          `[Virid Amber] Serialize Error: Component ${compClass.name} is not registered.`,
        ),
      );
      return null;
    }

    const customMethod:CustomMethodMetadata = Reflect.getMetadata(
      VIRID_AMBER_METADATA.CUSTOM_METHOD,
      compClass,
    );
    const serializeFn = customMethod?.serialize || config.serialization;
    try {
      return serializeFn(instance);
    } catch (e) {
      MessageWriter.error(
        e,
        `[Virid Amber] Serialize Error: Component ${compClass.name} serialization error`,
      );
    }
    return null;
  }
  /**
   * 将component 的数据反序列化
   */
  public deserializeComponent(compClass: any, data: any) {
    const instance = viridApp.get(compClass);
    if (!instance) {
      MessageWriter.error(
        new Error(
          `[Virid Amber]  Deserialize Error: Component ${compClass.name} is not registered.`,
        ),
      );
      return;
    }
    if (!data) {
      MessageWriter.error(
        new Error(
          `[Virid Amber]  Deserialize Error: Component ${compClass.name} data is ${data}!.`,
        ),
      );
      return;
    }
    const customMethod:CustomMethodMetadata = Reflect.getMetadata(
      VIRID_AMBER_METADATA.CUSTOM_METHOD,
      compClass,
    );
    const deserializeFn =
      customMethod?.deserialize || config.deserialization;
    try {
      deserializeFn(instance, data);
    } catch (e) {
      MessageWriter.error(
        e,
        `[Virid Amber] Deserialize Error: Component ${compClass.name} deserialize error`,
      );
    }
    return;
  }
  /**
   * 对比diff
   */
  public diffComponent(compClass: any, old_data: any): boolean {
    const instance = viridApp.get(compClass);
    if (!instance) {
      MessageWriter.error(
        new Error(
          `[Virid Amber] Diff Error: Component ${compClass.name} is not registered.`,
        ),
      );
      return false;
    }
    if (!old_data) {
      MessageWriter.error(
        new Error(
          `[Virid Amber] Diff Error: Component ${compClass.name} data is ${old_data}!.`,
        ),
      );
      return false;
    }
    const customMethod:CustomMethodMetadata = Reflect.getMetadata(
      VIRID_AMBER_METADATA.CUSTOM_METHOD,
      compClass,
    );
    const diffFn = customMethod?.diff || config.diff;
    try {
      return diffFn(instance, old_data);
    } catch (e) {
      MessageWriter.error(
        e,
        `[Virid Amber] Diff Error: Component ${compClass.name} diff error`,
      );
    }
    return false;
  }

  /**
   * 初始化组件的历史记录结构
   */
  public initComponent(instance: any) {
    const compClass = instance.constructor;
    const customMethod:CustomMethodMetadata = Reflect.getMetadata(
      VIRID_AMBER_METADATA.CUSTOM_METHOD,
      compClass,
    );
    const serializeFn = customMethod?.serialize || config.serialization;
    let data;
    try {
      data = serializeFn(instance);
    } catch (e) {
      MessageWriter.error(
        e,
        `[Virid Amber] Serialize Error: Component ${compClass.name} serialization error`,
      );
      return;
    }
    this.componentHistory.set(compClass, []);
    this.biasVersions.set(compClass, 0);

    // 将初始数据推入
    this.componentHistory.get(compClass)!.push(data);
    this.currentHistory.set(compClass, data);

    // 初始版本设为 0
    Reflect.defineMetadata(VIRID_AMBER_METADATA.VERSION, 0, compClass);
  }
  /**
   * 获取组件当前逻辑版本对应的快照数据
   */
  public getCurrentData(compClass: any): any {
    return this.currentHistory.get(compClass);
  }

  /**
   * 获取组件在当前滑动窗口内的最小可用版本
   */
  public getMinVersion(compClass: any): number {
    return this.biasVersions.get(compClass) ?? 0;
  }

  /**
   * 获取组件在当前物理栈内存在的最大版本（包括撤销后的“未来”）
   */
  public getMaxVersion(compClass: any): number {
    const stack = this.componentHistory.get(compClass);
    const bias = this.biasVersions.get(compClass) ?? 0;
    if (!stack || stack.length === 0) return bias;
    return bias + stack.length - 1;
  }

  /**
   * 给一个component 打快照
   * @param compClass 构造函数
   * @returns
   */
  public seal(compClass: any) {
    const stack = this.componentHistory.get(compClass);
    if (!stack) {
      MessageWriter.error(
        new Error(
          `[Virid Amber] Seal Error: Component ${compClass.name} is not initialized.`,
        ),
      );
    }
    const baseVersion = this.biasVersions.get(compClass);

    const currentSnapshot = this.getCurrentData(compClass);
    // diff判断
    if (currentSnapshot && !this.diffComponent(compClass, currentSnapshot)) {
      return;
    }

    const customMethod: CustomMethodMetadata = Reflect.getMetadata(
      VIRID_AMBER_METADATA.CUSTOM_METHOD,
      compClass,
    );
    if (customMethod?.onBeforeBackup) {
      customMethod.onBeforeBackup(currentSnapshot);
    }

    // 剪枝
    const currentLogicalVersion:VersionMetadata =
      Reflect.getMetadata(VIRID_AMBER_METADATA.VERSION, compClass) || 0;
    const latestLogicalVersion = baseVersion + stack.length - 1;
    if (currentLogicalVersion < latestLogicalVersion) {
      stack.splice(currentLogicalVersion - baseVersion + 1);
    }

    // 序列化
    const newData = this.serializeComponent(compClass);
    if (!newData) {
      MessageWriter.error(
        new Error(
          `[Virid Amber] Seal Error: Component ${compClass.name} is not serializable.`,
        ),
      );
      return;
    }
    stack.push(newData);
    this.currentHistory.set(compClass, newData);
    // 滑动窗口与元数据更新
    if (stack.length > this.maxComponentHistorySize) {
      stack.shift();
      this.biasVersions.set(compClass, baseVersion + 1);
    }

    const newLogicalVersion =
      this.biasVersions.get(compClass)! + stack.length - 1;
    Reflect.defineMetadata(
      VIRID_AMBER_METADATA.VERSION,
      newLogicalVersion,
      compClass,
    );
    if (customMethod?.onAfterBackup) {
      customMethod.onAfterBackup(newData);
    }
  }
  /**
   * 回退到指定版本
   * @param compClass component构造函数
   * @param targetVersion 目标版本
   * @returns
   */
  public seek(compClass: any, targetVersion: number): boolean {
    // 边界检查
    const stack = this.componentHistory.get(compClass);
    if (!stack) {
      MessageWriter.error(
        new Error(
          `[Virid Amber] Seal Error: Component ${compClass.name} is not initialized.`,
        ),
      );
      return false;
    }
    const baseVersion = this.biasVersions.get(compClass) || 0;

    const physicalIndex = targetVersion - baseVersion;
    if (physicalIndex < 0 || physicalIndex >= stack.length) return false;

    // 状态对比准备
    const oldData = this.getCurrentData(compClass);
    const newData = stack[physicalIndex];
    const currentVersion:VersionMetadata =
      Reflect.getMetadata(VIRID_AMBER_METADATA.VERSION, compClass) || 0;

    const direction =
      targetVersion < currentVersion
        ? RestoreDirection.UNDO
        : RestoreDirection.REDO;

    // 执行反序列化
    this.deserializeComponent(compClass, newData);

    // 时空指针同步
    this.currentHistory.set(compClass, newData);
    Reflect.defineMetadata(VIRID_AMBER_METADATA.VERSION, targetVersion, compClass);

    // 触发业务钩子
    const customMethod: CustomMethodMetadata = Reflect.getMetadata(
      VIRID_AMBER_METADATA.CUSTOM_METHOD,
      compClass,
    );
    if (customMethod?.onRestore) {
      customMethod.onRestore(oldData, newData, direction);
    }

    // 告诉时间轴，有个零件变了
    amberTickStore.updateTickHistory();
    return true;
  }
  /**
   * 重置逻辑
   */
  public resetComponentInternal(compClass: any) {
    const newData = this.serializeComponent(compClass);
    if (!newData) return;

    // 物理清理
    this.componentHistory.set(compClass, [newData]);
    this.biasVersions.set(compClass, 0);
    this.currentHistory.set(compClass, newData);

    // 元数据归零
    Reflect.defineMetadata(VIRID_AMBER_METADATA.VERSION, 0, compClass);
  }

  public resetComponent(compClass: any) {
    this.resetComponentInternal(compClass);
    // 只有局部重置时，才主动触发宏观记录
    amberTickStore.updateTickHistory();
  }
}

export const amberTickStore = new AmberTickStore();
export const amberComponentStore = new AmberComponentStore();
