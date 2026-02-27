/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Amber
 */
import { VIRID_METADATA } from "./constants";
import { type BackupStrategy } from "./types";

/**
 * @description: 标记 Backup 身份并配置自定义备份策略
 * @param strategy 可选的自定义序列化/反序列化/Diff 方案
 */
export function Backup<T extends new (...args: any[]) => any, C = any>(
  strategy?: BackupStrategy<InstanceType<T>, C>,
) {
  return (target: T) => {
    // 标记需要备份
    Reflect.defineMetadata(VIRID_METADATA.BACKUP, true, target);
    // 初始化版本号
    Reflect.defineMetadata(VIRID_METADATA.VERSION, 0, target);
    // 如果用户给了自定义方法，存入元数据
    if (strategy) {
      Reflect.defineMetadata(VIRID_METADATA.CUSTOM_METHOD, strategy, target);
    }
  };
}
