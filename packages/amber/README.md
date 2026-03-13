### **@virid/amber**

`@virid/amber` acts as the "Time Machine" for `@virid/core`. It is responsible for the automated persistence and recording of tagged Components, providing both global and Component-level **Undo/Redo** functionality. It supports Component-level customization, side-effect triggers, and a wide array of hooks.

### 🌟 **Core Design Philosophy**

In `@virid/amber`, Undo and Redo operations are fully automated and **zero-intrusive**. There is no need for manual backup logic within your business code.

- **Component-Level & Global Tick Rollback:** By using `@virid/amber`, you can choose to roll back a specific local state without affecting the whole system, or revert all changes within an entire Tick at once. This offers flexible control over both local and global state transitions.
- **Zero Business Intrusion:** The automatic backup functionality of `@virid/amber` executes automatically during every Tick. Developers only need to define how to compare, back up, and restore the data; `@virid/amber` handles the data management, persistence, and recovery seamlessly.
- **Side-Effect Hooks:** `@virid/amber` provides an extensive set of side-effect hooks, allowing developers to decide exactly how to handle side effects generated during the Undo/Redo process.

## 🔌Enable plugins

```ts
import { createVirid } from '@virid/core'
import { AmberPlugin, Backup, Amber } from "@virid/amber";
const app = createVirid()
app.use(AmberPlugin, {});
```

## 🛠️ @virid/amber Core API Overview

### **1. @Backup(options?: BackupOptions)**

- **Function:** Applied to a `Component` to notify Amber that this component requires state persistence and version tracking.
- **Logic:** At the end of every Tick, Amber automatically identifies modified components and creates a snapshot based on the defined configuration.
- **Example:**

```ts
@Component()
@Backup({
  // The onRestore hook handles side effects during undo/redo
  onRestore: (oldData, newData, direction) => {
    console.log(
      `[Hook] Restore direction: ${direction}. Data changed from ${oldData.count} -> ${newData.count}`
    );
  },
  // Execution logic before/after the backup process
  onBeforeBackup(oldData) {
    console.log(`[Hook] Preparing backup: current count is ${oldData.count}`);
  },
  onAfterBackup(newData) {
    console.log(`[Hook] Backup complete: new count is ${newData.count}`);
  },
  // Custom logic for comparison, storage, and restoration
  // Useful for complex data types or optimizing performance by avoiding full deep copies
  diff(oldData: any, component: PlayerComponent) {
    return oldData.count !== component.count;
  },
  serialize(player: PlayerComponent) {
    return { count: player.count };
  },
  deserialize(component: PlayerComponent, newData: { count: number }) {
    component.count = newData.count;
  },
})
class PlayerComponent {
  public count = 0;
}
```

------

### **2. Amber (Global Manager)**

- **Function:** The global `Amber` class provides centralized control over component versions, enabling both component-specific and global Tick-based Undo/Redo.
- **Example:**

```ts
// Undo/Redo for a specific component type
Amber.undo(PlayerComponent); 
Amber.redo(PlayerComponent); 

// Undo/Redo for the entire global Tick
Amber.undoTick();
Amber.redoTick();

// Clear all version history and record logs
Amber.resetAll();
```

------

### ⚠️ **Important Considerations**

#### **State Synchronization Philosophy**

To resolve inconsistencies between global and local state versions, Amber adopts a specific philosophy: **"A global Undo/Redo is a local update; a local Undo/Redo is a global update."** * When you perform an Undo/Redo on a specific **Component**, the global **Tick** count increments.

- Conversely, when you perform an Undo/Redo on the current **Tick**, all affected components generate new versions.
-  Amber can implement "tick redo can redo component redo", but this often leads to confusion, so in most cases, only one function is recommended.

#### **Linear Timeline Model**

Amber utilizes a standard **Linear Timeline** model. If a new history (state change) is generated while the system is in a "past" state (after an undo), any "already occurred futures" between that past point and the new history will be truncated (discarded) to maintain a single cohesive timeline.