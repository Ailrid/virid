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
app.bindComponent(Counter);

class IncreaseMessage extends EventMessage {}

class CounterSystem {
  @System({
    messageClass: IncreaseMessage,
  })
  static increase(counter: Counter) {
    counter.count++;
  }
}

IncreaseMessage.send();
IncreaseMessage.send();
IncreaseMessage.send();
IncreaseMessage.send();
async function wait() {
  await new Promise<void>((resolve) => resolve());
}

wait();
