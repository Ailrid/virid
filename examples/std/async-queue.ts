/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid
 */
import "reflect-metadata";
import {
  createVirid,
  Component,
  System,
  EventMessage,
} from "@virid/core";
import { AsyncMessage, StdPlugin } from "@virid/std";
// This example demonstrates how to use asynchronous queues, 
// where messages marked with the same key will be sorted and executed in the order they were sent
const app = createVirid().use(StdPlugin, {});

@Component()
class Counter {
  public timeA = 0;
  public timeB = 0;
  public timeC = 100;
}

app.bindComponent(Counter);
// With just one line of code,
// virid ensures that a set of messages with the same key,
// even if the system is asynchronous, will always follow the order of sending.
@AsyncMessage("increase")
class IncreaseAMessage extends EventMessage {}
@AsyncMessage("increase")
class IncreaseBMessage extends EventMessage {}
@AsyncMessage("decrease")
class DecreaseMessage extends EventMessage {}

class CounterSystem {
  @System({
    messageClass: IncreaseAMessage,
  })
  static async increaseA(counter: Counter) {
    await new Promise<void>((resolve) => setTimeout(resolve, 3000));
    counter.timeA++;
    console.log("A :>> ", counter.timeA);
  }
  @System({
    messageClass: IncreaseBMessage,
  })
  static async increaseB(counter: Counter) {
    await new Promise<void>((resolve) => setTimeout(resolve, 3000));
    counter.timeB++;
    console.log("B :>> ", counter.timeB);
  }
  // If there are multiple systems listening for the same message,
  // then when one of these systems completes execution, subsequent queued messages will continue to execute
  @System({
    messageClass: DecreaseMessage,
  })
  static async decrease(counter: Counter) {
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    counter.timeC--;
    console.log("C :>> ", counter.timeC);
  }
  @System({
    messageClass: DecreaseMessage,
  })
  static async decreaseLonger() {
    await new Promise<void>((resolve) => setTimeout(resolve, 2000));
    console.log("C, which took longer to execute, has been completed");
  }
}

// Send messages in the following order
// Due to the fact that the keys for IncreaseAMessage and IncreaseBMessage are the same,
// the following three messages must be executed sequentially, even if there are asynchronous operations
IncreaseAMessage.send();
IncreaseBMessage.send();
IncreaseAMessage.send();
// Due to the difference in key between DeceaseMessage and other messages,
// DeceaseMessage will not wait for the above message
// However, the following three messages will be executed in sequence
DecreaseMessage.send();
DecreaseMessage.send();
DecreaseMessage.send();
// Therefore, the final execution order is
// ->DecreaseMessage
// C :>>  99
// C, which took longer to execute, has been completed

// ->DecreaseMessage
// C :>>  97
// ->IncreaseAMessage
//  This system was asynchronously paused before and resumed execution after 2 seconds,
//  so it will jump the queue and appear
// A :>>  1
// C, which took longer to execute, has been completed

// ->DecreaseMessage
// C :>>  97
// C, which took longer to execute, has been completed

// ->IncreaseBMessage
// B :>>  1

// ->IncreaseAMessage
// A :>>  2
