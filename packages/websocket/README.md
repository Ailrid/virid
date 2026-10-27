# @virid/websocket

`@virid/websocket` is a WebSocket message-driven adapter built for `virid` applications. It encapsulates underlying long-connection networking, automatic reconnection, and multiplexing into deterministic `Message`-driven flows through **Bootstrap Messages (`BootstrapSocketMessage`)** and a **Global Connection Pool (`WebSocketPool`)**.

## 🌟 Core Design Philosophy

In `@virid/websocket`, bidirectional network interactions no longer rely on tedious manual event listeners. Instead, everything is fully message-driven:

- **Dynamic Connection & Route Binding**: By dispatching a `BootstrapSocketMessage` carrying a target WebSocket URL, the system can dynamically establish long connections with remote services (such as drone onboard compute boxes) on demand and manage them inside a global connection pool.
- **Deterministic Bidirectional Mapping**:
- When the client initiates a message to the remote service, it simply extends `ToWebSocketMessage` while specifying the target URL and message type. The middleware automatically intercepts it and pushes it down the corresponding connection channel.
- Raw data pushed from the remote service is captured, deserialized, and automatically restored into the corresponding `FromWebSocketMessage` subclass, carrying its source URL as it re-enters the `virid` core dispatcher.

- **Multiplexing & Zero Hardcoding**: The plugin itself binds to no hardcoded service addresses. It supports a single client maintaining multiple independent WebSocket links concurrently, making it an ideal fit for multi-drone swarms or multi-sensor stream sharding scenarios.

## 🔌 Enable Plugin

```ts
import { createVirid } from "@virid/core";
import { WebSocketPlugin } from "@virid/websocket";

const app = createVirid();

// The plugin requires no hardcoded initialization URLs, only a global reconnection interval (ms)
app.use(WebSocketPlugin, {
  reconnectInterval: 3000,
});
```

## 🛠️ @virid/websocket Core API Overview

### 1. `ConnectWebSocketMessage/DisconnectWebSocketMessage` (Dynamic Connection Bootstrapping)

- **Function**: Used to trigger the system to establish a WebSocket connection with a specified URL.
- **Example**:

```ts
import {
  ConnectWebSocketMessage,
  DisconnectWebSocketMessage,
} from "@virid/websocket";

// Once dispatched, the WebSocketPlugin middleware automatically intercepts and registers it into the connection pool
ConnectWebSocketMessage.send("ws://192.168.1.100:8080/ws");
DisconnectWebSocketMessage.send("ws://192.168.1.100:8080/ws");
```

---

### 2. `FromWebSocketMessage` / `@FromWebSocket` (Receiving Remote Pushes)

- **Function**: Used to receive data pushed from a WebSocket server and automatically convert it into a Message instance entering the dispatch center.
- **Example**:

```ts
import { FromWebSocketMessage, FromWebSocket } from "@virid/websocket";
import { System } from "@virid/core";

// Use the @FromWebSocket decorator to bind the incoming data type identifier from the server
@FromWebSocket("flight-telemetry")
export class FlightTelemetryMessage extends FromWebSocketMessage {
  constructor(
    public lat: number = 0,
    public lon: number = 0,
    public alt: number = 0,
  ) {
    super();
  }
}

// Directly process this message inside a System to drive frontend rendering (e.g., Cesium)
export class FlightSystem {
  @System()
  onTelemetry(message: FlightTelemetryMessage) {
    // message.__virid_websocket_url automatically tracks which connection this data came from
    console.log(
      `Received drone coordinates from ${message.__virid_websocket_url}:`,
      message.lat,
      message.lon,
    );
  }
}
```

---

### 3. `ToWebSocketMessage` (Active Client Sending)

- **Function**: A specialized message base class designed for inheritance. Any message extending `ToWebSocketMessage` is automatically intercepted and serialized by the middleware upon dispatch, routing through the specified URL to the remote WebSocket server.
- **Example**:

```ts
import { ToWebSocketMessage } from "@virid/websocket";

export class SendCommandMessage extends ToWebSocketMessage {
  // Specify the target WebSocket URL to determine which link in the pool handles this
  public __virid_websocket_url = "ws://192.168.1.100:8080/ws";
  // Specify the protocol message type destined for the backend
  public __virid_message_type = "flight-command";

  constructor(
    public command: string,
    public param: number,
  ) {
    super();
  }
}

// Dispatch instructions directly within business logic
SendCommandMessage.send("recalibrate", 1);
```
