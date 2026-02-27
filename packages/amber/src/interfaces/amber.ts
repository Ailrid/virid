/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Amber
 */
export interface PluginOptions {
  serialization?: (instance: any) => any;
  deserialization?: (instance: any, data: any) => any;
  diff?: (data: any, instance: any) => boolean;
}
