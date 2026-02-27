/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Vue
 */
import { VIRID_METADATA } from "@virid/core";
export const VIRID_VUE_METADATA = {
  ...VIRID_METADATA,
  RESPONSIVE: "virid:vue:responsive",
  LIFE_CIRCLE: "virid:vue:life-circle",
  HOOK: "virid:vue:hook",
  LISTENER: "virid:vue:listener",
  INHERIT: "virid:vue:inherit",
  ATTR: "virid:vue:attr",
  PROJECT: "virid:vue:project",
  WATCH: "virid:vue:watch",
} as const;
