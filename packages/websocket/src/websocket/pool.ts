/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid WebSocket
 */
import { MessageWriter } from "@virid/core";

export class ManagedWebSocket {
  private ws: WebSocket | null = null;
  private isIntentionalClose = false;
  private reconnectTimer: any = null;

  constructor(
    public readonly url: string,
    private reconnectInterval: number,
    private onMessageCallback: (url: string, rawData: string) => void,
  ) {
    this.connect();
  }

  public connect(): void {
    MessageWriter.info(
      `[Virid WebSocket] Connecting to target url: ${this.url}`,
    );
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      MessageWriter.info(
        `[Virid WebSocket] Connection established successfully for: ${this.url}`,
      );
    };

    this.ws.onmessage = (event) => {
      this.onMessageCallback(this.url, event.data);
    };

    this.ws.onerror = (error) => {
      MessageWriter.error(
        new Error(
          `[Virid WebSocket] Connection error occurred on ${this.url}: ${JSON.stringify(error)}`,
        ),
      );
    };

    this.ws.onclose = () => {
      MessageWriter.warn(
        `[Virid WebSocket] Connection closed for url: ${this.url}`,
      );
      if (!this.isIntentionalClose) {
        this.reconnectTimer = setTimeout(() => {
          this.connect();
        }, this.reconnectInterval);
      }
    };
  }

  public send(data: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      MessageWriter.warn(
        `[Virid WebSocket] Cannot send data because connection is not open for url: ${this.url}`,
      );
    }
  }

  public close(): void {
    this.isIntentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.ws) {
      this.ws.close();
    }
  }
}

export class WebSocketPool {
  private pool = new Map<string, ManagedWebSocket>();

  constructor(
    private reconnectInterval: number,
    private onMessageCallback: (url: string, rawData: string) => void,
  ) {}

  public getOrCreate(url: string): ManagedWebSocket {
    if (!this.pool.has(url)) {
      const managedWs = new ManagedWebSocket(
        url,
        this.reconnectInterval,
        this.onMessageCallback,
      );
      this.pool.set(url, managedWs);
    }
    return this.pool.get(url)!;
  }

  public send(url: string, data: string): void {
    const managedWs = this.pool.get(url);
    if (managedWs) {
      managedWs.send(data);
    } else {
      MessageWriter.warn(
        `[Virid WebSocket] Target Connection Not Found : url ${url}, attempting to create one.`,
      );
      // const newWs = this.getOrCreate(url);
      // Optional: cache message or send immediately once open, for now we just create it
      return;
    }
  }

  public closeAll(): void {
    for (const [, ws] of this.pool.entries()) {
      ws.close();
    }
    this.pool.clear();
  }
  public close(url: string): void {
    const ws = this.pool.get(url);
    if (ws) {
      ws.close();
      this.pool.delete(url);
    }
  }
}
