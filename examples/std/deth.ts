/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid
 */
// This example demonstrates how to use anti shake and throttling.
// With just one line of code, Virid will be responsible for the native support of anti shake and throttling operations

import "reflect-metadata";
import {
  createVirid,
  Component,
  System,
  EventMessage,
  Message,
} from "@virid/core";
import { debounce, throttle, StdPlugin, activateDeTh } from "@virid/std";

const app = createVirid().use(StdPlugin, {});
// 别忘了激活中间件逻辑
activateDeTh(app);

@Component()
class Counter {
  public timerA = 0;
  public timerB = 0;
}
app.bindComponent(Counter);

// 100ms 防抖：只有停止触发 100ms 后才会执行一次
@debounce(100, (current, next) => {
  current.val += next.val;
})
class SetTimerAMessage extends EventMessage {
  constructor(public val: number) {
    super();
  }
}

// 100ms 节流：100ms 内只允许触发一次
@throttle(500)
class IncreaseBMessage extends EventMessage {}

class CounterSystem {
  @System()
  static async increaseA(
    @Message(SetTimerAMessage) message: SetTimerAMessage,
    counter: Counter,
  ) {
    counter.timerA = message.val;
    console.log(`[CounterSystem] TImer A executed. Current: ${counter.timerA}`);
  }

  @System({ messageClass: IncreaseBMessage })
  static async increaseB(counter: Counter) {
    counter.timerB++;
    console.log(`[CounterSystem] Timer B executed. Current: ${counter.timerB}`);
  }
}

async function test() {
  console.log(
    "--------Testing Debounce (100ms delay): Sending 10 messages immediately--------",
  );
  // Due to the merging of data, the final result should be 10 * 100=1000
  for (let i = 0; i < 10; i++) {
    SetTimerAMessage.send(100);
  }

  setTimeout(() => {
    console.log("--------Testing Throttle (100ms limit): Rapid fire--------");
    // Should only be able to print ten times
    const interval = setInterval(() => {
      IncreaseBMessage.send();
    }, 30);

    setTimeout(() => {
      clearInterval(interval);
    }, 1000);
  }, 1500);
}

test();
