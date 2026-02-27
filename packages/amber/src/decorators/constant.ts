/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Amber
 */
import { VIRID_METADATA } from "@virid/core";
export const VIRID_AMBER_METADATA = {
  ...VIRID_METADATA,
  BACKUP: "virid:amber:backup",
  VERSION: "virid:amber:version",
  CUSTOM_METHOD: "virid:amber:custom-method",
} as const;
