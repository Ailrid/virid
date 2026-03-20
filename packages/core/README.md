# @virid/core

`@virid/core` serves as the logical heartbeat of the entire Virid ecosystem. It provides a deterministic message distribution and scheduling mechanism, designed to completely decouple business logic from complex UI frameworks and runtime environments.

⚠️ **Warning:** This framework heavily incorporates design philosophies from **Rust**, **Bevy**, and **NestJS**. It has a steep learning curve and requires the configuration of `reflect-metadata` with experimental metadata support enabled.

### 🌟 Core Design Philosophy

- **Absolute Environment Independence:** This package does not rely on any browser-specific APIs, Node.js internals, or third-party libraries (with the sole exception of `reflect-metadata` for decorator functionality). This ensures the kernel can run seamlessly within Electron main processes, Worker threads, Web rendering layers, or even pure server-side environments.
- **Deterministic Scheduling:** By introducing a game-engine-inspired **Tick mechanism**, the framework utilizes double-buffered message pools to ensure the execution order of logic remains strictly predictable.
- **Strong Typing & Ownership:** All systems are built with robust type safety, enforcing the use of modern TypeScript types and classes as unique identifiers. It features a runtime "modification shield" to intercept any illegal write operations. Move beyond a reliance on hot-reloading; as the saying goes: *If it compiles, it works.*

## 🛠️ Core Functional Overview

### 1. Message-Driven & Dispatcher Mechanism

In `Virid`, all state changes must be triggered by sending a `Message` command.

- **Automatic Scheduling**: By defining specific types of `Message` and corresponding `System` handlers, the engine automatically invokes the registered logic in the next microtask cycle (`Tick`).
- **Message Types**:
  - **`SingleMessage`**: Messages of the same type within the same Tick are automatically merged, suitable for state synchronization.
  - **`EventMessage`**: Sequentially appended, ensuring the integrity of action sequences.
  - **`ErrorMessage`**: Sequentially appended; errors are treated as a message type with a default handling System.
  - **`WarnMessage`**: Sequentially appended; warnings are a message type with a default handling System.
  - **`InfoMessage`**: Sequentially appended; information is a message type with a default handling System.

### 2. Dependency Injection System (DI)

`Virid` implements a lightweight, decorator-based DI system, allowing Systems to access data entities with minimal effort.

- **Data Entities (Component)**: Classes marked with the `@Component()` decorator are defined as data containers.
- **Automatic Injection**: Once registered via `app.bindComponent()`, the Dispatcher automatically injects the corresponding instances based on the parameter types of the System function.

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

## 3. Data & Logic Definitions (Decorators)

### `@Controller()`

- **Function:** Marks a class as a UI Controller. Instances of this class are tied to the lifecycle of Vue components—created when the component is mounted and destroyed when it is unmounted. For details, see `@virid/vue`.

- **Design:** Used in conjunction with `bindController`. Once registered, instances can be retrieved in `@virid/vue` using the `useController` hook.

- **Example:**

```ts
@Controller()
class PageController {}

// Registration is required before use
app.bindController(PageController);
```

------

### `@Component()`

- **Function:** Marks a class as a Data Entity. This class acts as a global singleton and persists throughout the application lifecycle.

- **Design:** Used with `bindComponent`. Once registered, it can be declared as a parameter type in a `@System` to enable automatic Dependency Injection (DI).

- **Example:**

```ts
@Component()
class CounterComponent {
public count = 0;
}

// Registration is required before use
app.bindComponent(CounterComponent); 
```

------

### `@System(params?)`

- **Function:** Registers a static method as a business logic processor. It implements **"Automatic Dependency Wiring."** By simply specifying the `Component` type in the parameters, the engine automatically injects the corresponding instance during execution.

- **Parameters:**

  - `priority`: Execution priority. Higher values execute earlier within the same **Tick**.
  - `messageClass`: The specific message type that triggers this System. (Cannot be used simultaneously with the `@Message` decorator on parameters).

- **Example:**


```ts
import { System, Message } from "@virid/core";

class CounterSystem {
// Setting priority; CounterComponent is automatically injected
@System({ priority: 0 })
static onIncrement(
  @Message(IncrementMessage) message: IncrementMessage,
  count: CounterComponent,
) {
  count.count += message.amount;
}

// Alternative: Define messageClass in the System decorator
@System({ messageClass: IncrementMessage })
static onQuickAdd(count: CounterComponent) {
  count.count += 1;
}

@System()
static onProcess(msg: SomeMessage) {
  // Return a message (or an array of messages) to trigger a logic chain
  // This removes the need to manually call a MessageWriter
  return new NextStepMessage(); 
}
}

// Triggering logic via the .send() method
IncrementMessage.send(5);
```

------

### `@Message(Class, single?)`

- **Function:** A parameter-level decorator that explicitly defines which message type the System is listening to.
- **Batch Mode:** If `single: false` is set, the System receives an **array** of all messages of that type sent within the current Tick. This is ideal for high-performance batch processing (e.g., physics calculations or log aggregation).
- **Example:** See the `@System` section above.

------

### `@Observer(callback)`

- **Function:** A property-level decorator for change detection, used to handle "non-command-driven" side effects.

- **Logic:** When a decorated property in a `Component` changes, the engine automatically triggers the specified callback function.

- **Example:**


```ts
@Component()
class PlayerComponent {
// Automatically send a sync message or execute a callback when 'progress' changes
@Observer((old, val) => new SyncLyricMessage(val))
public progress = 0;
}
```

------

### `@Safe()`

- **Function:** A method access modifier. In Virid, external environments (UI layers) are strictly prohibited from directly modifying logic-layer data; all modifications and method calls are intercepted by default. However, "read-only" or "safe calculation" methods can be explicitly authorized via `@Safe()`, allowing the view layer to call them directly.

- **Design:** Primarily serves external projection layers like `@virid/vue`. See **Deep Shield** in the `@virid/vue` documentation for more details.

- **Example:**


```ts
@Component()
class PlayerComponent {
// Without @Safe, Virid will block calls to this method from any Vue Controller
@Safe()
public someMethod() {}
}
```

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

### 🔬 Advanced

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

#### **DebounceMessage**

**Function:** Provides a framework-level native debouncing solution with built-in lifecycle management.

**Scenario:** When you need to throttle the frequency of message triggers or merge the data content of consecutive messages, this class offers an out-of-the-box mechanism to handle "intent evolution" without manual timer management.

**Example:**

```ts
 // Derive your own message from the DebounceMessage class
 class MoveMessage extends DebounceMessage {
   readonly debounceTime = 100; // Set the debounce window to 100ms 

   constructor(
     public x: number,
     public y: number,
   ) {
     super();
   }

   // This callback is triggered when debouncing occurs, 
   // providing the instance of the previously sent Message.
   debounceCallback(previousMessage: MoveMessage) {
     console.log(
       `[Debounce] Merge displacement: Original(${previousMessage.x}, ${previousMessage.y}) -> New(${this.x}, ${this.y})`,
     );
     // Accumulate the state from the previous message
     this.x += previousMessage.x;
     this.y += previousMessage.y;
   }
 }

 // Usage:
 // Only the "evolved" message with a combined value will 
 // reach the System after the user stops sending for 100ms.
 MoveMessage.send(10, 0);
```





