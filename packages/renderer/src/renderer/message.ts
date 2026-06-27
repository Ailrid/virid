/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Renderer
 */
import { EventMessage } from "@virid/core";
/**
 * RenderMessage: Message sent by the main process
 */
export abstract class FromMainMessage extends EventMessage {
  /** Where am I from?
   */
  public __virid_source: string = "unknown";
  /**Where is my destination?
   *'main ': Sent to the main process for processing
   *'all': Broadcast to all windows (relayed through the main process)
   *String: Specify the ID of a window (windowId)
   */
  public __virid_target: string = "";
  /**
   *What message should I turn into at the destination?
   */
  public __virid_messageType: string = "";
}

/**
 *RenderMessage: Initiated by the rendering process, targeting the main process or other windows
 */
export abstract class ToMainMessage extends EventMessage {
  /**Where am I from?
   */
  public static __virid_source: string;

  /**Where is my destination?
   *'main ': Sent to the main process for processing
   *'all': Broadcast to all windows (relayed through the main process)
   *String: Specify the ID of a window (windowId)
   */
  public abstract __virid_target: string;

  /**
   *What message should I turn into at the destination?
   */
  public abstract __virid_messageType: string;
}
