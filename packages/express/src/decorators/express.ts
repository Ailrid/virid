/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Express
 */
import {
  type Newable,
  type SystemParams,
  type SystemContext,
  type MessageMetadata,
  MessageWriter,
} from "@virid/core";
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
  CookieMetadata,
} from "../interfaces";
import {
  HttpContext,
  HttpError,
  HttpRequestMessage,
  InternalServerError,
  parseRawCookie,
} from "../http";
import { handleResult, httpContextStore } from "../http/context";
import { httpRouteRegistry, stagingSystemRegister } from "./register";
import { VIRID_EXPRESS_METADATA } from "./constant";
import { viridApp } from "../app";
import { getAutoPipe } from "../http";
export function HttpRoute(config: HttpRouteConfig) {
  return (constructor: Newable<HttpRequestMessage>) => {
    // 唯一性校验：组合 Method 和 Path
    const routeKey = `${config.method}:${config.path}`;
    if (httpRouteRegistry.has(routeKey)) {
      MessageWriter.error(
        new Error(
          `[Virid Http] Routing Conflict: The request method ${config.method} for path ${config.path} has already been registered by ${constructor.name}`,
        ),
      );
    }

    // 路径参数解析
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

    // 存入缓冲区
    httpRouteRegistry.set(routeKey, routeInfo);
  };
}

/**
 * @description: 系统装饰器
 * @param priority 优先级，数值越大越早执行
 */
export function HttpSystem(
  params: SystemParams = {
    priority: 0,
    eventClass: null,
  },
) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    // 获得元数据
    const types = Reflect.getMetadata("design:paramtypes", target, key);
    const messageMetadata: MessageMetadata | null =
      Reflect.getMetadata(VIRID_EXPRESS_METADATA.MESSAGE, target, key) || null;
    const httpMetadata = getHttpMetadata(target, key, types);
    // 参数检查
    if (!types) {
      const error = new Error(
        `[Virid HttpSystem] System Parameter Loss:\nUnable to recognize system parameters, please confirm if import "reflection-metadata" was introduced at the beginning!`,
      );
      MessageWriter.error(error);
      return;
    }
    // 检查是否有参数类型丢失
    if (types.some((t: any) => t === undefined)) {
      const error =
        new Error(`[Virid HttpSystem] Parameter Metadata Loss in "${key}": 
  One or more parameters have 'undefined' types. 
  This usually happens when you forget to add a type annotation to a decorated parameter.
  Check parameter at index: ${types.indexOf(undefined)}`);
      MessageWriter.error(error);
      return;
    }

    // 不能同时使用@message() 和 SystemParams
    if (params.eventClass && messageMetadata) {
      MessageWriter.error(
        new Error(
          `[Virid HttpSystem] Multiple Messages Are Not Allowed: Cannot use @ message() and SystemParams simultaneously in ${key}`,
        ),
      );
      return;
    }
    // @message() 和 SystemParams至少得有一个
    if (!params.eventClass && !messageMetadata) {
      MessageWriter.error(
        new Error(
          `[Virid HttpSystem] System Parameter Loss:\nPlease declare the message type using the Message decorator`,
        ),
      );
      return;
    }
    // Message必须是继承自HttpRequestMessage
    const eventClass = params.eventClass ?? messageMetadata.eventClass;
    if (!HttpRequestMessage.isPrototypeOf(eventClass)) {
      MessageWriter.error(
        new Error(
          `[Virid HttpSystem] Wrong Message Type: ${eventClass.name} is not a derived subclass of HttpRequestMessage!`,
        ),
      );
      return;
    }
    //封装system
    const wrappedSystem = (currentMessage: HttpRequestMessage) => {
      // 获取当前请求的上下文
      const context = httpContextStore.get(currentMessage.requestId);
      if (!context) {
        //如果没有context，那直接停止执行
        throw new Error(
          `[Virid Express HttpSystem] Invalid Request Context: The request context for message ${currentMessage.requestId} is missing.`,
        );
      }
      try {
        //每进入一个Httpsystem,增加引用计数指针
        context.inc();
        const args = types.map((type: any, index: number) => {
          // 如果是message，则注入
          // 三个条件缺一不可
          if (messageMetadata && messageMetadata.index == index) {
            if (!(currentMessage instanceof eventClass)) {
              // 如果类型不匹配，说明 Dispatcher 路由逻辑或元数据配置有问题
              const receivedName = (currentMessage as object).constructor.name;
              throw new Error(
                `[Virid Express HttpSystem] Type Mismatch: Expected ${eventClass.name}, but received ${receivedName}`,
              );
            }
            return currentMessage;
          } else {
            return getHttpSystemArgs(type, index, context, httpMetadata);
          }
        });
        // 执行业务逻辑
        const result = originalMethod.apply(target, args);
        // 返回值必须是一个新的HttpRequestMessage数组，或者一个HttpResponse类型
        return result instanceof Promise
          ? result
              .then((res) => {
                handleResult(res, context);
              })
              .catch((error) => {
                // 异步出错要给客户端发 500
                handleResult(InternalServerError(), context);
                // 继续抛出，让 Dispatcher 捕获并打印详细堆栈
                console.log("扔出去错误");
                throw error;
              })
          : handleResult(result, context);
      } catch (error) {
        if (error instanceof HttpError) {
          // 如果手动 throw new HttpError
          handleResult(error, context);
        } else {
          // 真正的崩溃，返回 500
          handleResult(InternalServerError(), context);
        }
        throw error; // 继续抛出给 Dispatcher 记录日志
      }
    };

    // 给包装后的函数挂载上下文信息（供 Dispatcher 读取）
    const systemContext: SystemContext = {
      params: types,
      targetClass: target,
      methodName: key,
      originalMethod: originalMethod,
    };
    (wrappedSystem as any).systemContext = systemContext;
    // 修改方法定义
    descriptor.value = wrappedSystem;
    // 注册到调度中心
    stagingSystemRegister.register(eventClass, wrappedSystem, params.priority);
  };
}

