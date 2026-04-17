# virid

`virid` 是一个用`TypeScript`语言编写的为重型electron应用而生的**确定性消息驱动引擎**。它将业务逻辑从 UI 框架的碎屑中彻底剥离，构建出一个具备**位置透明性**的微型分布式核心。

## 核心特点

`virid` 通过将业务逻辑与视图彻底解耦，解决了中大型前端项目与electron项目中的“状态漂移”与“逻辑面条化”问题。其核心运作机制如下：

- **环境无关的逻辑内核**：业务逻辑完全运行在 `@virid/core` 中，不依赖 DOM/BOM API。这使得同一套核心逻辑可以无缝运行在 Electron 主进程、渲染进程或 Node.js 环境中，即使切换前端框架也能实现代码的高度复用。
- **单向数据投影**：UI 层通过 `@virid/vue` 接入。它仅作为逻辑层数据的**只读视图**。系统从底层屏蔽了视图层对状态的直接修改，确保数据变更的源头唯一。
- **指令驱动的异步调度**：系统所有的状态变更必须通过 `Message` 触发。`Dispatcher` 采用类似游戏引擎的 `Tick` 机制处理消息，由 `System` 完成具体的业务运算，确保逻辑执行顺序的可预测性。
- **进程IPC通讯屏蔽**：Virid提供了完整的渲染进程与主进程之间的消息机制，彻底屏蔽了底层的IPC通讯，使用Virid在electron中通讯如同在本地通讯完全相同。
- **强异步控制**：提供原生级别的防抖、节流、事务、异步时序控制。无需再引入任何外部库与依赖。
- **最小化0依赖**：除reflect-metadata之外没有任何第三方依赖。

##  模块组成

| **模块**              | **定位**                 | **关键特性**                                                 |
| --------------------- | ------------------------ | ------------------------------------------------------------ |
| **`@virid/core`**     | **核心**                 | **确定性 Tick 机制、双缓冲消息池、依赖注入。**               |
| **`@virid/vue`**      | **UI投影层**             | **响应式投影、依赖系留、生命周期桥接。**                     |
| **`@virid/bridge`**   | **electron消息转发层**   | **-**                                                        |
| **`@virid/renderer`** | **electron渲染进程桥接** | **渲染进程消息发送、主进程消息反序列化**                     |
| **`@virid/main`**     | **electron主进程桥接**   | **消息路由、渲染进程转发**                                   |
| **`@virid/amber`**    | **因果状态管理**         | **消息重放、状态回溯、undo/redo**                            |
| **@virid/express**    | **http请求消息化**       | **将express请求转换为消息在system中处理，并提供Nestjs一样的依赖注入功能** |
| **@virid/std**        | **核心功能增强**         | **提供异步消息时序控制、节流防抖等等**                       |

---

##  深入了解

具体的实现细节与快速上手示例，请阅读各子包文档：

- 👉 **[@virid/core](packages/core/README.md)** - 了解 CCS 架构、消息调度与状态管理。
- 👉 **[@virid/vue](packages/vue/README.md)** - 了解如何将逻辑投影到 Vue 视图层。
- 👉 **[@virid/bridge](packages/bridge/README.md)** - 了解如何初始化electron渲染脚本
- 👉 **[@virid/renderer](packages/renderer/README.md)** - 了解如何从渲染进程直接向主进程发消息
- 👉 **[@virid/main](packages/main/README.md)** - 了解主进程如何处理渲染进程消息
- 👉 **[@virid/amber](packages/amber/README.md)** - 了解如何使用消息重放、undo/redo功能
- 👉 **[@virid/express](packages/express/README.md)** - 了解如何将express介入消息系统
- 👉 **[@virid/std](packages/std/README.md)** - 了解如何对异步消息进行控制

## 其他

👉 **[Comprehensive Example](https://github.com/Ailrid/vireo)** – 一个使用virid编写的，完整的electron应用。
