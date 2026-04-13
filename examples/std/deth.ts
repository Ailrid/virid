/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid
 */
// This example demonstrates how to use debounce and throttle.
// With just one line of code, Virid will be responsible for the native support of debounce and throttle operations

import "reflect-metadata";
import {
  createVirid,
  Component,
  System,
  EventMessage,
  Message,
} from "@virid/core";
import { Debounce, Throttle, StdPlugin } from "@virid/std";

const app = createVirid().use(StdPlugin, {});

@Component()
class Counter {
  public timerA = 0;
  public timerB = 0;
}
app.bindComponent(Counter);

// 100ms debounce: It will only be executed once after stopping triggering for 100ms
@Debounce(100, (current, next) => {
  current.val += next.val;
})
class SetTimerAMessage extends EventMessage {
  constructor(public val: number) {
    super();
  }
}

// 100ms throttling: Only one trigger is allowed within 100ms
@Throttle(500)
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
