# @virid/std

**@virid/std** is the official standard library for **@virid/core**. It provides a set of out-of-the-box utility message control flow operations, featuring native support for asynchronous streams, message grouping, debouncing, throttling, and more.

### 🔌 Enabling the Plugin

```ts
import { createVirid, Component, System, EventMessage } from "@virid/core";
import { nextTick, StdPlugin } from "@virid/std";

const app = createVirid().use(StdPlugin, {});
```

## 🛠️ @virid/std Core API Overview

### `nextTick`

- **Function**: Similar to `nextTick` in Vue, but refers to a **Virid Macro Tick**. When executed, all synchronous Systems within the current Tick have finished running. For asynchronous control, use the `@AsyncQueue` decorator.
- **Example**:

```ts
nextTick(() => {
  IncreaseBMessage.send();
  IncreaseAMessage.send();
  IncreaseBMessage.send();
});
```

------

### `@AsyncQueue(key: string)`

- **Function**: Provides out-of-the-box asynchronous message control. It accepts a `key` parameter; messages sharing the same `key` are executed in strict sequential order, preventing asynchronous race conditions.
- **Example**:

TypeScript

```ts
@AsyncQueue("increase")
class IncreaseAMessage extends EventMessage {}

@AsyncQueue("increase")
class IncreaseBMessage extends EventMessage {}

@AsyncQueue("decrease")
class DecreaseMessage extends EventMessage {}

// Messages sent in the following order:
// Because IncreaseAMessage and IncreaseBMessage share the same key,
// they will execute sequentially even if they contain async operations.
IncreaseAMessage.send();
IncreaseBMessage.send();
IncreaseAMessage.send();

// Since DecreaseMessage has a different key, it does not wait for the above.
// However, the three DecreaseMessages below will execute in their own sequence.
DecreaseMessage.send();
DecreaseMessage.send();
DecreaseMessage.send();
```

------

### **`executeGroup`**

- **Function**: A collection of messages that executes a group in strict sequential order. If an error occurs during execution, subsequent logic is cancelled.
- **Example**:

```ts
const success = await executeGroup(
  [
    new IncreaseAMessage(),
    new IncreaseBMessage(),
    new IncreaseAMessage(),
    new DecreaseMessage(),
  ],
  "first"
);

if (success) {
  console.log("[ExecuteGroup] Success");
} else {
  console.log("[ExecuteGroup] Failed");
}
```

------

### `@Debounce()` / `@Throttle()`

- **Function**: Out-of-the-box support for debouncing and throttling. Can be implemented with a single line of code.
- **Example**:

```ts
// 100ms Debounce: Executes only once after 100ms of inactivity.
// The second parameter is used to aggregate messages.
@Debounce(100, (current, next) => {
  current.val += next.val;
})
class SetTimerAMessage extends EventMessage {
  constructor(public val: number) {
    super();
  }
}

// 500ms Throttle: Limits execution to once every 500ms.
@Throttle(500)
class IncreaseBMessage extends EventMessage {}
```
