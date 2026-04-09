/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Renderer
 */
import { EventMessage } from "@virid/core";
/**
 * RenderMessage: 由主进程发来的消息
 */
export abstract class FromMainMessage extends EventMessage {
  /** 我来自哪？
   */
  public __virid_source: string = "unknown";
  /** 我的目的地是哪儿？
   * 'main': 发给主进程处理
   * 'all': 广播给所有窗口（经过主进程中转）
   * string: 指定某个窗口的 ID (windowId)
   */
  public __virid_target: string = "";
  /**
   * 我应该在目的地转变成什么消息？
   */
  public __virid_messageType: string = "";
}

/**
 * RenderMessage: 由渲染进程发起，目标是主进程或其他窗口
 */
export abstract class ToMainMessage extends EventMessage {
  /** 我来自哪？
   */
  public static __virid_source: string;

  /** 我的目的地是哪儿？
   * 'main': 发给主进程处理
   * 'all': 广播给所有窗口（经过主进程中转）
   * string: 指定某个窗口的 ID (windowId)
   */
  public abstract __virid_target: string;

  /**
   * 我应该在目的地转变成什么消息？
   */
  public abstract __virid_messageType: string;
}
