/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Express
 */
import { type Newable, type SystemContext } from "@virid/core";
import {
  type HttpRouteConfig,
  type HttpRouteInfo,
  type BodyMetadata,
  type HeaderMetadata,
  type QueryMetadata,
  type RequestMetadata,
  type ResponseMetadata,
  type ContextMetadata,
  type ParamMetadata,
  type TransformPipe,
  type CookieMetadata,
  type HttpSystemParams,
  type HttpMetadata,
  type HttpSystemConfig,
} from "../interfaces";
import { HttpContext, HttpRequestMessage, parseRawCookie } from "../http";

import { VIRID_EXPRESS_METADATA } from "./constant";

export function HttpRoute(config: HttpRouteConfig) {
  return (constructor: Newable<HttpRequestMessage>) => {
    const params: string[] = [];
    const pathParts = config.path.split("/");
    pathParts.forEach((part) => {
      if (part.startsWith(":")) {
        params.push(part.substring(1));
      }
    });

    const routeInfo: HttpRouteInfo = {
      ...config,
      httpMessage: constructor,
      params,
    };
    Reflect.defineMetadata(
      VIRID_EXPRESS_METADATA.HTTPROUTE,
      routeInfo,
      constructor,
    );
  };
}

/**
 * Check if there are multiple message type parameters in the parameters
 * @param types Parameter list
 */
function checkMessageParam(types: Array<any>) {
  const foundMatches: { type: Newable<HttpRequestMessage>; idx: number }[] = [];

  types.forEach((type, idx) => {
    const isHttpRequestMessage =
      type === HttpRequestMessage ||
      (type && type.prototype instanceof HttpRequestMessage);

    if (isHttpRequestMessage) {
      foundMatches.push({ type, idx });
    }
  });

  if (foundMatches.length === 0) {
    return null;
  }

  if (foundMatches.length > 1) {
    const errorDetails = foundMatches
      .map((item) => `[Index: ${item.idx}, Name: ${item.type.name}]`)
      .join(", ");

    throw new Error(
      `[Virid System] Multiple Messages: Multiple Message type parameters detected, this is not allowed! specific location: ${errorDetails}`,
    );
  }

  return foundMatches[0];
}

/**
 * @description: 系统装饰器
 * @param priority 优先级，数值越大越早执行
 */
export function HttpSystem(
  params: HttpSystemParams = {
    priority: 0,
    messageClass: null,
  },
) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    if (typeof target !== "function") {
      throw new Error(
        `[Virid System] Method Type Error: The Method ${key} is not a static method, please check if there is a static keyword tag.`,
      );
    }

    const originalMethod = descriptor.value;
    const types: Array<any> = Reflect.getMetadata(
      "design:paramtypes",
      target,
      key,
    );

    // Verify if metadata exists
    if (!types) {
      throw new Error(
        `[Virid System] System Parameter Loss: Unable to recognize system parameters, please confirm if import "reflect-metadata" was introduced at the beginning.`,
      );
    }

    // Verify if there are undefined parameters
    const undefinedIndices = types
      .map((t, i) => (t === undefined ? i : -1))
      .filter((i) => i !== -1);
    if (undefinedIndices.length > 0) {
      throw new Error(
        `[Virid System] Parameter Metadata Loss in "${key}": One or more parameters have 'undefined' types. This usually happens when you forget to add a type annotation or due to circular dependencies. Check parameter at indices: [${undefinedIndices.join(", ")}]`,
      );
    }

    let messageClass: Newable<HttpRequestMessage>;
    // eslint-disable-next-line no-useless-assignment
    let messageIdx: number = -1;
    const matchedMessage = checkMessageParam(types); // { type: any, idx: number } | null
    if (matchedMessage && params.messageClass) {
      throw new Error(
        `[Virid System] Multiple Messages Are Not Allowed: Cannot specify messageClass in decorator options while already declaring it in method parameters at index ${matchedMessage.idx} in ${key}.`,
      );
    }

    if (matchedMessage) {
      messageClass = matchedMessage.type;
      messageIdx = matchedMessage.idx; // In single mode, idx points to the location of a specific BaseMessage subclass
    } else if (params.messageClass) {
      messageClass = params.messageClass;
      messageIdx = -1; // Only provided in the configuration, cannot be found in the parameters, set to -1
    } else {
      throw new Error(
        `[Virid System] System Parameter Loss: Please declare the message type either in method parameters or via the Message decorator options.`,
      );
    }
    const httpMetadata = getHttpMetadata(target, key);

    // Attach contextual information to the packaged function
    const systemContext: SystemContext = {
      params: types,
      targetClass: target,
      methodName: key,
      originalMethod: originalMethod,
    };
    const httpSystemConfig: HttpSystemConfig = {
      httpMetadata: httpMetadata,
      messageClass: messageClass,
      messageIdx: messageIdx,
      priority: params.priority || 0,
      batchMode: false,
    };

    // Purely mounting data without changing the execution logic of the original method
    (descriptor.value as any).systemContext = systemContext;
    (descriptor.value as any).httpSystemConfig = httpSystemConfig;
  };
}

