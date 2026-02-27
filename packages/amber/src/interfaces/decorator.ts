/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Amber
 */
export enum RestoreDirection {
  UNDO = "UNDO",
  REDO = "REDO",
}

export interface BackupStrategy<T = any, C = any> {
  /**
   * 自定义序列化：将实例转换为可存储的对象
   */
  serialize?: (instance: T) => C;

  /**
   * 自定义反序列化：将数据灌回实例
   */
  deserialize?: (instance: T, data: C) => void;

  /**
   * 自定义 Diff：返回 true 表示有变化，需要触发备份
   */
  diff?: (oldData: C, instance: T) => boolean;
  onBeforeBackup?: (oldData: C) => void;
  onAfterBackup?: (newData: C) => void;
  onRestore?: (oldData: C, newData: C, direction: RestoreDirection) => void;
}

export type VersionMetadata = number;
export type BackupMetadata = boolean;
export type CustomMethodMetadata = BackupStrategy;
