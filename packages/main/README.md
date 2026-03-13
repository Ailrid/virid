# @virid/main

**@virid/main** is the main process adapter for Electron applications. It provides automatic routing for `ToRendererMessage` and `FromRendererMessage`, along with the capability to receive and manage reporting from rendering processes.

## 🌟 Core Design Philosophy

In **@virid/main**, messages sent from the main process to a rendering process are abstracted as `ToRendererMessage`. These messages can be distributed directly via the dispatcher, traveling through IPC to the target rendering process to trigger the corresponding **System**.

Conversely, messages sent from a rendering process to the main process are abstracted as `FromRendererMessage`. Once a rendering process sends a message, the `FromRendererMessage` is automatically delivered to the dispatcher to trigger the relevant main process **System**.

- **Automatic Route Registration**: When a rendering process window opens, it automatically registers itself with the main process. All subsequent messages will carry the window's specific metadata (context).
- **Type Restoration**: After passing through the IPC channel, messages are restored into their original **Message** classes before re-entering `@virid/core`. This allows them to be recognized and distributed by the dispatcher, achieving **location transparency** across different processes.
- **Targeted Messaging & Broadcasting**: You can achieve point-to-point communication by using the specific IDs of rendering processes, or use `*` to broadcast messages to all windows.

## 🔌Enable plugins

```ts
import { createVirid } from '@virid/core'
import { MainPlugin } from '@virid/main'
import { app } from 'electron'
const virid = createVirid()
  .use(MainPlugin, { electronApp: app })
```

## 🛠️ @virid/main Core API Overview

### ToRendererMessage

- **Function**: A specialized message base class designed for inheritance. All messages inheriting from `ToRendererMessage` will be dispatched to the rendering process.
- **Logic**: This message type requires two specific metadata tags:
  - `__virid_target`: Specifies the destination (e.g., a specific `windowId`).
  - `__virid_messageType`: Defines the message type it should be restored to upon reaching the rendering process.

- Example:

**In the Main Process:**

```ts
import { ToRendererMessage } from '@virid/main'

/**
 * - __virid_target = 'renderer': Indicates the message is bound for the rendering process 
 * with the windowId 'renderer'.
 * - __virid_messageType = 'file-dialog': Describes the type this message will transform 
 * into once it arrives in the rendering process.
 */
export class RenderDialogMessage extends ToRendererMessage {
  __virid_target: string = 'renderer'
  __virid_messageType: string = 'file-dialog'
  
  constructor(public path: string) {
    super()
  }
}
```

In the **Rendering Process**, you can use the `@FromIpc` decorator in conjunction with `FromMainMessage` to handle the conversion. For more details, refer to `@virid/renderer`.

**In the Rendering Process:**

```ts
import { FromIpc, FromMainMessage } from '@virid/renderer'

/**
 * @FromIpc('file-dialog') indicates that when the Main Process sends a ToRendererMessage 
 * where __virid_messageType is 'file-dialog', this message will be automatically 
 * delivered to the Virid dispatcher to trigger the corresponding rendering process System.
 */
@FromIpc('file-dialog')
class ChooseBgImageMessage extends FromMainMessage {
  constructor(public path: string) {
    super()
  }
}
```

### FromRenderMessage / @FromRenderer()

- **Function**: A specialized message base class designed for inheritance. All messages inheriting from `FromRenderMessage` will be automatically converted and dispatched to the **Virid Dispatcher** in the Main Process when sent from a Rendering Process.
- **Logic**: The `@FromRenderer()` decorator accepts a string-based ID. This ID must match the `__virid_messageType` of the `ToMainMessage` dispatched from the Rendering Process.

#### Example:

**In the Main Process:**

```ts
import { FromRenderer, FromRenderMessage, ToRendererMessage } from '@virid/main'

// Message to be sent to the Rendering Process
export class RenderDialogMessage extends ToRendererMessage {
  __virid_target: string = 'renderer'
  __virid_messageType: string = 'file-dialog'
  constructor(public path: string) {
    super()
  }
}

/**
 * Converts incoming messages from the Rendering Process with 
 * __virid_messageType: 'open-dialog' into the Main Process's OpenDialogMessage.
 */
@FromRenderer('open-dialog')
export class OpenDialogMessage extends FromRenderMessage {
  constructor(
    public options: {
      title?: string
      filters?: Array<{ name: string; extensions: string[] }>
      properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles'>
    }
  ) {
    super()
  }
}

export class WindowSystem {
  @System()
  async openDialog(@Message(OpenDialogMessage) message: OpenDialogMessage) {
    // Invoke native Electron dialog
    const result = await dialog.showOpenDialog(message.senderWindow, message.options)
    
    // If the user did not cancel and selected a file
    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0]
      return new RenderDialogMessage(selectedPath)
    }
    return
  }
}
```

In the **Rendering Process**, you can use `@FromIpc` in conjunction with `ToMainMessage` to handle message conversion and dispatching. For more details, refer to `@virid/renderer`.

**In the Rendering Process:**

```ts
import { ToMainMessage, FromIpc, FromMainMessage } from '@virid/renderer'

// Handles the incoming file selection result
@FromIpc('file-dialog')
class ChooseBgImageMessage extends FromMainMessage {
  constructor(public path: string) {
    super()
  }
}

// Initiates the request to open a dialog
class OpenDialogMessage extends ToMainMessage {
  __virid_target: string = 'main'
  __virid_messageType: string = 'open-dialog'
  constructor(
    public options: {
      title?: string
      filters?: Array<{ name: string; extensions: string[] }>
      properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles'>
    }
  ) {
    super()
  }
}
```