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
  Message,
  SingleMessage,
  EventMessage,
  MessageWriter,
} from "@virid/core";

const app = createVirid();

// Mark and bind this component
@Component()
class Counter {
  public count = 0;
}
app.bindComponent(Counter);

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
  // If you don't need the content of the message
  // you can directly use the messageClass parameter to specify it
  @System({
    messageClass: IncreaseMessage,
    priority: 10,
  })
  public increase(counter: Counter) {
    counter.count++;
    MessageWriter.info(
      `Increase message received, current count: ${counter.count}`,
    );
  }

  @System({
    messageClass: DecreaseMessage,
  })
  public decrease(counter: Counter) {
    counter.count--;
    MessageWriter.info(
      `Decrease message received, current count: ${counter.count}`,
    );
  }
  // Alternatively, you can use @ Message to achieve injection
  @System({
    priority: 100,
  })
  public setValue(
    @Message(SetValueMessage) message: SetValueMessage,
    counter: Counter,
  ) {
    counter.count = message.value;
    MessageWriter.info(
      `Set value message received, current count: ${counter.count}`,
    );
  }
}

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
// In the end, the order of system execution is: setValue ->increase ->decrease ->decrease
// The final count is 0->1000->1001->1000->999

async function wait() {
  await new Promise<void>((resolve) => resolve());
}

wait();
