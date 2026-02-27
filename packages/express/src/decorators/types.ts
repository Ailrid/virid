/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Express
 */
import { type HttpRequestMessage } from "../http";
import { type Newable } from "@virid/core";
// types.ts
export type HttpMethod = "get" | "post" | "put" | "delete" | "patch";

export interface HttpRouteConfig {
  path: string;
  method: HttpMethod;
}

export interface HttpRouteInfo extends HttpRouteConfig {
  httpMessage: Newable<HttpRequestMessage>;
  params: string[];
}

export interface BodyMetadata {
  index: number;
}
export interface CookieMetadata {
  index: number;
}

export interface HeaderMetadata {
  index: number;
}
export type TransformPipe<T> = (value: any) => T;

export type QueryMetadata = QueryItem[];

export interface RequestMetadata {
  index: number;
}
export interface ResponseMetadata {
  index: number;
}

export interface ContextMetadata {
  index: number;
}
export interface QueryItem {
  index: number;
  query: string;
  pipe?: TransformPipe<any>; // 可选的转换管道
}

export interface ParamItem {
  index: number;
  key?: string; // 支持 @Param('id') 或 @Param()
  pipe?: TransformPipe<any>;
}
export type ParamMetadata = ParamItem[];
