# @virid/core

`@virid/core` 作为整个 Virid 生态系统的逻辑心脏，提供了一套确定性的消息分发与调度机制，旨在实现业务逻辑与复杂 UI 框架及运行时环境的彻底解耦。

⚠️ **警告：** 该框架深度融入了 **Rust**、**Bevy** 和 **NestJS** 的设计哲学。其学习曲线较为陡峭，且必须配置并开启 `reflect-metadata` 的实验性元数据支持（experimental metadata）。

### 🌟 核心设计理念

- **绝对的环境独立性（Absolute Environment Independence）：** 本包不依赖任何浏览器特有 API、Node.js 内置模块或第三方库（仅使用 `reflect-metadata` 来支持装饰器功能）。这确保了核心逻辑可以无缝运行在 Electron 主进程、Worker 线程、Web 渲染层乃至纯服务端环境中。
- **确定性调度（Deterministic Scheduling）：** 借鉴游戏引擎的 **Tick 机制**，框架通过双缓冲区消息池确保逻辑的执行顺序保持严格可预测。
- **强类型与所有权（Strong Typing & Ownership）：** 所有系统均构建于稳固的类型安全之上，强制使用现代 TypeScript 类型与 Class 作为唯一标识符。同时内置运行时“修改防护盾”以拦截任何非法写操作。告别对热重载的依赖，正如谚语所云：*只要能编译通过，就能跑得通。*

## 🛠️ 核心功能概览

### 1. 消息驱动与分发器机制（Message-Driven & Dispatcher）

在 `Virid` 中，所有的状态变更都必须通过发送 `Message` 指令来触发。

- **自动调度**：通过定义特定类型的 `Message` 以及对应的 `System` 处理函数，引擎会在下一个微任务周期（`Tick`）中自动调用已注册的逻辑。
- **消息类型**：
  - **`SingleMessage`**：同一 Tick 内的同类型消息会自动合并，适用于状态同步场景。
  - **`EventMessage`**：按顺序追加，确保动作序列的完整性。
  - **`ErrorMessage`**：按顺序追加；错误被视作一种消息类型，并配备了默认的处理 System。
  - **`WarnMessage`**：按顺序追加；警告被视作一种消息类型，并配备了默认的处理 System。
  - **`InfoMessage`**：按顺序追加；信息被视作一种消息类型，并配备了默认的处理 System。

### 2. 依赖注入系统（DI）

`Virid` 实现了一套轻量级、基于装饰器的依赖注入（DI）系统，允许 System 以极低的成本访问数据实体。

- **数据实体（Component）**：使用 `@Component()` 装饰器标记的 Class 将被定义为数据容器。
- **自动注入**：通过 `app.bindComponent()` 完成注册后，Dispatcher 会根据 System 函数的参数类型自动注入对应的实例。

```ts
class IncrementMessage extends SingleMessage {
  // Initialize message with count payload
  constructor(public amount: number) {
    super();
  }
}

@Component()
class CounterComponent { public count = 0; }

class CounterSystem {
  @System()
  static onIncrement(
    @Message(IncrementMessage) msg: IncrementMessage,
    count: CounterComponent
  ) {
    // Increment total count from message amount
    count.count += msg.amount; // CounterComponent 实例将被自动注入
  }
}
```

### 3. 生命周期钩子（Lifecycle Hooks）

Dispatcher 提供了全方位的生命周期监控能力：

- **执行钩子**：支持 `onBeforeExecute` 和 `onAfterExecute`，用于在逻辑执行前后进行全局审计或过滤。
- **周期钩子**：通过 `onBeforeTick` 与 `onAfterTick` 来监控每个逻辑帧的起点与终点。

### 4. 工业级健壮性

- **死锁防御**：Dispatcher 内部维护了一个 `internalDepth` 计数器。若某条逻辑链触发了超过 100 层的递归，系统将自动熔断并抛出异常，防止环境假死。
- **执行优先级**：支持通过 `@System({ priority: number })` 定义多个 System 处理同一条消息时的执行顺序。

## 🛠️ @virid/core API 参考

### 1. 引擎初始化

#### `createVirid()`

- **功能**：初始化逻辑核心，创建全局唯一的 `Dispatcher` 实例与容器。

### 2. 指令与消息

#### `SingleMessage`

- **特性**：状态同步消息。
- **逻辑**：同一个 Tick 内发出的多个同类型消息将被合并；System 通常仅会收到最新的一条。
- **示例**：

```ts
import { SingleMessage } from "@virid/core";
class MyMessage extends SingleMessage {}
// 在任意位置发送消息
MyMessage.send(); // 参数与构造函数保持一致
```

#### `EventMessage`

- **特性**：动作指令消息。
- **逻辑**：按顺序排列，不进行合并。每一条 `EventMessage` 都会严格触发一次 System 的执行。
- **示例**：用法与 `EventMessage` 一致。

## 3. 数据与逻辑定义（装饰器）

### `@Controller()`

- **功能：** 将一个 Class 标记为 UI 控制器（UI Controller）。该类的实例会与 Vue 组件的生命周期进行绑定——在组件挂载（mounted）时创建，在组件卸载（unmounted）时销毁。详见 `@virid/vue` 相关文档。
- **设计：** 需配合 `bindController` 使用。注册完成后，即可在 `@virid/vue` 中通过 `useController` Hook 获取该实例。
- **示例：**

```ts
@Controller()
class PageController {}

// 使用前必须先完成注册
app.bind(PageController);
```

### `@Component()`

