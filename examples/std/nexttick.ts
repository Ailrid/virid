/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid
 */
import "reflect-metadata";
import { createVirid, Component, System, EventMessage } from "@virid/core";
import { nextTick, StdPlugin } from "@virid/std";
// This example demonstrates how to automatically execute some characters at the beginning of the next tick
// Enable support for Std plugin
const app = createVirid().use(StdPlugin, {});

@Component()
class Counter {
  public timeA = 0;
  public timeB = 0;
  public timeC = 100;
}

app.bindComponent(Counter);

class IncreaseAMessage extends EventMessage {}
class IncreaseBMessage extends EventMessage {}

class CounterSystem {
  @System({
    messageClass: IncreaseAMessage,
  })
  static async increaseA(counter: Counter) {
    counter.timeA++;
    console.log("A :>> ", counter.timeA);
  }
  @System({
    messageClass: IncreaseBMessage,
  })
  static async increaseB(counter: Counter) {
    counter.timeB++;
    console.log("B :>> ", counter.timeB);
  }
}
app.onAfterTick(() => {
  console.log("----------After Tick----------");
});

app.onBeforeTick(() => {
  console.log("----------Before Tick----------");
});

IncreaseAMessage.send();
nextTick(() => {
  // These three messages must have been run after the last Tick ended
  // Therefore, if the message corresponding to Increase AMessage is synchronized,
  // then the execution has already been completed
  // If the system corresponding to Increase AMessage is asynchronous,
  // then you need an async-queue(see async-queue) to ensure order instead of NextTick
  IncreaseBMessage.send();
  IncreaseAMessage.send();
  IncreaseBMessage.send();
  // The final execution sequence should look like this
  // ----------Before Tick----------
  // A :>>  1
  // ----------After Tick----------
  // ----------Before Tick----------
  // B :>>  1
  // A :>>  2
  // B :>>  2
  // ----------After Tick----------
});
