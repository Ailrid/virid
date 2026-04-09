/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Amber
 */

import { PluginOptions } from "../interfaces";

/**
 * 默认 serialization
 */
export function _serialization(instance: any, depth = 5): any {
  if (instance === null || typeof instance !== "object") return instance;
  if (depth <= 0) return Array.isArray(instance) ? [] : {};

  if (Array.isArray(instance)) {
    return instance.map((item) => _serialization(item, depth - 1));
  }

  const snapshot: any = {};
  const keys = Object.keys(instance);

  for (const key of keys) {
    if (key.startsWith("_")) continue;

    const value = instance[key];
    if (typeof value === "function") continue;

    snapshot[key] =
      typeof value === "object" && value !== null
        ? _serialization(value, depth - 1)
        : value;
  }
  return snapshot;
}
/**
 * 默认 deserialization
 */
export function _deserialization(instance: any, snapshot: any) {
  if (!instance || !snapshot) return;

  Object.keys(snapshot).forEach((key) => {
    const newVal = snapshot[key];
    const oldVal = instance[key];
    // 继续递归，而不是直接覆盖对象引用
    if (
      oldVal &&
      typeof oldVal === "object" &&
      newVal &&
      typeof newVal === "object" &&
      !Array.isArray(newVal)
    ) {
      _deserialization(oldVal, newVal);
    } else {
      // 直接赋值
      instance[key] = newVal;
    }
  });
}
/**
 * 默认 Diff
 */
export function _diff(oldData: any, instance: any, depth = 3): boolean {
  // 基础类型或引用相同，直接认为没变
  if (oldData === instance) return false;

  // 类型不一致，肯定变了
  if (
    typeof oldData !== typeof instance ||
    oldData === null ||
    instance === null
  ) {
    return true;
  }
  // 处理数组
  if (Array.isArray(oldData)) {
    if (!Array.isArray(instance) || oldData.length !== instance.length)
      return true;
    for (let i = 0; i < oldData.length; i++) {
      if (_diff(oldData[i], instance[i], depth - 1)) return true;
    }
    return false;
  }

  // 处理对象
  const keys = Object.keys(oldData);

  for (const key of keys) {
    const valOld = oldData[key];
    const valNew = instance[key];

    if (typeof valOld === "object" && valOld !== null) {
      // 达到最大深度限制，不再递归，保守起见认为变了
      if (depth <= 0) continue;

      if (_diff(valOld, valNew, depth - 1)) return true;
    } else {
      // 基础类型对比
      if (valOld !== valNew) return true;
    }
  }
  return false;
}

export const defaultOptions: PluginOptions = {
  serialization: _serialization,
  deserialization: _deserialization,
  diff: _diff,
  maxComponentLength: 20,
  maxTickLength: 20,
};
