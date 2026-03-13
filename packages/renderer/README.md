# @virid/renderer

**@virid/renderer** is a rendering process adapter for Electron applications. It provides automatic routing for `ToMainMessage` and `FromMainMessage`, along with main process reporting capabilities.

## 🌟 Core Design Philosophy

In **@virid/renderer**, messages sent from the rendering process to the main process are abstracted as `ToMainMessage`. These messages can be distributed directly via the dispatcher, traveling through IPC to the main process or other rendering processes to trigger the corresponding **System**.

Conversely, messages sent from the main process to the rendering process are abstracted as `FromMainMessage`. Once the main process sends a message, it is automatically delivered to the dispatcher to trigger the relevant rendering process **System**.

- **Automatic Route Registration**: When a rendering process window opens, it automatically registers itself with the main process. All subsequent messages will carry the window's specific metadata.
- **Type Restoration**: After passing through the IPC channel, messages are restored into their original **Message** classes before re-entering `@virid/core`. This allows them to be recognized and distributed by the dispatcher, achieving **location transparency** across different processes.
- **Targeted Messaging & Broadcasting**: You can achieve point-to-point communication using the IDs of other rendering processes, or use `*` to broadcast messages.

------

## 🔌Enable plugins

```ts
import { createVirid } from '@virid/core'
import { RenderPlugin } from '@virid/renderer'
const app = createVirid()
//Each window needs to be assigned a unique windowId to report to the main process
app.use(RenderPlugin, {
  windowId: 'renderer'
})
```

## 🛠️ @virid/renderer Core API Overview

### ToMainMessage

- **Function**: A specialized message base class designed for inheritance. All messages inheriting from `ToMainMessage` will be dispatched to other processes.
- **Logic**: This message type requires two specific metadata tags:
  - `__virid_target`: Defines the destination.
  - `__virid_messageType`: Defines the message type it should be restored to upon reaching the destination.
- Example

**In the Rendering Process:**

```ts
import { ToMainMessage } from '@virid/renderer'

/**
 * - __virid_target = 'main': Indicates the message is bound for the Main Process.
 * - If __virid_target = '*': The message will be broadcast to all rendering processes.
 * - __virid_messageType: Describes the class type the message will transform back into 
 * once it arrives at the Main Process.
 */

export class CloseWindowMessage extends ToMainMessage {
  __virid_target = 'main'
  __virid_messageType: string = 'close-window'
}

export class MinimizeWindowMessage extends ToMainMessage {
  __virid_target = 'main'
  __virid_messageType: string = 'minimize-window'
}

export class MaximizeWindowMessage extends ToMainMessage {
  __virid_target = 'main'
  __virid_messageType: string = 'maximize-window'
}
```

In the **Main Process**, you can use the `@FromRenderer` decorator in conjunction with `FromRendererMessage` to handle the conversion. For more details, refer to `@virid/main`.

**In the Main Process:**

```ts
import { FromRendererMessage, FromRenderer } from '@virid/main'

// Each ID here maps to the __virid_messageType defined in the rendering process
@FromRenderer('close-window')
export class CloseWindowMessage extends FromRendererMessage {}

@FromRenderer('minimize-window')
export class MinimizeWindowMessage extends FromRendererMessage {}

@FromRenderer('maximize-window')
export class MaximizeWindowMessage extends FromRendererMessage {}

/**
 * WindowSystem: Implements Minimize, Maximize, and Close functionality for all windows.
 * senderWindow: Refers to the specific window instance that dispatched the message.
 */
export class WindowSystem {
  @System()
  closeWindow(@Message(CloseWindowMessage) message: CloseWindowMessage) {
    message.senderWindow.close()
  }

  @System()
  minimizeWindow(@Message(MinimizeWindowMessage) message: MinimizeWindowMessage) {
    message.senderWindow.minimize()
  }

  @System()
  maximizeWindow(@Message(MaximizeWindowMessage) message: MaximizeWindowMessage) {
    if (message.senderWindow.isMaximized()) {
      message.senderWindow.unmaximize()
    } else {
      message.senderWindow.maximize()
    }
  }
}
```

### FromMainMessage / @FromIpc()

- **Function**: A specialized message base class for inheritance. Any message inheriting from `FromMainMessage` is automatically converted and dispatched to the current process's **Virid Dispatcher** when sent from the Main Process.
- **Logic**: The `@FromIpc()` decorator accepts a string-based ID. This ID must match the `__virid_messageType` of the `ToRendererMessage` sent from the Main Process.

- Example:

**In the Rendering Process:**

```ts
import { FromIpc, FromMainMessage, ToMainMessage } from '@virid/renderer'

// This class handles the incoming file path from the Main Process
@FromIpc('file-dialog')
class ChooseBgImageMessage extends FromMainMessage {
  constructor(public path: string) {
    super()
  }
}

// This class initiates the request to the Main Process
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

In the **Main Process**, you use `@FromRenderer` and `FromRendererMessage` to handle the incoming request. For more details, refer to `@virid/main`.

**In the Main Process:**

```ts
import { FromRendererMessage, FromRenderer, ToRendererMessage } from '@virid/main'

/**
 * @FromRenderer('open-dialog') ensures that when the Rendering Process 
 * dispatches an OpenDialogMessage, the Main Process's corresponding 
 * System will be triggered automatically.
 */
@FromRenderer('open-dialog')
export class OpenDialogMessage extends FromRendererMessage {
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

/**
 * RenderDialogMessage is used to send the result back.
 * - __virid_target = 'renderer' routes it back to the UI.
 * - __virid_messageType = 'file-dialog' maps it to ChooseBgImageMessage in the renderer.
 */
export class RenderDialogMessage extends ToRendererMessage {
  __virid_target: string = 'renderer'
  __virid_messageType: string = 'file-dialog'
  constructor(public path: string) {
    super()
  }
}

export class WindowSystem {
  @System()
  async openDialog(@Message(OpenDialogMessage) message: OpenDialogMessage) {
    // Invoke the native Electron dialog
    const result = await dialog.showOpenDialog(message.senderWindow, message.options)

    // If the user didn't cancel and selected a file, return the result message
    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0]
      return new RenderDialogMessage(selectedPath)
    }
    return
  }
}
```