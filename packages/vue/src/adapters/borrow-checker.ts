/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Vue
 */
import { MessageWriter } from "@virid/core";
import { VIRID_VUE_METADATA } from "../decorators/constant";

// 在文件顶部定义缓存池
const borrowCache = new WeakMap<any, any>();
/**
 * 递归借用检查代理：将对象及其所有后代变为硬只读
 */
export function createBorrowChecker(
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
  if (borrowCache.has(target)) {
    return borrowCache.get(target);
  }

  const proxy = new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);
      const currentPath = path ? `${path}.${String(prop)}` : String(prop);
      // 函数拦截
      if (typeof value === "function") {
        return (...args: any[]) => {
          if (!isShieldException(obj, prop)) {
            const errorMsg = [
              `[Virid Shield] Rejected`,
              `Method: ${rootName}....${currentPath}()`,
              `Reason: Unauthorized access to unsafe method.`,
            ].join("\n");
            MessageWriter.error(new Error(errorMsg));
            return null;
          }

          // 安全执行：如果是 Safe 的，执行它
          const result = value.apply(obj, args);
          // 对返回值递归借用检查
          return createBorrowChecker(result, rootName, `${currentPath}()`);
        };
      }
      // 自动给子对象也加上借用检查
      return createBorrowChecker(value, rootName, currentPath);
    },

    set(_obj, prop) {
      const currentPath = path ? `${path}.${String(prop)}` : String(prop);

      // 优雅地失败，并给出修复建议
      const errorMsg = [
        `[Virid Borrow Checker]`,
        `------------------------------------------------`,
        `Component: ${rootName}`,
        `Code: ${rootName}....${currentPath}`,
        `Result: Rejected`,
        `Reason: This object is write protected and cannot be modified.`,
        `Stack: ${new Error().stack}`,
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
  borrowCache.set(target, proxy);
  return proxy;
}
/**
 * 判断一个方法是否应该跳过护盾拦截
 */
function isShieldException(obj: any, prop: string | symbol): boolean {
  // 1. 内置协议 (Symbol 和基础 Object 方法)
  const PROTOCOL_WHITELIST = new Set<string | symbol>([
    Symbol.iterator,
    Symbol.asyncIterator,
    Symbol.toStringTag,
    "toString",
    "valueOf",
    "toJSON",
    "constructor",
  ]);
  if (PROTOCOL_WHITELIST.has(prop)) return true;

  // 2. 集合类(Map/Set/Array) 的只读方法白名单
  const constructorName = obj.constructor?.name;

  // 核心修复：补充 Array 的只读操作方法
  const READONLY_COLLECTIONS: Record<string, Set<string | symbol>> = {
    Map: new Set([
      "get",
      "has",
      "keys",
      "values",
      "entries",
      "forEach",
      "size",
    ]),
    Set: new Set(["has", "keys", "values", "entries", "forEach", "size"]),
    Array: new Set([
      "length",
      "map",
      "filter",
      "reduce",
      "slice",
      "find",
      "includes",
      "findIndex",
      "every",
      "some",
      "at",
      "join",
      "concat",
      "flat",
      "flatMap",
      "indexOf",
      "lastIndexOf",
    ]),
    String: new Set([
      "length",
      "slice",
      "substring",
      "substr",
      "split",
      "includes",
      "startsWith",
      "endsWith",
      "indexOf",
      "replace",
      "replaceAll",
      "trim",
      "toLowerCase",
      "toUpperCase",
    ]),
  };

  if (READONLY_COLLECTIONS[constructorName]?.has(prop)) return true;

  // 3. 手动标记的 @Safe 装饰器方法
  const safeMethods = Reflect.getMetadata(VIRID_VUE_METADATA.SAFE, obj);
  if (safeMethods instanceof Set && safeMethods.has(prop)) return true;

  return false;
}
