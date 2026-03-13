# @virid/bridge

`@virid/brideg` 负责为electron应用提供主进程与渲染进程之间的通讯桥接。

使用方法：仅需在preload.js中写一行代码即可

```ts
import { injectViridBridge } from '@virid/bridge'
injectViridBridge()

```

