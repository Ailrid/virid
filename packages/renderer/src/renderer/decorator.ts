/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Renderer
 */
import { Newable } from "@virid/core";
import { type FromMainMessage } from "./message";
import { VIRID_RENDERER_METADATA } from "./constant";
export function FromMain(type: string) {
  return function (target: Newable<FromMainMessage>) {
    Reflect.defineMetadata(VIRID_RENDERER_METADATA.FROMMAIN, type, target);
  };
}
