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
  SingleMessage,
  EventMessage,
  MessageWriter,
  ViridApp,
} from "@virid/core";
// This example demonstrates the basic usage of CCS architecture
const app = createVirid();

// Mark and bind this component
@Component()
class Counter {
  public count = 0;
}
// Mark and bind this component
@Component()
class DynamicCounter {
  constructor(public count: number) {}
}

// Only bind Counter
app.bind(Counter);

// Here we demonstrate three uses, namely SingleMessage that can be merged, EventMessage that cannot be merged
// And how to carry data in messages
class IncreaseMessage extends SingleMessage {}
class DecreaseMessage extends EventMessage {}
class SetValueMessage extends SingleMessage {
  constructor(public value: number) {
    super();
  }
}

class CounterSystem {
  // Use batch processing mode, Using batch processing mode, messages of this type within the micro tick will be merged and passed to the system
  @System({
    messageClass: IncreaseMessage,
  })
  static increase(message: IncreaseMessage[], counter: Counter) {
    console.log(
      `${message.length} Increase message received, current count: ${counter.count}.`,
    );
    for (let i = 0; i < message.length; i++) {
      counter.count++;
    }
    console.log(`Increase message processed, current count: ${counter.count}.`);
  }
  // If you don't need the content of the message
  // you can directly use the messageClass parameter to specify it
  @System({
    messageClass: DecreaseMessage,
  })
  static decrease(counter: Counter) {
    counter.count--;
    console.log(`Decrease message received, current count: ${counter.count}.`);
  }

  // Alternatively, you can injection
  @System({
    priority: 100,
  })
  static setValue(message: SetValueMessage, counter: Counter) {
    counter.count = message.value;
    console.log(`Set value message received, current count: ${counter.count}.`);
  }
}
app.register(CounterSystem.increase);
app.register(CounterSystem.decrease);
app.register(CounterSystem.setValue);

class PrintDynamicMessage extends EventMessage {}
class DynamicBindMessage extends EventMessage {}

class DynamicCounterSystem {
  @System({
    messageClass: DynamicBindMessage,
  })
  static bind(app: ViridApp, counter: Counter) {
    const dynamicCounter = new DynamicCounter(counter.count);
    app.spawn(dynamicCounter);
    console.log(`Dynamic Counter Binding Success.`);
  }

  @System({
    messageClass: PrintDynamicMessage,
  })
  static print(counter: DynamicCounter) {
    console.log(`Dynamic Counter print: ${counter.count}.`);
  }
}
app.register(DynamicCounterSystem.bind);
app.register(DynamicCounterSystem.print);

// Due to inheriting from SingleMessage, these two messages will be merged within a micro task queue
IncreaseMessage.send();
IncreaseMessage.send();
// Due to inheriting from EventMessage, decay will be executed twice
DecreaseMessage.send();
// Alternatively, you can directly use a Message Writer to send messages
MessageWriter.write(new DecreaseMessage());
// The priority of this function is 100, so in terms of priority, setValue will be executed first
// When the constructor in the message has parameters, you can directly fill them into the. send method
SetValueMessage.send(1000);

DynamicBindMessage.send();
PrintDynamicMessage.send();

// In the end, the order of system execution is:
// SetValueMessage ->DecreaseMessage ->DecreaseMessage->DynamicBindMessage
// ->PrintDynamicMessage->2*IncreaseMessage

// This is because by default, EventMessage will always execute before SingleMessage

async function wait() {
  await new Promise<void>((resolve) => resolve());
}

wait();
// final output:
// Set value message received, current count: 1000.
// Decrease message received, current count: 999.
// Decrease message received, current count: 998.
// Dynamic Counter Binding Success.
// Dynamic Counter print: 998.
// 2 Increase message received, current count: 998.
// Increase message processed, current count: 1000.