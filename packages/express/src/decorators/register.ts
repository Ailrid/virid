/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Express
 */
import { MessageRegistry, MessageWriter, type ViridApp } from "@virid/core";
import { type HttpMethod, type HttpRouteInfo } from "../interfaces";
import { type Express, type Request, type Response } from "express";
import { httpContextStore } from "../http/context";
import { HttpContext, type RequestId } from "../http";
// 临时的注册器
export const stagingSystemRegister = new MessageRegistry();
// 路由注册器
export const httpRouteRegistry = new Map<string, HttpRouteInfo>();

let _internalHttpIdCounter = 0;

/**
 * 注册HttpSystem到app的调度器里
 */
export function registerHttpSystem(app: ViridApp) {
  for (const [
    messageClass,
    systemTasks,
  ] of stagingSystemRegister.systemTaskMap.entries()) {
    for (const task of systemTasks) {
      app.register(messageClass, task.fn, task.priority);
    }
  }
  stagingSystemRegister.systemTaskMap.clear();
}

/**
 * 注册express路由
 */
export function registerHttpRoute(server: Express) {
  for (const [_, routeInfo] of httpRouteRegistry.entries()) {
    const { method, path, httpMessage } = routeInfo;
    const expressMethod = method.toLowerCase() as HttpMethod;

    //挂载
    server[expressMethod](path, (req: Request, res: Response) => {
      // 实例化 Message
      const newId = _internalHttpIdCounter++ >>> 0;
      const message = new httpMessage(newId as RequestId);
      //存一下上下文信息
      httpContextStore.set(
        newId,
        new HttpContext(newId, req, res, Date.now(), path),
      );
      // finish 代表响应已发送，close 代表连接意外中断，两者都应清理
      res.once("finish", () => httpContextStore.delete(newId));
      res.once("close", () => httpContextStore.delete(newId));
      // 触发消息
      MessageWriter.write(message);
    });
  }
}
