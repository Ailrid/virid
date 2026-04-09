/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Express
 */
import { EventMessage } from "@virid/core";
import { httpContextStore } from "./context";
export type RequestId = number & { readonly __brand: unique symbol };

export class HttpRequestMessage extends EventMessage {
  // id 必须是 RequestId 类型
  constructor(private readonly __virid_express_id: RequestId) {
    super();
    //从context里捞出来自己的,挂上引用计数+1
    httpContextStore.get(this.__virid_express_id)!.inc();
  }
  // 暴露一个只读属性给业务层使用
  public get requestId(): RequestId {
    return this.__virid_express_id;
  }
}
