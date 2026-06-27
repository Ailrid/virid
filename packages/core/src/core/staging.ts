/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */
import { MessageWriter } from "./io";
import { type BaseMessage, EventMessage, SingleMessage } from "./message";

export class Staging {
  public signalActive = new Map<any, any[]>();
  public eventActive: any[] = [];
  private signalStaging = new Map<any, any[]>();
  private eventStaging: any[] = [];

  stage(event: BaseMessage) {
    if (event instanceof SingleMessage) {
      const type = event.constructor;
      if (!this.signalStaging.has(type)) this.signalStaging.set(type, []);
      this.signalStaging.get(type)!.push(event);
    } else if (event instanceof EventMessage) {
      this.eventStaging.push(event);
    } else {
      MessageWriter.error(
        new Error(
          `[Virid Message] Invalid Message:\n${event.constructor.name} must extend SingleMessage or EventMessage`,
        ),
      );
    }
  }

  flip() {
    this.signalActive = this.signalStaging;
    this.eventActive = this.eventStaging;
    this.signalStaging = new Map();
    this.eventStaging = [];
  }

  clearSignals() {
    // types.forEach((type) => this.signalActive.delete(type));
    this.signalActive = new Map();
  }

  clearEvents() {
    this.eventActive = [];
  }
  
  isEmpty() {
    return this.signalStaging.size === 0 && this.eventStaging.length === 0;
  }

  /**
   * 重置所有池子
   */
  reset() {
    this.signalActive = new Map();
    this.signalStaging = new Map();
    this.eventStaging = [];
    this.eventActive = [];
  }
}
