import "reflect-metadata";
import {
  createVirid,
  Component,
  System,
  Message,
  AtomicModifyMessage,
  DebounceMessage,
} from "@virid/core";

// Define anti shake messages with merge logic
class MoveMessage extends DebounceMessage {
  readonly debounceTime = 100; // 100ms 

  constructor(
    public x: number,
    public y: number,
  ) {
    super();
  }

  // Data Evolution/Merge
  debounceCallback(previousMessage: MoveMessage) {
    console.log(
      `[Debounce] Merge displacement: Original(${previousMessage.x}, ${previousMessage.y}) -> New(${this.x}, ${this.y})`,
    );
    this.x += previousMessage.x;
    this.y += previousMessage.y;
  }
}

// Define data entities
@Component()
class PlayerComponent {
  public position = { x: 0, y: 0 };
}

// Define system processing logic
class MoveSystem {
  @System()
  static onMove(
    @Message(MoveMessage) msg: MoveMessage,
    player: PlayerComponent,
  ) {
    console.log(
      `[System] Execute movement: The final displacement is (${msg.x}, ${msg.y})`,
    );
    player.position.x += msg.x;
    player.position.y += msg.y;
  }
}

const app = createVirid();
app.bindComponent(PlayerComponent);


async function runTest() {
  console.log(
    "=== Scenario 1: High frequency continuous transmission (should trigger merging) ===",
  );

  //Simulate fast sending within a micro task and trigger debouncerollback logic
  MoveMessage.send(10, 0); // First time: Normal entry into Map
  MoveMessage.send(20, 0); // Second time: Merge 10+20=30
  MoveMessage.send(30, 0); // Third time: Merge 30+30=60

  // Waiting for the first Tick to complete execution
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Scenario 1 Verification
  AtomicModifyMessage.send(
    PlayerComponent,
    (p) => {
      console.log(
        `[Check] Scenario 1 ends, current coordinates (${p.position.x}, ${p.position.y})`,
      );

      //Expected result: Due to the asynchronous batch processing of virid, the System may receive 3 message instances
      //But the last two instances, after debouncerollback, became carrying payloads of 30 and 60
    },
    "test",
  );

  console.log(
    "\n=== Scenario 2: Wait for expiration before sending (should not be merged) ===",
  );

  //Wait for 150ms, exceeding the message definition of 100ms debounceTime
  await new Promise((resolve) => setTimeout(resolve, 150));

  console.log("[Test] The window period has expired, initiate a new move...");
  MoveMessage.send(5, 5);

  await new Promise((resolve) => setTimeout(resolve, 50));

  // Scenario 2 Verification
  AtomicModifyMessage.send(
    PlayerComponent,
    (p) => {
      console.log(
        `[Check] Scenario 2 ends, final coordinates: (${p.position.x}, ${p.position.y})`,
      );
      // Expected result: The coordinates should be (X+5, Y+5), without any previous accumulation
    },
    "test",
  );
}

runTest();
