/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Express
 */
import { MessageWriter } from "@virid/core";
import { HttpError } from ".";
import { type TransformPipe } from "../interfaces";

export function ParseIntPipe(val: string) {
  const res = parseInt(val, 10);
  if (isNaN(res))
    throw new HttpError(400, `Validation failed: "${val}" is not a number.`);
  return res;
}

export function ParseBoolPipe(val: string) {
  if (val === "true" || val === "1") return true;
  if (val === "false" || val === "0") return false;
  return !!val;
}

const autoPipeMap = new Map<any, TransformPipe<any>>();
autoPipeMap.set(Number, ParseIntPipe);
autoPipeMap.set(Boolean, ParseBoolPipe);

export function addAutoPipe<T>(type: T, pipe: TransformPipe<T>) {
  if (autoPipeMap.has(type)) {
    MessageWriter.error(
      new Error(
        `[Virid Express Pipe] Repeated Pipe: Auto pipe for ${type} has already been registered.`,
      ),
    );
    return;
  }
  autoPipeMap.set(type, pipe);
}

export function getAutoPipe<T>(type: T): TransformPipe<T> | undefined {
  return autoPipeMap.get(type);
}

export function parseRawCookie(
  cookieHeader: string | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};

  if (!cookieHeader) return result;
  const pairs = cookieHeader.split(";");

  for (const pair of pairs) {
    const indexOfEq = pair.indexOf("=");
    if (indexOfEq === -1) continue;

    // 提取 key 和 value，并进行 trim 处理
    const key = pair.substring(0, indexOfEq).trim();
    if (!key) continue;

    let value = pair.substring(indexOfEq + 1).trim();

    if (value[0] === '"' && value[value.length - 1] === '"') {
      value = value.slice(1, -1);
    }

    try {
      result[key] = value.includes("%") ? decodeURIComponent(value) : value;
    } catch (e) {
      result[key] = value;
    }
  }

  return result;
}