export function Body() {
  return (target: any, key: string, index: number) => {
    if (Reflect.hasOwnMetadata(VIRID_EXPRESS_METADATA.BODY, target, key)) {
      throw new Error(
        `[Virid Express Body] Multiple Body Are Not Allowed: ${key} has multiple @Body() decorators!`,
      );
    }
    const bodyMetadata = { index } as BodyMetadata;
    Reflect.defineMetadata(
      VIRID_EXPRESS_METADATA.BODY,
      bodyMetadata,
      target,
      key,
    );
  };
}

export function Headers() {
  return (target: any, key: string, index: number) => {
    if (Reflect.hasOwnMetadata(VIRID_EXPRESS_METADATA.HEADERS, target, key)) {
      throw new Error(
        `[Virid Express Headers] Multiple Header Are Not Allowed: ${key} has multiple @Headers() decorators!`,
      );
    }
    const headerMetadata = { index } as HeaderMetadata;
    Reflect.defineMetadata(
      VIRID_EXPRESS_METADATA.HEADERS,
      headerMetadata,
      target,
      key,
    );
  };
}

export function Cookies() {
  return (target: any, key: string, index: number) => {
    if (Reflect.hasOwnMetadata(VIRID_EXPRESS_METADATA.COOKIES, target, key)) {
      throw new Error(
        `[Virid Express Cookies] Multiple Header Are Not Allowed: ${key} has multiple @Cookies() decorators!`,
      );
    }
    const cookiesMetadata = { index } as CookieMetadata;
    Reflect.defineMetadata(
      VIRID_EXPRESS_METADATA.COOKIES,
      cookiesMetadata,
      target,
      key,
    );
  };
}

export function Req() {
  return (target: any, key: string, index: number) => {
    if (Reflect.hasOwnMetadata(VIRID_EXPRESS_METADATA.REQUEST, target, key)) {
      throw new Error(
        `[Virid Express Req] Multiple Request Objects Are Not Allowed: ${key} has multiple @Req() decorators!`,
      );
    }
    const requestMetadata: RequestMetadata = { index };
    Reflect.defineMetadata(
      VIRID_EXPRESS_METADATA.REQUEST,
      requestMetadata,
      target,
      key,
    );
  };
}

export function Res() {
  return (target: any, key: string, index: number) => {
    if (Reflect.hasOwnMetadata(VIRID_EXPRESS_METADATA.RESPONSE, target, key)) {
      throw new Error(
        `[Virid Express Res] Multiple Response Objects Are Not Allowed: ${key} has multiple @Res() decorators!`,
      );
    }
    const responseMetadata: ResponseMetadata = { index };
    Reflect.defineMetadata(
      VIRID_EXPRESS_METADATA.RESPONSE,
      responseMetadata,
      target,
      key,
    );
  };
}

export function Ctx() {
  return (target: any, key: string, index: number) => {
    if (Reflect.hasOwnMetadata(VIRID_EXPRESS_METADATA.CONTEXT, target, key)) {
      throw new Error(
        `[Virid Express Ctx] Multiple Context Objects Are Not Allowed: ${key} has multiple @Ctx() decorators!`,
      );
    }
    const contextMetadata: ContextMetadata = { index };
    Reflect.defineMetadata(
      VIRID_EXPRESS_METADATA.CONTEXT,
      contextMetadata,
      target,
      key,
    );
  };
}

