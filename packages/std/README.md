# @virid/std

`@virid/std` 是 `@virid/core`的官方标准库，负责提供一组开箱即用的实用消息控制流操作。提供了原生的异步流、消息组、防抖节流等支持。

## 🔌启用插件

```ts
import { createVirid, Component, System, EventMessage } from "@virid/core";
import { nextTick, StdPlugin } from "@virid/std";

const app = createVirid().use(StdPlugin, {});
```

## 🛠️ @virid/std 核心 API 概览

### nextTick

- **功能**：类似于`vue`中的`nextTick`，但该`Tick`指的是一个`virid`的宏观`Tick`，因此，当执行时该`Tick`内的所有同步`System`已经全部执行完毕，对于异步控制，则需要使用`@AsyncQueue`装饰器
- **示例：**

```ts
nextTick(() => {
  IncreaseBMessage.send();
  IncreaseAMessage.send();
  IncreaseBMessage.send();
});
```

### `@AsyncQueue()`

- **功能**：`@AsyncQueue()`提供了一个开箱即用的异步消息控制，该装饰器接受一个参数key，对于key相同的message，将严格按照先后顺序执行，而不会出现异步竟态问题。
- **示例：**

```ts
@AsyncQueue("increase")
class IncreaseAMessage extends EventMessage {}
@AsyncQueue("increase")
class IncreaseBMessage extends EventMessage {}
@AsyncQueue("decrease")
class DecreaseMessage extends EventMessage {}

// 按以下顺序发送消息
// 由于IncreaseMessage和IncreaseBMessage的key是相同的，
// 即使存在异步操作，以下三条消息也必须按顺序执行
IncreaseAMessage.send();
IncreaseBMessage.send();
IncreaseAMessage.send();
// 由于DecaseMessage和其他消息之间的key不同
// DecaseMessage不会等待上述消息
// 但是，以下三条消息将按顺序执行
DecreaseMessage.send();
DecreaseMessage.send();
DecreaseMessage.send();
```

### `executeGroup`

- **功能**：`executeGroup`是一组消息的集合，将一组消息严格按照先后顺序一次性执行，并且当途中出错时取消后续逻辑。
- **示例：**

```ts
const a = await executeGroup(
[
  new IncreaseAMessage(),
  new IncreaseBMessage(),
  new IncreaseAMessage(),
  new DecreaseMessage(),
],
"first",
);
if (a) {
console.log("[ExecuteGroup] Success");
} else {
console.log("[ExecuteGroup] Failed");
}
```

### `@Debounce（）/@Throttle`

- **功能**：开箱即用的防抖与节流支持。只需要一行代码即可实现。
- **示例：**

```ts
// 100ms防抖：停止触发100ms后只执行一次
// 后一个参数用于聚合消息
@Debounce(100, (current, next) => {
  current.val += next.val;
})
class SetTimerAMessage extends EventMessage {
  constructor(public val: number) {
    super();
  }
}

// 100ms节流：100ms内只允许一次触发
@Throttle(500)
class IncreaseBMessage extends EventMessage {}
```
