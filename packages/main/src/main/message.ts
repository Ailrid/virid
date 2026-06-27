/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Main
 */
import { EventMessage } from "@virid/core";
export { type SystemContext } from "@virid/core";
/**
 * Message from rendering process
 */
export abstract class FromRendererMessage extends EventMessage {
  /**
   * Where am I from?
   */
  public __virid_source: string = "unknown";
  /**Where is my destination?
   *'main ': Sent to the main process for processing
   *'all': Broadcast to all windows (relayed through the main process)
   *String: Specify the ID of a window (windowId)
   */
  public __virid_target: string = "unknown";

  //What message should I turn into at the destination?
  public __virid_messageType: string = "unknown";
  public senderWindow: Electron.BrowserWindow = null as any;
}

/**
 *Message to be sent to the rendering process
 */
export abstract class ToRendererMessage extends EventMessage {
  /**
   * Where am I from?
   */
  public static __virid_source = "main";
  /**Where is my destination?
   *'all': Broadcast to all windows (relayed through the main process)
   *String: Specify the ID of a window (windowId)
   */
  public abstract __virid_target: string;
  /**
   *What message should I turn into at the destination?
   */
  public abstract __virid_messageType: string;
}
