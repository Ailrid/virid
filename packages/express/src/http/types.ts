/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Express
 */
import { type Express, type Request, type Response } from "express";
import { Readable } from "stream";
export interface PluginOptions {
  server: Express;
}
import { EventMessage, MessageWriter } from "@virid/core";
// 定义一个独一无二的“布标”
export type RequestId = number & { readonly __brand: unique symbol };

export abstract class HttpRequestMessage extends EventMessage {
  // id 必须是 RequestId 类型
  constructor(private readonly __virid_express_id: RequestId) {
    super();
  }
  // 暴露一个只读属性给业务层使用
  public get requestId(): RequestId {
    return this.__virid_express_id;
  }
}

export class HttpContext {
  public rc: number = 0;
  private isClosed: boolean = false;

  constructor(
    public readonly id: number,
    public readonly req: Request,
    public readonly res: Response,
    public readonly timestamp: number,
    public readonly route: string,
  ) {}

  /**
   * Increment Reference Count (进入 System)
   */
  inc() {
    this.rc++;
  }

  /**
   * Decrement Reference Count (离开 System)
   * 如果归零且未响应，则判定为孤立响应，强制收割
   */
  dec() {
    this.rc--;
    if (this.rc === 0) {
      this.tryFinalize();
    }
  }

  private tryFinalize() {
    // 如果已经由 System 正常返回
    // 或者已经强制关闭过，则直接跳过
    if (this.res.writableEnded || this.isClosed) return;

    this.isClosed = true;

    // 强制报错并关闭连接
    const errorMsg = `[Virid Express] Request Orphaned: The connection was closed because all systems finished execution without sending a response. 
    Route: ${this.route}
    Uptime: ${Date.now() - this.timestamp}ms`;

    MessageWriter.error(new Error(errorMsg));

    if (!this.res.headersSent) {
      this.res.status(500).json({
        error: "Internal Logic Error",
        message:
          "Request processed but no response was returned by any system.",
      });
    } else {
      // 如果 header 已经发了但没写完，强行结束流
      this.res.end();
    }
  }
}
export abstract class HttpResponse {
  constructor(
    public readonly status: number,
    public readonly data: any = null,
    public readonly headers: Record<string, string> = {},
  ) {}
}

// --- 2xx Success ---
export class OkResponse extends HttpResponse {
  constructor(data: any) {
    super(200, data);
  }
}

export class CreatedResponse extends HttpResponse {
  constructor(data: any) {
    super(201, data);
  }
}

export class NoContentResponse extends HttpResponse {
  constructor() {
    super(204, null);
  }
}

// --- 4xx Client Error ---
export class BadRequestResponse extends HttpResponse {
  constructor(message: string = "Bad Request") {
    super(400, { error: message });
  }
}

export class UnauthorizedResponse extends HttpResponse {
  constructor(message: string = "Unauthorized") {
    super(401, { error: message });
  }
}

export class ForbiddenResponse extends HttpResponse {
  constructor(message: string = "Forbidden") {
    super(403, { error: message });
  }
}

export class NotFoundResponse extends HttpResponse {
  constructor(message: string = "Not Found") {
    super(404, { error: message });
  }
}

export class ConflictResponse extends HttpResponse {
  constructor(message: string = "Conflict") {
    super(409, { error: message });
  }
}

export class UnprocessableEntityResponse extends HttpResponse {
  constructor(errors: any) {
    super(422, { errors });
  }
}

// --- 5xx Server Error ---
export class InternalServerErrorResponse extends HttpResponse {
  constructor(message: string = "Internal Server Error") {
    super(500, { error: message });
  }
}

// --- 万能类 (Custom) ---
export class CustomResponseResponse extends HttpResponse {
  constructor(status: number, data: any, headers: Record<string, string> = {}) {
    super(status, data, headers);
  }
}

export class StreamFileResponse extends HttpResponse {
  constructor(
    public readonly filePath: string,
    public readonly options: any = { dotfiles: "allow" },
  ) {
    super(200);
  }
}

export class StreamResponse {
  constructor(
    public readonly stream: Readable,
    public readonly options: {
      contentType?: string;
      status?: number;
      headers?: Record<string, string>;
    } = {},
  ) {}
}
// --- 辅助工厂函数 ---

/** 200 OK */
export const Ok = (data: any) => new OkResponse(data);

/** 201 Created */
export const Created = (data: any) => new CreatedResponse(data);

/** 204 No Content */
export const NoContent = () => new NoContentResponse();

/** 400 Bad Request */
export const BadRequest = (msg = "Bad Request") => new BadRequestResponse(msg);

/** 401 Unauthorized */
export const Unauthorized = (msg = "Unauthorized") =>
  new UnauthorizedResponse(msg);

/** 403 Forbidden */
export const Forbidden = (msg = "Forbidden") => new ForbiddenResponse(msg);

/** 404 Not Found */
export const NotFound = (msg = "Not Found") => new NotFoundResponse(msg);

/** 500 Internal Error */
export const InternalServerError = (msg = "Internal Server Error") =>
  new InternalServerErrorResponse(msg);

/** 发送本地文件 (自动处理 Range/206) */
export const StreamFile = (path: string, options?: any) =>
  new StreamFileResponse(path, options);
/**
 * 发送流响应
 */
export const Stream = (stream: Readable, options?: StreamResponse["options"]) =>
  new StreamResponse(stream, options);

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly message: string,
  ) {
    super(message);
  }
}
