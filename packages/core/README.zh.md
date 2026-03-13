#  @virid/core

`@virid/core` 是整个 Virid 生态系统的逻辑心脏。它提供了一套确定性的消息分发与调度机制，旨在将业务逻辑从复杂的 UI 框架与运行环境中彻底剥离。

⚠️本框架吸收了大量Rust、Bevy、Nestjs设计哲学，上手难度较高，且需要配置`reflect-metadata`并开启元数据支持。

## 🌟 核心设计理念

- **环境绝对独立**：本包不依赖任何浏览器、Node.js 的特殊 API 或第三方库（仅依赖 `reflect-metadata` 实现装饰器功能）。这确保了内核可以无缝运行在 Electron 主进程、Worker 线程、Web 渲染层甚至纯服务器环境中。
- **确定性调度**：引入了类似游戏引擎的 `Tick` 机制，通过双缓冲消息池确保逻辑执行顺序的可预测性。
- **强类型与所有权**：所有的系统使用强类型构建，强制使用现代TS类型和类本身作为标识，且拥有运行时修改护盾检查拦截任何非法写操作。**摆脱热更新依赖，If it compiles, it works**

## 🛠️ 核心功能详解

### 1. 消息驱动与分发机制 (Message & Dispatcher)

在 Virid 中，所有的状态变更都必须通过发送一个 `Message` 指令来触发。

- **自动调度**：通过定义特定类型的 `Message` 和对应的 `System` 处理函数，引擎会自动在下一个微任务周期（`Tick`）内调用已注册的逻辑。
- **消息类型**：
  - `SingleMessage`：同一 Tick 内的同类消息会自动合并，适用于状态同步。
  - `EventMessage`：顺序追加，确保动作序列的完整性。
  - `ErrorMessage`：顺序追加，错误也是一种消息类型，拥有默认处理`System`。
  - `WarnMessage`：顺序追加，警告也是一种消息类型，拥有默认处理`System`。
  - `InfoMessage`：顺序追加，信息也是一种消息类型，拥有默认处理`System`。

### 2. 依赖注入系统 (Dependency Injection)

`Virid` 实现了基于装饰器的轻量依赖注入，使 `System` 能够以极简的方式访问数据实体。

- **数据实体 (Component)**：通过 `@Component()` 装饰器标记 class，将其定义为数据容器。
- **自动注入**：使用 `app.bindComponent()` 注册后，Dispatcher 会根据 System 函数的参数类型自动注入对应的实例。

```ts
//定义消息
class IncrementMessage extends SingleMessage {
  constructor(public amount: number) {
    super();
  }
}

//定义数据
@Component()
class CounterComponent { public count = 0; }

//纯静态static，当消息发送时引擎自动调用onIncrement
class CounterSystem {
  @System()
  static onIncrement(
    @Message(IncrementMessage) msg: IncrementMessage,
    count: CounterComponent
  ) {
    count.count += msg.amount; // 自动注入的 CounterComponent 实例
  }
}
```

### 3. 系统调度与钩子 (Lifecycle Hooks)

`Dispatcher` 提供了完备的生命周期监控能力：

- **执行钩子**：支持 `onBeforeExecute` 和 `onAfterExecute`，允许在逻辑执行前后插入全局审计或过滤逻辑。
- **周期钩子**：`onBeforeTick` 与 `onAfterTick` 用于监控每一轮逻辑帧的起止。

### 4. 工业级健壮性

- **死循环防御**：`Dispatcher` 内部设有 `internalDepth` 计数器。若逻辑链路产生超过 100 层的递归触发，系统将自动熔断并报错，防止环境假死。
- **执行优先级**：支持通过 `@System({ priority: number })` 明确多个系统处理同一消息时的先后顺序。

## 🛠️ @virid/core 核心 API 概览

### 1. 引擎初始化 (Engine Entry)

#### `createVirid()`

- **功能**：初始化逻辑内核，创建全局唯一的 `Dispatcher` 与容器。

------

### 2. 指令与消息 (Messages)

消息是驱动系统的唯一原因。`Virid` 区分了两种不同的执行范式：

#### `SingleMessage`

- **特性**：**状态同步型消息**。

- **逻辑**：在同一个 `Tick` 内发送的多次同类型 `SingleMessage` 会被自动合并。默认情况下，`System` 仅会收到最新的一条。

- **示例：**

 ```ts
  import {SingleMessage} form "@virid/core"
  class MyMessage extends SingleMessage{
      construter(public someData:SomeType)
  }
  
  //在任何的地方，只要发送
  //send内的参数为MyMessage的构造函数可以接受的参数
  MyMessage.send(someData)
 ```

#### `EventMessage`

- **特性**：**动作指令型消息**。
- **逻辑**：顺序追加，不合并。每一条 `EventMessage` 都会严格触发一次 `System` 执行。
- **示例：**同`SingleMessage`

------

### 3. 数据与逻辑定义 (Decorators)

#### `@Controller()`

- **功能**：标记一个类为**UI控制器**，该类将会随着每个`vue`组件的创建而创建，销毁而销毁。详情见`@virid/vue`。
- **设计**：配合 `bindController` 使用，注册后可以在`@virid/vue`中使用`useController`获得实例。
- **示例：**

```ts
@Controller()
class PageController {}
// 使用之前要注册
app.bindController(PageController)
```

