/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Vue
 */
import { MessageWriter } from "@virid/core";
import { VIRID_VUE_METADATA } from "../decorators/constant";

let isBorrowCheckerEnabled = true;
export function disableBorrowChecker() {
  isBorrowCheckerEnabled = false;
}

const borrowCache = new WeakMap<any, any>();

/**
 * Recursive borrowing check proxy: Make the object and all its descendants hard read-only
 */
export function createBorrowChecker(
  target: any,
  rootName: string,
  path: string = "",
): any {
  if (
    !isBorrowCheckerEnabled ||
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

          const result = value.apply(obj, args);
          return createBorrowChecker(result, rootName, `${currentPath}()`);
        };
      }
      return createBorrowChecker(value, rootName, currentPath);
    },

    set(_obj, prop) {
      const currentPath = path ? `${path}.${String(prop)}` : String(prop);

      // Elegantly fail and provide repair suggestions
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
 * Determine whether a method should skip shield interception
 */
function isShieldException(obj: any, prop: string | symbol): boolean {
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

  const constructorName = obj.constructor?.name;

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

  const safeMethods = Reflect.getMetadata(VIRID_VUE_METADATA.SAFE, obj);
  if (safeMethods instanceof Set && safeMethods.has(prop)) return true;

  return false;
}
