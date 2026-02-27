/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Express
 */
import { BaseMessage, MessageWriter } from "@virid/core";
import {
  type HttpContext,
  HttpResponse,
  StreamFileResponse,
  HttpError,
  StreamResponse,
} from "./types";
export const httpContextStore = new Map<number, HttpContext>();

/**
 * 统一处理 System 返回值
 * @param res System 函数的返回值
 * @param ctx 当前请求的 HttpContext
 */
export function handleResult(res: any, context: HttpContext) {
  // 支持数组形式的批量返回
  const results = Array.isArray(res) ? res : [res];
  results.forEach((item) => {
    // 处理物理响应 (HttpResponse)

    if (item instanceof HttpResponse) {
      // 如果是终结响应，则处理
      handleHttpResponse(item, context);
    } else if (item instanceof HttpError) {
      // 处理错误
      context.res.status(item.status).json(item.message);
      // 从 store 中移除
      httpContextStore.delete(context.id);
    } else if (item instanceof BaseMessage) {
      // 转发消息
      MessageWriter.write(item);
    }
    // 其他非法类型警告
    else {
      MessageWriter.warn(
        `[Virid Express] Invalid Return Type: ${typeof item}. Expected HttpResponse or Message.`,
      );
    }
  });
  // system不管是出错了还是执行完毕,handleResult都会执行,引用计数-1并检查是否是0
  // 如果是0,而且此时还没关闭，那就强制关闭
  // 第一种情况：上面执行了handleHttpResponse，那么在这之前HttpContext就已经被删除了
  // 第二种情况：上面转发了HttpRequestMessage，那么这会抹除此次system执行的痕迹，但是HttpContext由于引用计数，不会被删除
  // 第三种情况：上面转发了其他消息或者其他的返回值，那么引用计数-1并检查是否是0，如果是0，那么强制关闭
  context.dec();
}

function handleHttpResponse(response: HttpResponse, ctx: HttpContext) {
  const { res } = ctx;
  if (response instanceof StreamFileResponse) {
    //返回异步流，强行增加一个rc续命
    ctx.inc();
    res.sendFile(response.filePath, response.options, (err) => {
      if (err) {
        // 记录错误
        MessageWriter.error(
          err,
          `[Virid Express] StreamFile Error: ${response.filePath}`,
        );
      }
      //强制删除context
      httpContextStore.delete(ctx.id);
      ctx.dec();
    });
    return;
  }
  if (response instanceof StreamResponse) {
    const { stream, status, headers } = response;
    ctx.inc();
    // 写入状态和头
    res.status(status || 200);
    if (headers) {
      Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    }
    // 管道传输
    stream.pipe(res);
    // 监听结束，收割上下文
    const cleanup = () => {
      httpContextStore.delete(ctx.id);
      ctx.dec(); // 触发最后的 finalize
    };
    stream.on("end", cleanup);
    stream.on("error", (err) => {
      MessageWriter.error(err, `[Virid Express] Stream Error`);
      if (!res.headersSent) res.status(500).end();
      cleanup();
    });
    return;
  }
  //其他情况，直接返回
  if (response.headers) {
    Object.entries(response.headers).forEach(([k, v]) => res.setHeader(k, v));
  }
  res.status(response.status).json(response.data);
  //强制删除context
  httpContextStore.delete(ctx.id);
}
