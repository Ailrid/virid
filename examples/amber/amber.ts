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
  Message,
} from "@virid/core";
import { Amber, AmberPlugin, defaultOptions, Backup } from "@virid/amber";

async function wait() {
  await new Promise<void>((resolve) => resolve());
}
// The content of defaultOptions is as follows, the first three are default simple copy functions
// The last two determine the maximum historical length of each component
// and the maximum historical length of a tick, respectively

// interface PluginOptions {
//   serialization: (instance: any) => any;
//   deserialization: (instance: any, data: any) => any;
//   diff: (data: any, instance: any) => boolean;
//   maxComponentLength: number;
//   maxTickLength: number;
// }

const app = createVirid().use(AmberPlugin, defaultOptions);

// In the plugin level configuration, all components marked with Backup will default to this configuration
@Backup()
@Component()
class CounterA {
  public count = 0;
}
// At the same time, you can also define your own component level backup methods and hooks,
// which support the following configurations
// export interface BackupStrategy<T = any, C = any> {
//   serialize?: (instance: T) => C;
//   deserialize?: (instance: T, data: C) => void;
//   diff?: (oldData: C, instance: T) => boolean;
//   onBeforeBackup?: (oldData: C) => void;
//   onAfterBackup?: (newData: C) => void;
//   onRestore?: (oldData: C, newData: C, direction: RestoreDirection) => void;
// }
@Backup({
  serialize: (instance) => {
    return {
      count: instance.count,
    };
  },
  deserialize: (instance, data) => {
    instance.count = data.count;
  },
  diff: (data, instance) => data.count !== instance.count,
  onBeforeBackup: (oldData) => {
    console.log(`[Before backup]: ${JSON.stringify(oldData)}`);
  },
  onAfterBackup: (newData) => {
    console.log(`[After backup]: ${JSON.stringify(newData)}`);
  },
  onRestore: (oldData, newData, direction) => {
    console.log(
      `[Restore] Direction: ${direction}, Old: ${JSON.stringify(oldData)} -> New: ${JSON.stringify(newData)}`,
    );
  },
})
@Component()
class CounterB {
  public count = 0;
}

app.bindComponent(CounterA);
app.bindComponent(CounterB);

class IncreaseMessage extends EventMessage {}
class PrintMessage extends EventMessage {
  constructor(public order: "A" | "B") {
    super();
  }
}

class CounterSystem {
  // Once these two functions are executed,
  // Amber will know that the component has changed and record the version of the component
  @System({
    messageClass: IncreaseMessage,
  })
  static increaseA(counter: CounterA) {
    counter.count++;
  }

  @System({
    messageClass: IncreaseMessage,
  })
  static increaseB(counter: CounterB) {
    counter.count++;
  }

  // Although these two components are used here,
  // Amber can know that no backup is needed because the values have not been changed
  @System()
  static print(
    @Message(PrintMessage) message: PrintMessage,
    counterA: CounterA,
    counterB: CounterB,
  ) {
    if (message.order === "A") console.log(`[CounterA]: ${counterA.count}`);
    else console.log(`[CounterB]: ${counterB.count}`);
  }
}

async function main() {
  //------------Tick 0 start-------------
  console.log("\n>>> Phase 1: Data Change");
  // Firstly, we print the values of the components twice
  PrintMessage.send("A");
  PrintMessage.send("B");
  await wait();
  // Then we check the version number
  console.log(`[Version A]: ${Amber.getVersion(CounterA)}`);
  console.log(`[Version B]: ${Amber.getVersion(CounterB)}`);
  //------------Tick 0 end-------------

  //------------Tick 1 start-------------
  // Now we make two changes
  IncreaseMessage.send();
  IncreaseMessage.send();
  await wait();
  // Then we checked the version numbers, and now their version numbers should all be 1
  console.log(`[Version A]: ${Amber.getVersion(CounterA)}`);
  console.log(`[Version B]: ${Amber.getVersion(CounterB)}`);
  //------------Tick 1 end-------------

  //------------Tick 2 start-------------
  // Now let's make another change
  IncreaseMessage.send();
  await wait();
  // Then we checked the version numbers, and now their version numbers should all be 2
  // The values of these two Counters should both be 3
  console.log(`[Version A]: ${Amber.getVersion(CounterA)}`);
  console.log(`[Version B]: ${Amber.getVersion(CounterB)}`);
  //------------Tick 2 end-------------

  // From now on, the values in both A and B are 3
  // Their versions are also 2

  console.log("\n>>> Phase 2: Simulated Revocation");
  // We undo Counter A twice, value 3->0
  // Why did we only roll back twice, but the value became 0?
  // This is because our second consecutive two changes occurred within one tick, so they were merged
  Amber.undo(CounterA);
  Amber.undo(CounterA);
  // The version number will also be rolled back，2->0
  console.log(`[Version A]: ${Amber.getVersion(CounterA)}`);
  // Then let's print it out and see the results
  PrintMessage.send("A");
  await wait();
  // Now we are creating a 'new future' in the 'past', and the version will be trimmed
  // This will also trigger a change in B, and B's version number will be +1
  IncreaseMessage.send();
  await wait();
  // This should be false because our future has already been deleted
  console.log(`[CanRedo A]: ${Amber.canRedo(CounterA)}`);
  // Finally, let's try making changes to CounterB to see if our features can work properly
  Amber.undo(CounterB);
  Amber.redo(CounterB);
  // The version here should still be 3, why? Because of our IncreaseMessage.send() above; Once triggered a change
  console.log(`[Version B]: ${Amber.getVersion(CounterB)}`);
  // Should the value not change, 4
  PrintMessage.send("B");
  await wait();
}
main();
