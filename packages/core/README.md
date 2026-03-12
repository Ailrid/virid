# @virid/core

`@virid/core` is the logical heart of the entire Virid ecosystem. It provides a deterministic message distribution and scheduling mechanism designed to decouple business logic from complex UI frameworks and runtime environments.

## 🌟 Core Design Philosophy

- **Absolute Environment Independence**: This package does not depend on any browser, Node.js specific APIs, or third-party libraries (relying only on `reflect-metadata` for decorator functionality). This ensures the core can run seamlessly in Electron main processes, Worker threads, Web rendering layers, or even pure server environments.
- **Deterministic Scheduling**: It introduces a "Tick" mechanism similar to game engines, utilizing a double-buffered message pool to ensure the predictability of logic execution order.

## 🛠️ Core Functional Overview

### 1. Message-Driven & Dispatcher Mechanism

In Virid, all state changes must be triggered by sending a `Message` command.

- **Automatic Scheduling**: By defining specific types of `Message` and corresponding `System` handlers, the engine automatically invokes the registered logic in the next microtask cycle (Tick).
- **Message Types**:
  - **`SingleMessage`**: Messages of the same type within the same Tick are automatically merged, suitable for state synchronization.
  - **`EventMessage`**: Sequentially appended, ensuring the integrity of action sequences.
  - **`ErrorMessage`**: Sequentially appended; errors are treated as a message type with a default handling System.
  - **`WarnMessage`**: Sequentially appended; warnings are a message type with a default handling System.
  - **`InfoMessage`**: Sequentially appended; information is a message type with a default handling System.

### 2. Dependency Injection System (DI)

Virid implements a lightweight, decorator-based DI system, allowing Systems to access data entities with minimal effort.

- **Data Entities (Component)**: Classes marked with the `@Component()` decorator are defined as data containers.
- **Automatic Injection**: Once registered via `app.bindComponent()`, the Dispatcher automatically injects the corresponding instances based on the parameter types of the System function.

TypeScript

```ts
class IncrementMessage extends SingleMessage {
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
    count.count += msg.amount; // CounterComponent instance is automatically injected
  }
}
```

### 3. Lifecycle Hooks

The Dispatcher provides comprehensive lifecycle monitoring:

- **Execution Hooks**: Supports `onBeforeExecute` and `onAfterExecute` for global auditing or filtering before and after logic execution.
- **Cycle Hooks**: `onBeforeTick` and `onAfterTick` monitor the start and end of each logic frame.

### 4. Industrial-Grade Robustness

- **Deadlock Defense**: The Dispatcher includes an `internalDepth` counter. If a logic chain triggers more than 100 levels of recursion, the system automatically fuses and throws an error to prevent the environment from hanging.
- **Execution Priority**: Supports defining the order of multiple Systems handling the same message via `@System({ priority: number })`.

------

## 🛠️ @virid/core API Reference

### 1. Engine Initialization

#### `createVirid()`

- **Function**: Initializes the logical kernel and creates the globally unique `Dispatcher` and container.

------

### 2. Instructions & Messages

#### `SingleMessage`

- **Feature**: State synchronization message.
- **Logic**: Multiple messages of the same type in one Tick are merged; the System typically receives only the latest one.
- **Example**:

```ts
import { SingleMessage } from "@virid/core";
class MyMessage extends SingleMessage {}
//Send messages anywhere
MyMessage.send(); // Parameters correspond to the constructor
```

#### `EventMessage`

- **Feature**: Action command message.
- **Logic**: Sequential, no merging. Every `EventMessage` triggers a System execution strictly.
- **Example**: Same as `EventMessage`

------

### 3. Data & Logic Definitions (Decorators)

#### `@Component()`

- **Function**: Marks a class as a **Data Entity**.
- **Usage**: Used with `bindComponent` to enable dependency injection in Systems.
- **Example**:

```ts
@Component()
class CounterComponent {
  public count = 0;
}
```

#### `@System(params?)`

- **Function**: Registers a static method as a logic handler with automatic dependency assembly.
- **Parameters**:
  - `priority`: Higher values execute earlier in a Tick.
  - `messageClass`: The message type that triggers this System (cannot coexist with `@Message`).
- **Note**: Returning a Message (or array) from a System implements automatic logic chaining.
- **Examples**:

