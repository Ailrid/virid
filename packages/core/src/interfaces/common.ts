/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */
export type Newable<
  TInstance = unknown,
  TArgs extends unknown[] = any[],
> = new (...args: TArgs) => TInstance;

export interface AppConfig {
  maxDepth?: number;
  enableLog?: boolean;
  manual?: boolean;
}

const defaultConfig: AppConfig = {
  maxDepth: 100,
  enableLog: true,
  manual: false,
};
export { defaultConfig };