- **功能：** 将一个 Class 标记为数据实体（Data Entity）。该类作为全局单例运行，并贯穿整个应用程序的生命周期。
- **设计：** 需配合 `bindComponent` 使用。注册完成后，即可将其声明为 `@System` 的参数类型，从而实现依赖项的自动注入（DI）。
- **示例：**

```ts
@Component()
class CounterComponent {
public count = 0;
}

// 使用前必须先完成注册
app.bind(CounterComponent); 
```

### `@System(params?)`

- **功能：** 将一个静态方法注册为业务逻辑处理器。它实现了“自动依赖装配”，只需在参数中指定所需的 `Component` 类型，引擎就会在执行时自动注入相应的实例。
- **参数：**
  - `priority`：执行优先级。数值越高，在同一个 **Tick** 内的执行时机越靠前。
  - `messageClass`：指定触发该 System 的消息类型（不能与参数上的 `@Message` 装饰器同时使用）。
- **示例：**

```ts
import { System, Message } from "@virid/core";

class CounterSystem {
// 设置优先级；CounterComponent 将被自动注入
@System({ priority: 0 })
static onIncrement(
  @Message(IncrementMessage) message: IncrementMessage,
  count: CounterComponent,
) {
  count.count += message.amount;
}

// 另一种写法：直接在 System 装饰器中配置 messageClass
@System({ messageClass: IncrementMessage })
static onQuickAdd(count: CounterComponent) {
  count.count += 1;
}

@System()
static onProcess(msg: SomeMessage) {
  // 返回一条消息（或消息数组）以触发后续逻辑链
  // 这样无需手动调用 MessageWriter
  return new NextStepMessage(); 
}
}

// 通过 .send() 方法触发逻辑
IncrementMessage.send(5);
```

### `@Message(Class, single?)`

- **功能：** 参数级别的装饰器，用于显式指定当前 System 监听的消息类型。
- **批量模式：** 若设置 `single: false`，System 将接收到当前 Tick 内发送的该类型消息的**数组**。非常适合高性能批量处理场景（例如物理计算或日志聚合）。
- **示例：** 参考上方的 `@System` 章节。

### `@Observer(callback)`

- **Function:** 属性级别的装饰器，用于变更检测，专门处理“非指令驱动”的侧面效应（Side Effects）。
- **逻辑：** 当 `Component` 中被装饰的属性发生变化时，引擎会自动触发指定的回调函数。
- **示例：**

```ts
@Component()
class PlayerComponent {
// 当 'progress' 发生变更时，自动发送同步消息或执行回调
@Observer((old, val) => new SyncLyricMessage(val))
public progress = 0;
}
```

### `@Safe()`

- **功能：** 方法访问修饰器。在 Virid 中，严格禁止外部环境（UI 层）直接修改逻辑层的数据，默认情况下所有的修改与方法调用都会被拦截。然而，通过 `@Safe()` 可以显式授权那些“只读”或“安全计算”的方法，允许视图层直接对其进行调用。
- **设计：** 主要服务于像 `@virid/vue` 这样的外部投影层。更多细节请参阅 `@virid/vue` 文档中的 **Deep Shield（深度防护盾）** 章节。
- **示例：**

```ts
@Component()
class PlayerComponent {
// 未标注 @Safe 时，Virid 会阻止任何 Vue Controller 对该方法的调用
@Safe()
public someMethod() {}
}
```

### 4. Dispatcher 与钩子（Hooks）

- **双缓冲区切换（Double-Buffered Flip）：** 每次执行时都会锁定当前的消息队列；在执行过程中产生的新消息将进入下一个周期。
- **钩子示例：**

```ts
const app = createVirid();
app.onBeforeExecute(MyMessage, (msg, context) => {
  // 全局性能追踪或权限校验
});
app.onAfterTick((context) => {
  console.log("----------------onAfterTick------------------");
});
```

### 4. Dispatcher 与钩子（Hooks）

#### **Dispatcher**

Virid 的核心调度引擎基于以下逻辑运作：

- **双缓冲区切换（Double-Buffered Flip）：** 调度器基于逻辑 **Tick** 运行。一个 Tick 始于微任务的开端，并持续运行至内部不再产生新消息为止。在每次执行期间，调度器会锁定当前待处理的消息池；在此过程中产生的所有新消息都会被自动推迟至下一个周期处理。
- **递归熔断（死锁防御）：** 若递归执行深度（`internalDepth`）超过 100 层，引擎将立即中断运行并抛出异常。这能保护主线程不被逻辑“黑洞”或无限循环所卡死。

#### **生命周期钩子（Life-Cycle Hooks）**

- **onBeforeTick / onAfterTick：** 监控逻辑帧的“脉搏”。
- **onBeforeExecute / onAfterExecute：** 针对特定消息类型审视整个执行过程。
- **示例：**

```ts
const app = createVirid();

app.onBeforeExecute(MyMessage, (msg, context) => {
  // 在此处实现全局性能追踪或权限校验
  // 该钩子仅针对 MyMessage 及其子类触发
});

app.onAfterTick((context) => {
  console.log("----------------onAfterTick------------------");
});
```

### 5. 系统间通信（IO）

#### **MessageWriter**

- **功能**：全局静态工具，用于系统范围内的通信。
- **API**：
  - **`MessageWriter.write(MessageClass, ...args)`**：分发消息的底层入口。它使用提供的参数实例化消息类，并将其发送至 Dispatcher。
  - **`MessageWriter.error(Error, context?)`**：抛出系统级错误，会自动触发 `ErrorMessage`。
  - **`MessageWriter.warn(context)`**：记录警告信息，会自动触发 `WarnMessage`。
  - **`MessageWriter.info(context)`**：记录普通信息，会自动触发 `InfoMessage`。