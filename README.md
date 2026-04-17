# virid

## [中文说明](README.zh.md)

Virid is a deterministic, message-driven engine written in TypeScript, specifically architected for complex Electron applications. It completely strips business logic away from the fragments of UI frameworks, establishing a micro-distributed core with location transparency.

##  Key Features

Virid resolves the issues of "state drift" and "spaghetti logic" in large-scale frontend and Electron projects by decoupling business logic from views. Its core operational mechanisms include:

**Environment-Agnostic Logic Core:** Business logic resides entirely within `@virid/core` without any dependency on DOM/BOM APIs. This allows the same core logic to run seamlessly across Electron’s main process, renderer process, or Node.js environments, ensuring high code reusability even if you switch frontend frameworks.

**Unidirectional Data Projection:** The UI layer integrates via `@virid/vue` and acts strictly as a read-only view of the logic layer. The system prevents direct state modifications from the view layer at the architectural level, ensuring a single source of truth for all data changes.

**Command-Driven Asynchronous Scheduling:** All state changes must be triggered via Messages. The Dispatcher utilizes a tick mechanism—similar to a game engine—to process messages, while "Systems" handle specific business computations to guarantee predictable execution order.

**Abstracted IPC Communication:** Virid provides a comprehensive messaging mechanism between the renderer and main processes that fully abstracts underlying IPC. Communicating across Electron processes with Virid feels identical to local communication.

**Robust Asynchronous Control:** The engine offers native-level support for debouncing, throttling, transactions, and asynchronous timing control. There is no need to introduce external libraries or dependencies for these tasks.

**Zero-Dependency Minimalist Design:** Virid maintains a footprint with zero third-party dependencies, with the sole exception of `reflect-metadata`.

##  Module composition

| **Module**            | **Role**                               | **Key Features**                                             |
| --------------------- | -------------------------------------- | ------------------------------------------------------------ |
| **`@virid/core`**     | **Logic Kernel**                       | **Deterministic Tick mechanism, Double-buffered message pool, Inversion of Control (IoC).** |
| **`@virid/vue`**      | **UI Projection**                      | **Reactive Projections, Dependency Tethering, Lifecycle Bridging.** |
| **`@virid/bridge`**   | **IPC Transport**                      | **Underlying messaging layer for Electron cross-process communication.** |
| **`@virid/renderer`** | **Renderer Bridge**                    | **Renderer-side message dispatching, Main-process message deserialization.** |
| **`@virid/main`**     | **Main Bridge**                        | **Intelligent message routing, Multi-window message forwarding & arbitration.** |
| **`@virid/amber`**    | **Causal State Management**            | **Message replay, Temporal state recovery, Multi-track Undo/Redo.** |
| **`@virid/express`**  | **HTTP request to message conversion** | **Convert express requests into messages and process them in the system, providing dependency injection functionality similar to NestJS** |
| **@virid/std**        | **Core function enhancement**          | **Provide asynchronous message timing control, throttling and debounce, etc** |

##  Deep Dive

For detailed implementation details and quick-start examples, please refer to the documentation in each sub-package:

- 👉 **[@virid/core](packages/core/README.md)** – Learn about the **CCS Architecture**, message scheduling, and state management.
- 👉 **[@virid/vue](packages/vue/README.md)** – Learn how to **project logic** onto the Vue view layer.
- 👉 **[@virid/bridge](packages/bridge/README.md)** – Learn how to initialize **Electron preload scripts**.
- 👉 **[@virid/renderer](packages/renderer/README.md)** – Learn how to dispatch messages from the **Renderer process** directly to the **Main process**.
- 👉 **[@virid/main](packages/main/README.md)** – Learn how the **Main process** handles and routes messages from Renderer processes.
- 👉 **[@virid/amber](packages/amber/README.md)** – Learn how to implement **message replay** and **Undo/Redo** functionality.
- 👉 **[@virid/express](packages/express/README.md)** –Learn how to **control express** in virid.
- 👉 **[@virid/std](packages/std/README.md)** –Learn how to control asynchronous messages.

##  Other

  👉 **[Comprehensive Example](https://github.com/Ailrid/vireo)** – A complete electron application written using Virid.
