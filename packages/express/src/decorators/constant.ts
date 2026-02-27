/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Express
 */
import { VIRID_METADATA } from "@virid/core";

export const VIRID_EXPRESS_METADATA = {
  ...VIRID_METADATA,
  HTTPROUTE: "virid:express:route",
  HTTPSYSTEM: "virid:express:system",
  BODY: "virid:express:body",
  QUERY: "virid:express:query",
  HEADERS: "virid:express:header",
  REQUEST: "virid:express:request",
  RESPONSE: "virid:express:response",
  CONTEXT: "virid:express:context",
  PARAMS: "virid:express:params",
  COOKIES: "virid:express:cookie",
} as const;
