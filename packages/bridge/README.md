# @virid/bridge

`@virid/bridge` is responsible for providing a communication bridge between the main process and the rendering process for the Electron application.

Usage: Just write one line of code in preload. js

```ts
import { injectViridBridge } from '@virid/bridge'
injectViridBridge()
```

