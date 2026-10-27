# @virid/websocket

`@virid/websocket` 是为 `virid` 应用打造的 WebSocket 消息驱动适配器。它通过**动态引导消息（BootstrapSocketMessage）**与**全局连接池（WebSocketPool）**，将底层的网络长连接通信、断线重连、多路复用彻底收敛并抽象为确定性的 `Message` 驱动流。

## 🌟 核心设计理念

在 `@virid/websocket` 中，网络双向交互不再依赖繁琐的手动事件监听，而是完全由消息驱动：

- **动态建链与路由绑定**：通过发送 `BootstrapSocketMessage` 携带对应的 WebSocket URL，系统可以按需、动态地与远程服务端建立长连接并放入全局连接池进行托管。
- **双向消息确定性映射**：
- 客户端主动向远程服务发送消息时，只需继承 `ToWebSocketMessage` 并指定目标 URL 与消息类型，中间件将自动拦截并推送到对应的长连接通道中。
- 远程服务推送的原始数据将被捕获、反序列化，并自动还原为对应的 `FromWebSocketMessage` 子类，携带来源 URL 重新注入 `virid` 核心调度器中。

- **多路复用与零硬编码**：插件本身不绑定任何固定的服务地址，支持单客户端同时维护多条独立的 WebSocket 链路，适配复杂场景。

## 🔌 启用插件

```ts
import { createVirid } from "@virid/core";
import { WebSocketPlugin } from "@virid/websocket";

const app = createVirid();

// 插件无需硬编码初始化 URL，只需配置全局断线重连间隔（毫秒）
app.use(WebSocketPlugin, {
  reconnectInterval: 3000,
});
```

## 🛠️ @virid/websocket 核心 API 概览

### 1. `ConnectWebSocketMessage/DisconnectWebSocketMessage`（动态引导建链）

- **功能**：用于触发系统与指定 URL 建立 WebSocket 连接。
- **示例**：

```ts
import {
  ConnectWebSocketMessage,
  DisconnectWebSocketMessage,
} from "@virid/websocket";

// 发送该消息后，WebSocketPlugin 的中间件将自动拦截并加入连接池
ConnectWebSocketMessage.send("ws://192.168.1.100:8080/ws");
DisconnectWebSocketMessage.send("ws://192.168.1.100:8080/ws");
```

---

### 2. `FromWebSocketMessage` / `@FromWebSocket`（接收远程推送）

- **功能**：用于接收来自 WebSocket 服务端的推送数据，并自动转换为对应的 Message 实例进入调度中心。
- **示例**：

```ts
import { FromWebSocketMessage, FromWebSocket } from "@virid/websocket";
import { System } from "@virid/core";

// 使用 @FromWebSocket 装饰器绑定服务端传来的数据类型标识
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

// 在 System 中直接处理该消息
export class FlightSystem {
  @System()
  onTelemetry(message: FlightTelemetryMessage) {
    // message.__virid_websocket_url 自动携带了当前数据来自哪条连接
    console.log(
      `收到来自 ${message.__virid_websocket_url} 的飞机坐标:`,
      message.lat,
      message.lon,
    );
  }
}
```

---

### 3. `ToWebSocketMessage`（客户端主动发送）

- **功能**：一个特殊的消息基类，可被继承。所有继承自 `ToWebSocketMessage` 的消息在发送时，会被中间件自动拦截并序列化，通过指定的 URL 发往远程 WebSocket 服务端。
- **示例**：

```ts
import { ToWebSocketMessage } from "@virid/websocket";

export class SendCommandMessage extends ToWebSocketMessage {
  // 指定目标 WebSocket 的 URL，以决定发往连接池中的哪一条链路
  public __virid_websocket_url = "ws://192.168.1.100:8080/ws";
  // 指定发往后端的协议消息类型
  public __virid_message_type = "flight-command";

  constructor(
    public command: string,
    public param: number,
  ) {
    super();
  }
}

// 在业务代码中直接发送指令
SendCommandMessage.send("recalibrate", 1);
```
