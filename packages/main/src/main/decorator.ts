/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Main
 */
import { Newable } from "@virid/core";
import { type FromRendererMessage } from "./message";
import { VIRID_MAIN_METADATA } from "./constant";
export function FromRenderer(route: string) {
  return function (target: Newable<FromRendererMessage>) {
    Reflect.defineMetadata(VIRID_MAIN_METADATA.FROMRENDERER, route, target);
  };
}
