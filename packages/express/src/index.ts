/*
 * Copyright (c) 2026-present Ailrid
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Description: Add express functionality to virid.
 */
import {
  ViridPlugin,
  type ViridApp,
  MessageRegistry,
  MessageWriter,
  Newable,
  SystemContext,
  BaseMessage,
} from "@virid/core";
import { getHttpArgs } from "./decorators";
import {
  HttpSystemConfig,
  type HttpMethod,
  type HttpRouteInfo,
} from "./interfaces";

import {
  HttpContext,
  HttpError,
  HttpRequestMessage,
  HttpResponse,
  InternalServerError,
  RequestId,
  StreamFileResponse,
  StreamResponse,
} from "./http";

import { PluginOptions } from "./interfaces";
import { type Request, type Response } from "express";
import { VIRID_EXPRESS_METADATA } from "./decorators/constant";
export * from "./http";
export * from "./decorators";

export class ExpressPlugin implements ViridPlugin<PluginOptions> {
  name = "@virid/express";
  // temporary Registry
  private stagingSystemRegister = new MessageRegistry();
  // route Registry
  private httpRouteRegistry = new Map<string, HttpRouteInfo>();

  private httpContextStore = new Map<number, HttpContext>();

  private _internalHttpIdCounter = 0;

  register(systemFn: (...args: any[]) => any): () => void {
    // @ts-expect-error: get systemContext from systemFn
    const systemContext: SystemContext = systemFn.systemContext;
    // @ts-expect-error: get httpSystemConfig from systemFn
    const httpSystemConfig: HttpSystemConfig = systemFn.httpSystemConfig;
    if (!systemContext || !httpSystemConfig) {
      throw new Error(
        `[Virid HttpSystem] HttpSystem Parameter Loss: Please declare ${systemFn.name} using the @HttpSystem decorator first.`,
      );
    }
    this.stagingSystemRegister.register(
      systemContext.targetClass,
      systemFn,
      httpSystemConfig.priority,
    );
    return () => {};
  }

  bindRoute(constructor: Newable<HttpRequestMessage>) {
    const config: HttpRouteInfo = Reflect.getMetadata(
      VIRID_EXPRESS_METADATA.HTTPROUTE,
      constructor,
    );
    if (!config) {
      throw new Error(
        `[Virid Http] Routing Error: ${constructor.name} is not a valid HttpRoute`,
      );
    }
    // Uniqueness verification: Combining Method and Path
    const routeKey = `${config.method}:${config.path}`;
    if (this.httpRouteRegistry.has(routeKey)) {
      throw new Error(
        `[Virid Http] Routing Conflict: The request method ${config.method} for path ${config.path} has already been registered by ${constructor.name}`,
      );
    } else {
      this.httpRouteRegistry.set(routeKey, config);
    }
  }

  install(app: ViridApp, options: PluginOptions) {
    // register for express routing
    for (const [_, routeInfo] of this.httpRouteRegistry.entries()) {
      const { method, path, httpMessage } = routeInfo;
      const expressMethod = method.toLowerCase() as HttpMethod;

      options.server[expressMethod](path, (req: Request, res: Response) => {
        // instantiate Message
        const newId = this._internalHttpIdCounter++ >>> 0;

        // save contextual information
        const context = new HttpContext(newId, req, res, Date.now(), path);
        context.inc();
        this.httpContextStore.set(
          newId,
          new HttpContext(newId, req, res, Date.now(), path),
        );
        const message = new httpMessage(newId as RequestId);
        // finish means the response has been sent, close means the connection was unexpectedly interrupted, both should be cleaned up
        res.once("finish", () => this.httpContextStore.delete(newId));
        res.once("close", () => this.httpContextStore.delete(newId));
        // send message
        MessageWriter.write(message);
      });
    }

    // register HttpSystem into the app's scheduler
    for (const [
      messageClass,
      systemTasks,
    ] of this.stagingSystemRegister.systemTaskMap.entries()) {
      for (const task of systemTasks) {
        const systemFn = task.fn;
        // @ts-expect-error: get systemContext from systemFn
        const systemContext: SystemContext = systemFn.systemContext;
        // @ts-expect-error: get httpSystemConfig from systemFn
        const httpSystemConfig: HttpSystemConfig = systemFn.httpSystemConfig;
        const { httpMetadata, messageClass, messageIdx } = httpSystemConfig;
        const { originalMethod, targetClass } = systemContext;
        const wrappedSystem = (currentMessage: HttpRequestMessage) => {
          // retrieve the context of the current request
          const context = this.httpContextStore.get(currentMessage.requestId);
          if (!context) {
            throw new Error(
              `[Virid Express HttpSystem] Invalid Request Context: The request context for message ${currentMessage.requestId} is missing.`,
            );
          }
          try {
            const args = systemContext.params.map(
              (type: any, index: number) => {
                // If it is a message, inject
                if (index === messageIdx) {
                  return currentMessage;
                } else {
                  // Otherwise, try injecting HTTP parameters or components
                  const arg = getHttpArgs(index, context, httpMetadata);
                  return arg ? arg : app.get(type);
                }
              },
            );
            const result = originalMethod.apply(targetClass, args);
            return result instanceof Promise
              ? result
                  .then((res) => {
                    this.handleResult(res, context);
                  })
                  .catch((error) => {
                    // asynchronous error needs to send 500 to the client
                    this.handleResult(InternalServerError(error), context);
                    // continue throwing, let Dispatcher capture and print detailed stack
                    throw error;
                  })
              : this.handleResult(result, context);
          } catch (error) {
            if (error instanceof HttpError) {
              // if manually throw new HttpError
              this.handleResult(error, context);
            } else {
              // real crash, return 500
              this.handleResult(InternalServerError(error as Error), context);
            }
            throw error; // continue throwing, let Dispatcher capture and print detailed stack
          }
        };
        wrappedSystem.systemContext = systemContext;
        wrappedSystem.httpSystemConfig = httpSystemConfig;
        app.engine.register(messageClass, wrappedSystem, task.priority);
      }
    }
    this.stagingSystemRegister.systemTaskMap.clear();
  }

