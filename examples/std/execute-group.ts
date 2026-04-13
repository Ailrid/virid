/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid
 */
import "reflect-metadata";
import { createVirid, Component, System, EventMessage } from "@virid/core";
import { executeGroup, StdPlugin } from "@virid/std";
// This example demonstrates how to use message groups,
// where messages within a message group will be executed sequentially and must all succeed

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
class DecreaseMessage extends EventMessage {}
class WillErrorMessage extends EventMessage {}

class CounterSystem {
  @System({
    messageClass: IncreaseAMessage,
  })
  static async increaseA(counter: Counter) {
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    counter.timeA++;
    console.log("A :>> ", counter.timeA);
  }
  @System({
    messageClass: IncreaseBMessage,
  })
  static async increaseB(counter: Counter) {
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    counter.timeB++;
    console.log("B :>> ", counter.timeB);
  }
  @System({
    messageClass: DecreaseMessage,
  })
  static async decrease(counter: Counter) {
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    counter.timeC--;
    console.log("C :>> ", counter.timeC);
  }
  @System({
    messageClass: WillErrorMessage,
  })
  static async willError() {
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    throw new Error("Error");
  }
}
// An execution group is a collective operation.
// Regardless of whether the system triggered by these messages is synchronous or asynchronous,
// they will execute sequentially and must not throw any errors
//

async function main() {
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
  // When the previous group has not been executed, first cannot be used as the key again
  // The following group will be interrupted when executing WillError Message and will not execute Increase AMessage again
  const b = await executeGroup(
    [
      new IncreaseAMessage(),
      new IncreaseBMessage(),
      new WillErrorMessage(),
      new DecreaseMessage(),
    ],
    "second",
  );
  if (b) {
    console.log("[ExecuteGroup] Success");
  } else {
    console.log("[ExecuteGroup] Failed");
  }
}

main();
// A :>>  1
// B :>>  1
// A :>>  2
// C :>>  99
// [ExecuteGroup] Success
// A :>>  3
// B :>>  2
//  ✖ [Virid Error] Global Error Caught:
//   Context:
//   Details: Error: [ExecuteGroup] Queue Execution Failed: Due to an error in the System execution triggered by WillErrorMessage, the message group 'second' has been cancelled
