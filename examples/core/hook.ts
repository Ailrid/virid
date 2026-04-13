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
} from "@virid/core";
// This example demonstrates how to add custom hooks
const app = createVirid();

// Mark and bind this component
@Component()
class Counter {
  public count = 0;
}
app.bindComponent(Counter);
class IncreaseMessage extends SingleMessage {}
class DecreaseMessage extends EventMessage {}
class TransferMessage extends EventMessage {}

app.useMiddleware((message, next) => {
  if (message instanceof TransferMessage) {
    console.log("Detect TransferMessage! I will transfer it to other thread.");
    return;
  }
  next();
});

// This hook will be executed when the component or controller is new.
// For the component, as it is a global singleton, it will only be executed once
app.addActivationHook((instance) => {
  console.log("----------Activation hook triggered----------");
  console.log(
    `Counter component activated, instance type: ${instance.constructor.name}`,
  );
  return instance;
});

// OnBeforeTick is the earliest triggered and contains a payload where data can be stored
// The stored data can be accessed in onAfterTick
// In addition, these two hooks also have a front parameter.
// When multiple hooks are registered consecutively,
// it can be determined whether the later registered hooks are inserted at the front or back of the hook queue,
// with the default being inserted at the back
app.onBeforeTick((hookContext) => {
  console.log("----------Before Tick hook triggered----------");
  console.log("HookContext: ", hookContext);
  hookContext.payload.data = "Hello from before tick hook";
});
app.onAfterTick((hookContext) => {
  console.log("----------After Tick hook triggered----------");
  console.log("Receive data from before tick hook: ", hookContext.payload.data);
});

// These two hooks will be triggered when the corresponding system is triggered after a specific message type is sent
// The first parameter is the type of the message,
// and all types inherited from the message will trigger the message
// So theoretically, if you listen to BaseMessage, all messages will trigger, just like this
// app.onBeforeExecute(BaseMessage, (hookContext) => {
//  ....
// });
// You can get a lot of information from the trigger functions of these hooks
app.onBeforeExecute(IncreaseMessage, (messages, hookContext) => {
  console.log("----------Before Tick hook triggered----------");
  console.log("Message: ", JSON.stringify(messages));
  // In HookContext, you can obtain the parameter types required by the current system to be executed,
  // the name of the current system, and also have a payload to pass data between hooks
  console.log("HookContext: ", JSON.stringify(hookContext));
});

app.onAfterExecute(DecreaseMessage, (message, hookContext) => {
  console.log("----------After Tick hook triggered----------");
  console.log("Message: ", JSON.stringify(message));
  // The information can be obtained here as above.
  // The difference is that because DecreaseMessage inherits from EventMessage,
  // the message will not be an array
});

class CounterSystem {
  @System({
    messageClass: IncreaseMessage,
  })
  static increase(counter: Counter) {
    counter.count++;
  }

  @System({
    messageClass: DecreaseMessage,
  })
  static decrease(counter: Counter) {
    counter.count--;
  }
}

// Due to inheriting from SingleMessage, these two messages will be merged within a micro task queue
IncreaseMessage.send();
IncreaseMessage.send();
DecreaseMessage.send();
// Although TransferMessage appears to be executed last, 
// since the message is processed in a micro queue, 
// MiddleWare will intercept it first, so the output order is TransferMessage ->DeceaseMessage ->IncreaseMessage[]
// Wait, why DeceaseMessage ->Increase Message []? 
// Okay, this is because by default, EventMessage will always be processed before SingleMessage
TransferMessage.send();


async function wait() {
  await new Promise<void>((resolve) => resolve());
}

wait();