```ts
import {
  System,
  Message,
} from "@virid/core";

class CounterSystem {
  // Priority can be set for the system
  @System({ priority: 0})
  static onIncrement(
    @Message(IncrementMessage) message: IncrementMessage,
    count: CounterComponent,
  ) {
    count.count += message.amount;
  }
  //You don't need to use @ Message if you already used messageClass
  @System({messageClass:IncrementMessage})
  static onIncrement(
    count: CounterComponent,
  ) {
    count.count += 1;
  }
   @System()
   static onProcess(msg: SomeMessage) {
      // Directly return the message to achieve logical chain triggering, without the need to 		//manually call the Message Writer
      // You can also return a message array to trigger continuously
      return new NextStepMessage(); 
   }
}
//Send messages directly through. send
IncrementMessage.send(5);
```

#### `@Message(Class, single?)`

- **Function**: Parameter decorator defining the message type for the System.
- **Batch Mode**: Set `single: false` to receive an array of all messages of that type in the current Tick (ideal for high-performance batch processing).
- **Example**: Same as `System`

#### @Observer(callback)

- **Function** : Attribute level change monitoring, used to handle side effects that are not instruction driven
- **Logic**  : When the attribute marked in 'Component' changes, the engine will automatically trigger the specified callback function.
- **Example** :

```ts
@Component()
class PlayerComponent {
  //Automatically send a synchronization message or execute a callback when progress changes
  @Observer((old, val) => new SyncLyricMessage(val))
  public progress = 0;
}
```

#### `@Safe()`

- **Function**: Method access marking. In Virid, The UI layer is restricted from directly modifying logic data. `@Safe()` explicitly authorizes the view layer to call specific "read-only" or "safe-calculation" methods.
- **Example** :

```ts
@Component()
class PlayerComponent {
  // 如果不加Safe，virid将会禁止在任何vue的controller中调用该方法
  @Safe()
  public someMethod(){}
}
```

------

### 4. Dispatcher & Hooks

- **Double-Buffered Flip**: Each execution locks current messages; new messages generated during execution enter the next cycle.
- **Hooks Example**:

```ts
const app = createVirid();
app.onBeforeExecute(MyMessage, (msg, context) => {
  // Global performance tracking or permission validation
});
app.onAfterTick((context) => {
  console.log("----------------onAfterTick------------------");
});
```

------

### 4. Dispatcher & Hooks

#### **Dispatcher**

The core scheduling engine of Virid operates on the following logic:

- **Double-Buffered Flip**: The scheduler runs based on logical **Ticks**. A Tick starts at the beginning of a microtask and continues until no new messages are generated internally. During each execution, the scheduler locks the current pending messages; any new messages generated during this process are automatically moved to the next cycle.
- **Recursion Melt-down (Deadlock Defense)**: If the recursive execution depth (`internalDepth`) exceeds 100, the engine immediately halts and throws an error. This protects the main thread from being frozen by logical "black holes" or infinite loops.

#### **Life-Cycle Hooks**

- **onBeforeTick / onAfterTick**: Monitor the "pulse" of logical frames.
- **onBeforeExecute / onAfterExecute**: Audit the entire execution process for specific message types.
- **Example:**

```ts
const app = createVirid();

app.onBeforeExecute(MyMessage, (msg, context) => {
  // Implement global performance tracking or permission validation here
  // This hook only triggers for MyMessage and its subclasses
});

app.onAfterTick((context) => {
  console.log("----------------onAfterTick------------------");
});
```

### 5. System Communication (IO)

#### **MessageWriter**

- **Function**: A global static utility for system-wide communication.
- **API**:
  - **`MessageWriter.write(MessageClass, ...args)`**: The underlying entry point for dispatching messages. It instantiates the message class with the provided arguments and sends it to the Dispatcher.
  - **`MessageWriter.error(Error, context?)`**: Throws a system-level error, which automatically triggers an `ErrorMessage`.
  - **`MessageWriter.warn(context)`**: Logs a warning, which automatically triggers a `WarnMessage`.
  - **`MessageWriter.info(context)`**: Logs an informational message, which automatically triggers an `InfoMessage`.

------

### 🔬 Advanced: Atomic Operations

#### **AtomicModifyMessage**

- **Function**: Provides a "plug-and-play" solution for temporary logic modifications.
- **Scenario**: When you need to perform a one-time observation or tweak a `Component` without the overhead of defining a dedicated `System`, you can use this message to execute a closure logic in the next logical frame (Tick).
- **Example**:

```ts
AtomicModifyMessage.send(
  CounterComponent,
  (comp) => {
    // Perform one-time inspection or modification on the component instance
    console.log("----------------AtomicModifyMessage------------------");
    console.log("Current Component State:", comp);
  },
  "Check CounterComponent" // Optional: label for debugging/tracing
);
```

------
