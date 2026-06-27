/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid
 */
// This file demonstrates the basic usage of CCS architecture
// You need to import 'reflect metadata' in the first line;
import "reflect-metadata";
import {
  createVirid,
  Component,
  System,
  MessageWriter,
  Observer,
  EventMessage,
} from "@virid/core";
// This example demonstrates how to automatically trigger side effects when modifying variables on a component
const app = createVirid();

@Component()
class Counter {
  // Through Observer, you can set up some automation tasks,
  // similar to Vue's shallowReactive. When you replace the entire value, this callback function will work

  @Observer((oldVal, newVal) => {
    MessageWriter.info(
      `Counter has changed from ${oldVal} to ${newVal}! I should go do some extra things now`,
    );
  })
  public count = 0;
}
app.bind(Counter);

class IncreaseMessage extends EventMessage {}

class CounterSystem {
  @System({
    messageClass: IncreaseMessage,
  })
  static increase(counter: Counter) {
    counter.count++;
  }
}
app.register(CounterSystem.increase);

IncreaseMessage.send();
IncreaseMessage.send();
IncreaseMessage.send();
IncreaseMessage.send();
async function wait() {
  await new Promise<void>((resolve) => resolve());
}

wait();
// final output:
// ✔ [Virid Info] Global Info Caught:
// Details: Counter has changed from 0 to 1! I should go do some extra things now
//  ✔ [Virid Info] Global Info Caught:
// Details: Counter has changed from 1 to 2! I should go do some extra things now
//  ✔ [Virid Info] Global Info Caught:
// Details: Counter has changed from 2 to 3! I should go do some extra things now
//  ✔ [Virid Info] Global Info Caught:
// Details: Counter has changed from 3 to 4! I should go do some extra things now
