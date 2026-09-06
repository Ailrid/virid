/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Express
 */
import { EventMessage } from "@virid/core";
export type RequestId = number & { readonly __brand: unique symbol };

export class HttpRequestMessage extends EventMessage {
  public static incContext(id: RequestId) {}
  // ID must be of type RequestId
  constructor(private readonly __virid_express_id: RequestId) {
    super();
    HttpRequestMessage.incContext(__virid_express_id);
  }
  // expose a read-only attribute for use by the business layer
  public get requestId(): RequestId {
    return this.__virid_express_id;
  }
}
