# virid

## [中文说明](README.zh.md)

**A deterministic, message-driven engine written in TypeScript, built for heavy-duty logic.**

`virid` completely decouples business logic from the fragments of UI frameworks, constructing a micro-distributed core with **location transparency**, **temporal reversibility**, and **inter-process sovereignty**.

---

### 🛠️ Core Concepts

By thoroughly decoupling logic from views, `virid` solves the problems of "state drift" and "spaghetti logic" in large-scale frontend and Electron projects. Its core operational mechanisms are as follows:

**Environment-Agnostic Logic Kernel：**Business logic runs entirely within `@virid/core`, independent of DOM/BOM APIs. This allows the same core logic to run seamlessly across the **Electron Main process**, **Renderer processes**, or **Node.js** environments.

**Unidirectional Data Projection**：The UI layer (e.g., Vue) connects via `@virid/vue` and acts strictly as a **read-only view** of the logic layer's data. The system physically blocks the view layer from directly modifying state, ensuring a single, authoritative source of truth for all data changes.

**Command-Driven Asynchronous Scheduling**：Every state change must be triggered by a `Message`. The `Dispatcher` processes messages using a **Tick mechanism** (inspired by game engines), where `Systems` perform business computations. This ensures the execution order of logic is deterministic and predictable.

## 📦 Module composition

| **Module**            | **Role**                               | **Key Features**                                             |
| --------------------- | -------------------------------------- | ------------------------------------------------------------ |
| **`@virid/core`**     | **Logic Kernel**                       | **Deterministic Tick mechanism, Double-buffered message pool, Inversion of Control (IoC).** |
| **`@virid/vue`**      | **UI Projection**                      | **Reactive Projections, Dependency Tethering, Lifecycle Bridging.** |
| **`@virid/bridge`**   | **IPC Transport**                      | **Underlying messaging layer for Electron cross-process communication.** |
| **`@virid/renderer`** | **Renderer Bridge**                    | **Renderer-side message dispatching, Main-process message deserialization.** |
| **`@virid/main`**     | **Main Bridge**                        | **Intelligent message routing, Multi-window message forwarding & arbitration.** |
| **`@virid/amber`**    | **Causal State Management**            | **Message replay, Temporal state recovery, Multi-track Undo/Redo.** |
| **`@virid/express`**  | **HTTP request to message conversion** | **Convert express requests into messages and process them in the system, providing dependency injection functionality similar to NestJS** |

### 🎯 Key Advantages

- **Deterministic Logic Execution**: By implementing a game-engine-inspired **Tick scheduling mechanism** and **double-buffered message pools**, `virid` completely eliminates "Race Conditions" and logic jitter commonly found in complex UI interactions.

- **Native Support for Automated Testing**: Since the logic kernel is entirely decoupled from the DOM, developers can achieve **100% business logic test coverage** in pure Node.js or Vitest environments. By simulating message sequences, you can verify complex behaviors without the need for any UI-level mocking.

- **Rigorous State Mutation Auditing**: Built on a unidirectional data flow and command-driven pattern, the system automatically records every state change triggered by a message. This provides the foundational infrastructure for **Time Machine (Undo/Redo)**, operation log auditing, and precise fault reproduction.

- **Seamless Cross-Process Communication**: Specifically optimized for the Electron ecosystem. The built-in **Transparent Message Routing** simplifies complex IPC communication into standard message dispatches, significantly reducing the development overhead for multi-window and multi-process collaborative applications.

### 🔗 Deep Dive

For detailed implementation details and quick-start examples, please refer to the documentation in each sub-package:

- 👉 **[@virid/core](packages/core/README.md)** – Learn about the **CCS Architecture**, message scheduling, and state management.
- 👉 **[@virid/vue](packages/vue/README.md)** – Learn how to **project logic** onto the Vue view layer.
- 👉 **[@virid/bridge](packages/bridge/README.md)** – Learn how to initialize **Electron preload scripts**.
- 👉 **[@virid/renderer](packages/renderer/README.md)** – Learn how to dispatch messages from the **Renderer process** directly to the **Main process**.
- 👉 **[@virid/main](packages/main/README.md)** – Learn how the **Main process** handles and routes messages from Renderer processes.
- 👉 **[@virid/amber](packages/amber/README.md)** – Learn how to implement **message replay** and **Undo/Redo** functionality.
- 👉 **[@virid/express](packages/express/README.md)** –Learn how to **control express** in virid.
-  👉 **[Comprehensive Example](https://github.com/Ailrid/starry)** – Learn how to use virid to build the entire application
