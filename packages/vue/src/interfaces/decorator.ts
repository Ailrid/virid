/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Vue
 */
import { Newable } from "@virid/core";
import { WatchOptions } from "vue";

export interface WatchItem {
  type: "component" | "local";
  componentClass: Newable<any> | null;
  source: (instance: any) => void | Promise<void>;
  options: WatchOptions;
  methodName: string;
}
export type WatchMetadata = WatchItem[];

export interface ProjectItem {
  key: string;
  isAccessor: boolean;
  // 这里的逻辑和 Watch 保持高度一致
  type: "component" | "local";
  componentClass: Newable<any> | null;
  source: (instance: any) => any;
}

export type ProjectMetadata = ProjectItem[];

export interface ResponsiveItem {
  key: string;
  shallow: boolean;
}
export type ResponsiveMetadata = ResponsiveItem[];

export interface OnHookItem {
  hookName:
    | "onMounted"
    | "onUnmounted"
    | "onUpdated"
    | "onActivated"
    | "onDeactivated"
    | "onSetup";
  methodName: string;
}
export type OnHookMetadata = OnHookItem[];

export interface UseItem {
  key: string;
  hookFactory: () => any;
}
export type UseMetadata = UseItem[];

export interface InheritItem {
  key: string;
  token: Newable<any>;
  id: string;
  selector: (instance: any) => any;
}
export type InheritMetadata = InheritItem[];

export interface ListenerItem {
  key: string;
  eventClass: Newable<any>;
  priority: number;
  single: boolean;
}
export type ListenerMetadata = ListenerItem[];
