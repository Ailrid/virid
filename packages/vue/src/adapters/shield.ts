/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Vue
 */
import { MessageWriter } from "@virid/core";
import { VIRID_VUE_METADATA } from "../decorators/constant";

// 在文件顶部定义缓存池
const shieldCache = new WeakMap<any, any>();
/**
 * 递归物理护盾：将对象及其所有后代变为硬只读
 */
export function createDeepShield(
  target: any,
  rootName: string,
  path: string = "",
): any {
  // 基本类型处理
  if (
    target === null ||
    (typeof target !== "object" && typeof target !== "function")
  ) {
    return target;
  }
  if (shieldCache.has(target)) {
    return shieldCache.get(target);
  }

  const proxy = new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);
      const currentPath = path ? `${path}.${String(prop)}` : String(prop);
      // 函数拦截
      if (typeof value === "function") {
        return (...args: any[]) => {
          // 检查该方法是否有 @Safe 标记
          const safeMethods =
            Reflect.getMetadata(VIRID_VUE_METADATA.SAFE, obj) ||
            new Set();
          if (!safeMethods.has(prop)) {
            const errorMsg = [
              `[Virid Shield]`,
              `------------------------------------------------`,
              `Code: ${rootName}....${currentPath}()`,
              `Result: Rejected`,
              `Reason: This method is NOT marked with @Safe.`,
              `------------------------------------------------`,
            ].join("\n");
            MessageWriter.error(new Error(errorMsg));
            return null; // 拒绝执行
          }

          // 安全执行：如果是 Safe 的，执行它
          const result = value.apply(obj, args);
          // 对返回值递归套盾
          return createDeepShield(result, rootName, `${currentPath}()`);
        };
      }
      // 自动给子对象也穿上护盾
      return createDeepShield(value, rootName, currentPath);
    },

    set(_obj, prop) {
      const currentPath = path ? `${path}.${String(prop)}` : String(prop);

      // 优雅地失败，并给出修复建议
      const errorMsg = [
        `[Virid Shield]`,
        `------------------------------------------------`,
        `Component: ${rootName}`,
        `Code: ${rootName}....${currentPath}`,
        `Result: Rejected`,
        `Reason: This object is write protected and cannot be modified.`,
        `------------------------------------------------`,
      ].join("\n");
      MessageWriter.error(new Error(errorMsg));
      return false;
    },
    deleteProperty(_obj, prop) {
      MessageWriter.error(
        new Error(
          `[Virid Shield] Physical Protection:\nProhibit Deletion of Component Attributes ${String(prop)}`,
        ),
      );
      return false;
    },
    defineProperty() {
      MessageWriter.error(
        new Error(
          `[Virid Shield] Physical Protection:\nProhibit redefining component attribute structure`,
        ),
      );
      return false;
    },
  });
  shieldCache.set(target, proxy);
  return proxy;
}