/**
 * @description: 标记参数为 Body
 */

export function Body() {
  return (target: any, key: string, index: number) => {
    if (Reflect.hasOwnMetadata(VIRID_EXPRESS_METADATA.BODY, target, key)) {
      MessageWriter.error(
        new Error(
          `[Virid Express Body] Multiple Body Are Not Allowed: ${key} has multiple @Body() decorators!`,
        ),
      );
      return;
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

/**
 * @description: 标记参数为 Header
 */

export function Headers() {
  return (target: any, key: string, index: number) => {
    if (Reflect.hasOwnMetadata(VIRID_EXPRESS_METADATA.HEADERS, target, key)) {
      MessageWriter.error(
        new Error(
          `[Virid Express Headers] Multiple Header Are Not Allowed: ${key} has multiple @Headers() decorators!`,
        ),
      );
      return;
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

/**
 * @description: 标记参数为 Header
 */

export function Cookies() {
  return (target: any, key: string, index: number) => {
    if (Reflect.hasOwnMetadata(VIRID_EXPRESS_METADATA.COOKIES, target, key)) {
      MessageWriter.error(
        new Error(
          `[Virid Express Cookies] Multiple Header Are Not Allowed: ${key} has multiple @Cookies() decorators!`,
        ),
      );
      return;
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

/**
 * @description: 标记参数为 Request 对象
 */
export function Req() {
  return (target: any, key: string, index: number) => {
    // 检查是否已经定义过 Request 元数据，防止一个方法注入多个 Request 参数
    if (Reflect.hasOwnMetadata(VIRID_EXPRESS_METADATA.REQUEST, target, key)) {
      MessageWriter.error(
        new Error(
          `[Virid Express Req] Multiple Request Objects Are Not Allowed: ${key} has multiple @Req() decorators!`,
        ),
      );
      return;
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

/**
 * @description: 标记参数为 Response 对象
 */
export function Res() {
  return (target: any, key: string, index: number) => {
    // 检查是否已经定义过 Response 元数据
    if (Reflect.hasOwnMetadata(VIRID_EXPRESS_METADATA.RESPONSE, target, key)) {
      MessageWriter.error(
        new Error(
          `[Virid Express Res] Multiple Response Objects Are Not Allowed: ${key} has multiple @Res() decorators!`,
        ),
      );
      return;
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

/**
 * @description: 标记参数为 Context 对象
 */
export function Ctx() {
  return (target: any, key: string, index: number) => {
    // 检查是否已经定义过 context 元数据
    if (Reflect.hasOwnMetadata(VIRID_EXPRESS_METADATA.CONTEXT, target, key)) {
      MessageWriter.error(
        new Error(
          `[Virid Express Ctx] Multiple Context Objects Are Not Allowed: ${key} has multiple @Ctx() decorators!`,
        ),
      );
      return;
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

/**
 * @description: 标记参数为 Query
 */
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

/**
 * @description: 标记参数为指定的路径参数 (如 /user/:id)
 */
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
/**
 * @description: 获得各种元数据
 */
function getHttpMetadata(target: any, key: string, types: any[]) {
  // 获取所有的元数据配置
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
  const rawQueryMeta: QueryMetadata =
    Reflect.getOwnMetadata(VIRID_EXPRESS_METADATA.QUERY, target, key) || [];
  const queryMeta = rawQueryMeta.map((item) => {
    // 如果没指定 pipe，根据 types[item.index] 自动分配
    if (!item.pipe) {
      const paramType = types[item.index];
      item.pipe = getAutoPipe(paramType);
    }
    return item;
  });
  const rawParamMeta: ParamMetadata =
    Reflect.getOwnMetadata(VIRID_EXPRESS_METADATA.PARAMS, target, key) || [];
  const paramMeta = rawParamMeta.map((item) => {
    if (!item.pipe) {
      const paramType = types[item.index];
      item.pipe = getAutoPipe(paramType);
    }
    return item;
  });
  return {
    bodyMeta,
    headerMeta,
    queryMeta,
    cookiesMeta,
    reqMeta,
    resMeta,
    ctxMeta,
    paramMeta,
  };
}

function getHttpSystemArgs(
  type: any,
  index: number,
  context: HttpContext,
  httpMetadata: ReturnType<typeof getHttpMetadata>,
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

  // 匹配 @Body() -> 获取请求体
  if (httpMetadata.bodyMeta?.index === index) return req.body;

  // 匹配 @Header() -> 获取请求头
  if (httpMetadata.headerMeta?.index === index) return req.headers;

  // 匹配 @Cookie() -> 获取Cookie
  if (httpMetadata.cookiesMeta?.index === index)
    return parseRawCookie(req.headers.cookie);

  // 匹配 @Req() 和 @Res() -> 原生 Express 对象
  if (httpMetadata.reqMeta?.index === index) return req;
  if (httpMetadata.resMeta?.index === index) return res;

  // 匹配 @Query('name') -> 获取特定的 Query 参数
  const queryItem = httpMetadata.queryMeta?.find((q) => q.index === index);
  if (queryItem) {
    let val = req.query[queryItem.query];
    if (val === undefined) {
      throw new Error(`[Virid Express] Missing Query: "${queryItem.query}"`);
    }

    // 执行 Pipe 转换
    if (queryItem.pipe) {
      val = queryItem.pipe(val);
    }
    return val;
  }

  // 处理普通的 IOC 容器依赖注入 (DI)
  const param = viridApp.get(type);
  if (!param) {
    throw new Error(
      `[Virid System] Unknown Inject Type: ${type?.name || "Anonymous Class"} at index ${index}. 
      Ensure it is registered in the IOC container or has a proper Http Decorator!`,
    );
  }

  return param;
}
