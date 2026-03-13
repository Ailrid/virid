/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Main
 */
import { EventMessage } from "@virid/core";
export { type SystemContext } from "@virid/core";
/**
 * description: 来自渲染进程的消息
 */
export abstract class FromRendererMessage extends EventMessage {
  //我来自哪？
  public __virid_source: string = "unknown";

  /** 我的目的地是哪儿？
   * 'main': 发给主进程处理
   * 'all': 广播给所有窗口（经过主进程中转）
   * string: 指定某个窗口的 ID (windowId)
   */
  public __virid_target: string = "unknown";

  //我应该在目的地转变成什么消息？
  public __virid_messageType: string = "unknown";
  public senderWindow: Electron.BrowserWindow = null as any;
}

/**
 * description: 要发送给渲染进程的消息
 */
export abstract class ToRendererMessage extends EventMessage {
  // 我来自哪？
  public static __virid_source = "main";
  /** 我的目的地是哪儿？
   * 'all': 广播给所有窗口（经过主进程中转）
   * string: 指定某个窗口的 ID (windowId)
   */
  public abstract __virid_target: string;
  /**
   * 我应该在目的地转变成什么消息？
   */
  public abstract __virid_messageType: string;
}
