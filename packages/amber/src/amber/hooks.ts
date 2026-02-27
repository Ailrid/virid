/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Amber
 */
import {
  type ExecuteHook,
  type TickHook,
  AtomicModifyMessage,
  BaseMessage,
  ErrorMessage,
  WarnMessage,
  InfoMessage,
} from "@virid/core";
import { amberComponentStore, amberTickStore } from "./store";
import { VIRID_METADATA } from "../decorators/constants";

const dirtyBuffer = new Set<any>();

export const afterExecuteHooks: ExecuteHook<BaseMessage> = (
  message,
  context,
) => {
  if (
    message instanceof ErrorMessage ||
    message instanceof WarnMessage ||
    message instanceof InfoMessage
  )
    return;

  const allParams =
    message instanceof AtomicModifyMessage
      ? [...context.context.params, message.ComponentClass]
      : context.context.params;

  allParams.forEach((paramClass) => {
    if (Reflect.hasMetadata(VIRID_METADATA.BACKUP, paramClass)) {
      dirtyBuffer.add(paramClass);
    }
  });
};

export const afterTickHooks: TickHook = (_context) => {
  if (dirtyBuffer.size === 0) return;

  // 微观更新
  dirtyBuffer.forEach((compClass) => {
    amberComponentStore.seal(compClass);
  });

  // 宏观更新
  amberTickStore.updateTickHistory();

  // 清理缓存，准备下一轮
  dirtyBuffer.clear();
};
