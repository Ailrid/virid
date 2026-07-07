/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Amber
 */
import {
  type ExecuteHook,
  type TickHook,
  BaseMessage,
  ErrorMessage,
  WarnMessage,
  InfoMessage,
} from "@virid/core";
import { type AmberTickStore, type AmberComponentStore } from "./store";
import { VIRID_AMBER_METADATA } from "../decorators/constant";

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

  const allParams = context.context.params;

  allParams.forEach((paramClass) => {
    if (Reflect.hasMetadata(VIRID_AMBER_METADATA.BACKUP, paramClass)) {
      dirtyBuffer.add(paramClass);
    }
  });
};

export function getAfterTickHooks(
  amberComponentStore: AmberComponentStore,
  amberTickStore: AmberTickStore,
): TickHook {
  return (_context) => {
    if (dirtyBuffer.size === 0) return;

    dirtyBuffer.forEach((compClass) => {
      amberComponentStore.seal(compClass);
    });

    amberTickStore.updateTickHistory(amberComponentStore);

    dirtyBuffer.clear();
  };
}