  handleResult(res: any, context: HttpContext) {
    if (!res) {
      context.dec();
      return;
    }
    const results = Array.isArray(res) ? res : [res];
    results.forEach((item) => {
      if (item instanceof HttpResponse) {
        // if it is a termination response, handle it
        this.handleHttpResponse(item, context);
      } else if (item instanceof HttpError) {
        // handling errors
        context.res.status(item.status).json(item.message);
        this.httpContextStore.delete(context.id);
      } else if (item instanceof BaseMessage) {
        MessageWriter.write(item);
      } else {
        MessageWriter.warn(
          `[Virid Express] Invalid Return Type: ${typeof item}. Expected HttpResponse or Message.`,
        );
      }
    });
    //Whether the system encounters an error or completes execution, handleResult will execute with a reference count of -1 and check if it is 0
    //If it is 0 and it has not been closed yet, then force it to close
    //The first scenario: If handleHttpResponse is executed above, then HttpContext has already been deleted before that
    //The second scenario: If the HttpRequestMessage is forwarded above, it will erase the trace of the system execution, but the HttpContext will not be deleted due to reference counting
    //The third scenario: If other messages or return values are forwarded above, the reference count will be -1 and checked if it is 0. If it is 0, it will be forcibly closed
    context.dec();
  }

  handleHttpResponse(response: HttpResponse, ctx: HttpContext) {
    const { res } = ctx;

    if (response.headers) {
      Object.entries(response.headers).forEach(([k, v]) => res.setHeader(k, v));
    }

    if (response.status) res.status(response.status);

    if (response instanceof StreamFileResponse) {
      // return asynchronous stream and forcefully add an RC extension
      ctx.inc();
      res.sendFile(response.filePath, response.options, (err) => {
        if (!res.headersSent) {
          MessageWriter.error(
            err,
            `[Virid Express] SteamFile Error: Path: ${response.filePath}`,
          );
        }
        ctx.res.end();
        this.httpContextStore.delete(ctx.id);
        ctx.isClosed = true;
        ctx.dec();
      });
      return;
    }
    if (response instanceof StreamResponse) {
      const { stream } = response;
      ctx.inc();
      stream.pipe(res);
      // end of listening, harvest context
      const cleanup = () => {
        if (!this.httpContextStore.has(ctx.id)) return;
        ctx.res.end();
        this.httpContextStore.delete(ctx.id);
        ctx.isClosed = true;
        ctx.dec();
      };
      stream.on("end", cleanup);
      stream.on("error", (err) => {
        if (!res.headersSent) {
          MessageWriter.error(err, `[Virid Express] Stream Error`);
        }
        cleanup();
      });
      stream.on("close", cleanup);
      return;
    }

    res.status(response.status).json(response.data);
    this.httpContextStore.delete(ctx.id);
  }
}