#### `@Component()`

- **功能**：标记一个类为**数据实体**，该类将作为全局单例，并一直存在。
- **设计**：配合 `bindComponent` 使用，注册后可以在System中声明类型以获得依赖注入功能。
- **示例：**

```ts
@Component()
class CounterComponent {
  public count = 0;
}
// 使用之前要注册
app.bindController(CounterComponent)
```

#### `@System(params?)`

- **功能**：将静态方法注册为业务逻辑处理器。它实现了“依赖自动装配”。只需要在参数里写上对应的 `Component` 类型，引擎就会在执行时自动注入实例。
- **参数**：
  - `priority`: 执行优先级。数值越大，在同一个 `Tick` 中执行越早。
  - `messageClass`: 触发该System需要的消息类型，不能与`@Message`共存
- **示例**：

```ts
import {
  System,
  Message,
} from "@virid/core";

class CounterSystem {
  // 可以为System设置优先级
  // count参数将被自动注入
  @System({ priority: 0})
  static onIncrement(
    @Message(IncrementMessage) message: IncrementMessage,
    count: CounterComponent,
  ) {
    count.count += message.amount;
  }
  //可以不使用@Message
  @System({messageClass:IncrementMessage})
  static onIncrement(
    count: CounterComponent,
  ) {
    count.count += 1;
  }
   @System()
   static onProcess(msg: SomeMessage) {
      // 直接 return 消息，即可实现逻辑链式触发，无需手动调用 MessageWriter
      // 也可以return一个message数组来连续触发
      return new NextStepMessage(); 
   }
}
//直接通过.send来发送消息
IncrementMessage.send(5);
```

#### `@Message(Class, single?)`

- **功能**：参数级装饰器，明确当前 `System` 关注的消息类型。
- **批处理模式**：若设置 `single: false`，`System` 会收到一个包含本轮 `Tick` 内所有该消息的数组，适用于高性能的批量计算（如物理引擎或日志聚合）。
- **示例：**见System

### `@Observer(callback)`

- **功能**：属性级变更监听，用于处理那些“非指令驱动”的副作用
- **逻辑**：当 `Component` 中被标记的属性发生变更时，引擎会自动触发指定的回调函数。
- **示例**：

```ts
@Component()
class PlayerComponent {
  // 当 progress 变更时，自动发送一个同步消息或执行回调
  @Observer((old, val) => new SyncLyricMessage(val))
  public progress = 0;
}
```

###  `@Safe()`

- **功能**：方法访问权限标记，在`Virid`中外部环境（UI 层）严禁直接修改逻辑层数据,所有的修改和方法调用都会被拦截。但对于某些“只读类”或“安全计算类”方法，可以通过 `@Safe()` 显式授权，允许视图层直接调用。
- **设计**：主要服务于 `@virid/vue` 等外部投影层，详情见`@virid/vue`中的`Deep Shield`
- **示例**：

```ts
@Component()
class PlayerComponent {
  // 如果不加Safe，virid将会禁止在任何vue的controller中调用该方法
  @Safe()
  public someMethod(){}
}
```

------

### 4. 调度与拦截 (Dispatcher & Hooks)

#### `Dispatcher`

- **核心逻辑**：
  1. **双缓冲交换 (Flip)**：调度器基于逻辑Tick运行，以微任务开始为起点，直到系统内部不在产生新的Message为止为一个逻辑Tick。每次执行调度器锁定当前待处理消息，新产生的消息自动进入下一轮。
  2. **死循环熔断**：若递归执行深度 `internalDepth > 100`，立即停止执行并报错，保护主线程不被逻辑黑洞卡死。

#### 生命周期钩子 (Life-Cycle Hooks)

- `onBeforeTick` / `onAfterTick`: 监控逻辑帧的脉搏。
- `onBeforeExecute` / `onAfterExecute`: 针对特定消息的执行全过程进行审计。
- **示例**：

```ts
const app = createVirid();
app.onBeforeExecute(MyMessage, (msg, context) => {
  // 可以在这里实现全局的性能追踪或权限校验
  // 只会对MyMessage和子类消息生效
});
app.onAfterTick((context) => {
  console.log("----------------onAfterTick------------------");
});
```

------

### 5. 系统通讯 (IO)

#### `MessageWriter`

- **功能**：全局静态通讯工具。
- **API**：
  - `MessageWriter.write(MessageClass, ...args)`: 发送消息的底层入口。
  - `MessageWriter.error(Error, context?)`: 抛出一个系统级错误，它会自动触发 `ErrorMessage`。
  - `MessageWriter.warn(context)`: 写入一个警告，他会自动触发`WarnMessage`。
  - `MessageWriter.info(context)`: 写入一个信息，它会自动触发 `InfoMessage`。

------

## 🔬 进阶：原子化修改 (Atomic Operations)

#### `AtomicModifyMessage`

- **功能**：提供一种“即插即用”的临时逻辑修改方案。
- **场景**：当你需要对某个 `Component` 进行一次性的观察或微调，又不想专门写一个 `System` 时，可以使用此消息在下一帧执行一段闭包逻辑。
- **示例**：

```ts
 AtomicModifyMessage.send(
      CounterComponent,
      (comp) => {
        console.log("----------------AtomicModifyMessage------------------");
      },
      "Check CounterComponent",
    );
```

