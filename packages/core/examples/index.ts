//'reflect-metadata' must be imported to work
import "reflect-metadata";
import {
  createVirid,
  Component,
  System,
  Message,
  SingleMessage,
  AtomicModifyMessage,
  BaseMessage,
} from "@virid/core";
// Define operation instructions (Message)
class IncrementMessage extends SingleMessage {
  constructor(public amount: number) {
    super();
  }
}
// Initialize the core engine
const app = createVirid();

app.onBeforeTick(() => {
  console.log("----------------onBeforeTick------------------");
});
// Add execution hook
app.onBeforeExecute(BaseMessage, (message, context) => {
  console.log("----------------onBeforeExecute------------------");
  console.log("message :>> ", message);
  console.log("context :>> ", context);
  // console.log("methodName :>> ", context.context.methodName);
  // console.log("params :>> ", context.context.params);
});

app.onAfterExecute(BaseMessage, (message, context) => {
  console.log("----------------onAfterExecute------------------");
});

app.onAfterTick(() => {
  console.log("----------------onAfterTick------------------");
});
// Define Data Entity (Component)
@Component()
class CounterComponent {
  public count = 0;
}
//Define System
class CounterSystem {
  // single = true (default): Process each message one by one
  @System()
  static onIncrement(
    @Message(IncrementMessage) message: IncrementMessage,
    count: CounterComponent,
  ) {
    console.log("---------------------onIncrement----------------------");
    console.log("message :>> ", message);
    count.count += message.amount;
  }
  // single = true (default): Process each message one by one
  @System({
    priority: 100,
  })
  static onIncrementPriority(
    @Message(IncrementMessage) message: IncrementMessage,
    count: CounterComponent,
  ) {
    console.log(
      "---------------------onIncrementPriority----------------------",
    );
    console.log("message :>> ", message);
    count.count += message.amount;
  }
  // single = false: Process all messages of this type in the current tick as an array
  // Great for high-performance batch updates or physics/logic merging
  @System()
  static async onIncrementArray(
    @Message(IncrementMessage, false) message: IncrementMessage[],
  ) {
    throw new Error("Not implemented");
  }
}

// Register component
app.bindComponent(CounterComponent);

// Business logic automatically completes scheduling in the next microtask
queueMicrotask(() => {
  // virid will batch messages sent in the same microtask
  // These two messages will be processed in a single 'Tick'
  IncrementMessage.send(1);
  IncrementMessage.send(5);
  // Output expected:
  // ---------------------System----------------------
  // IncrementMessage num :>> 2  (Caught by onIncrementArray)
  // ---------------------System----------------------
  // message :>> { amount: 5 }   (Caught by onIncrement - 2nd)
  queueMicrotask(() => {
    AtomicModifyMessage.send(
      CounterComponent,
      (comp) => {
        console.log("----------------AtomicModifyMessage------------------");
        console.log("CounterComponent :>> ", comp);
      },
      "Check CounterComponent",
    );
  });
});