export function Query(query: string, pipe?: TransformPipe<any>) {
  return (target: any, key: string, index: number) => {
    const existingMetadata: QueryMetadata =
      Reflect.getOwnMetadata(VIRID_EXPRESS_METADATA.QUERY, target, key) || [];
    const newMetadata = [...existingMetadata, { index, query, pipe }];
    Reflect.defineMetadata(
      VIRID_EXPRESS_METADATA.QUERY,
      newMetadata,
      target,
      key,
    );
  };
}

export function Params(key?: string, pipe?: TransformPipe<any>) {
  return (target: any, keyName: string, index: number) => {
    const existingMetadata: ParamMetadata =
      Reflect.getOwnMetadata(VIRID_EXPRESS_METADATA.PARAMS, target, keyName) ||
      [];
    const newMetadata = [...existingMetadata, { index, key, pipe }];
    Reflect.defineMetadata(
      VIRID_EXPRESS_METADATA.PARAMS,
      newMetadata,
      target,
      keyName,
    );
  };
}

function getHttpMetadata(target: any, key: string): HttpMetadata {
  const bodyMeta: BodyMetadata = Reflect.getOwnMetadata(
    VIRID_EXPRESS_METADATA.BODY,
    target,
    key,
  );
  const headerMeta: HeaderMetadata = Reflect.getOwnMetadata(
    VIRID_EXPRESS_METADATA.HEADERS,
    target,
    key,
  );
  const cookiesMeta: CookieMetadata = Reflect.getOwnMetadata(
    VIRID_EXPRESS_METADATA.COOKIES,
    target,
    key,
  );

  const resMeta: ResponseMetadata = Reflect.getOwnMetadata(
    VIRID_EXPRESS_METADATA.RESPONSE,
    target,
    key,
  );
  const reqMeta: RequestMetadata = Reflect.getOwnMetadata(
    VIRID_EXPRESS_METADATA.REQUEST,
    target,
    key,
  );
  const ctxMeta: ContextMetadata = Reflect.getOwnMetadata(
    VIRID_EXPRESS_METADATA.CONTEXT,
    target,
    key,
  );

  const queryMeta: QueryMetadata =
    Reflect.getOwnMetadata(VIRID_EXPRESS_METADATA.QUERY, target, key) || [];

  const paramMeta: ParamMetadata =
    Reflect.getOwnMetadata(VIRID_EXPRESS_METADATA.PARAMS, target, key) || [];

  return {
    bodyMeta,
    headerMeta,
    queryMeta,
    paramMeta,
    cookiesMeta,
    reqMeta,
    resMeta,
    ctxMeta,
  };
}

export function getHttpArgs(
  index: number,
  context: HttpContext,
  httpMetadata: HttpMetadata,
): any {
  const { req, res } = context;

  // 匹配 @Ctx()
  if (httpMetadata.ctxMeta?.index === index) return context;

  // 匹配 @Param() -> 获取路由参数 (:id 等)
  const paramItem = httpMetadata.paramMeta?.find((p) => p.index === index);
  if (paramItem) {
    let val = paramItem.key ? req.params[paramItem.key] : req.params;

    // 如果有 Pipe 且值不是 undefined，进行转换
    if (paramItem.pipe && val !== undefined) {
      val = paramItem.pipe(val);
    }
    return val;
  }

  // @Body()
  if (httpMetadata.bodyMeta?.index === index) return req.body;

  // @Header()
  if (httpMetadata.headerMeta?.index === index) return req.headers;

  // @Cookie()
  if (httpMetadata.cookiesMeta?.index === index)
    return parseRawCookie(req.headers.cookie);

  // @Req() 和 @Res()
  if (httpMetadata.reqMeta?.index === index) return req;
  if (httpMetadata.resMeta?.index === index) return res;

  // @Query('name')
  const queryItem = httpMetadata.queryMeta?.find((q) => q.index === index);
  if (queryItem) {
    let val = req.query[queryItem.query];
    if (val === undefined) {
      throw new Error(`[Virid Express] Missing Query: "${queryItem.query}"`);
    }

    if (queryItem.pipe) {
      val = queryItem.pipe(val);
    }
    return val;
  }
  return null;
}
