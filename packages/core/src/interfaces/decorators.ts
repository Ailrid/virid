/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */
import { type BaseMessage } from "../core";
import { Newable } from "./common";

export interface SystemParams {
  priority?: number;
  messageClass?: Newable<BaseMessage> | null;
}
export interface MessageMetadata {
  index: number;
  messageClass: Newable<BaseMessage>;
  single: boolean;
}

export interface ObserverItem {
  propertyKey: string;
  callback: (oldVal: any, newVal: any) => void | BaseMessage | BaseMessage;
}
export type ObserverMetadata = ObserverItem[];

export interface SafeMetadata extends Set<string> {}
