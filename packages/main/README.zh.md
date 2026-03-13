#  @virid/main

`@virid/main` 是electron应用的主适配器，提供`ToRendererMessage`和`FromRendererMessage`的自动路由功能与接受渲染进程报道功能。

## 🌟 核心设计理念

在 `@virid/main` 中，主进程朝渲染进程发送消息被抽象为`ToRendererMessage`，该消息可以直接通过调度器分发，消息将会通过IPC直接传送到渲染进程并触发对应的`System`。渲染进程朝主进程发送的消息被抽象为`FromRendererMessage`，一旦渲染进程发送了对应的消息，`FromRendererMessage`将会自动被投递到调度器触发相应的主进程`System`。

- **路由自动注册**：渲染进程窗口开启后，自动向主进程注册自身，以后所有的消息都将携带自身的窗口信息。
- **类型恢复**：消息在通过IPC通道后，恢复成真正的Message类重新进入`@virid/core`并被调度器识别并分发。实现不同进程的位置无关性。
- **消息定向与广播**：可以通过其他渲染进程的ID来实现定向通信，或者使用“*”来广播消息。

## 🔌启用插件

```ts
import { createVirid } from '@virid/core'
import { MainPlugin } from '@virid/main'
import { app } from 'electron'
const virid = createVirid()
  .use(MainPlugin, { electronApp: app })
```

## 🛠️ @virid/main 核心 API 概览

### `ToRendererMessage`

- **功能**：一个特殊的消息基类，可被继承。所有继承自`ToRendererMessage`的Message将被发往渲染进程
- **逻辑**：该消息类型需要两个特殊标记，`__virid_target`标记了目的地，`__virid_messageType`标记了在目的地应该被还原为的Message类型
- **示例**：

```ts
//在主进程
import { ToRendererMessage } from '@virid/main'
// __virid_target=‘renderer’,说明消息需要发往windowId为renderer的渲染进程
//  __virid_messageType: string = 'file-dialog'，描述了在渲染进程，该消息将会重新变为的类型
export class RenderDialogMessage extends ToRendererMessage {
  __virid_target: string = 'renderer'
  __virid_messageType: string = 'file-dialog'
  constructor(public path: string) {
    super()
  }
}
```

在渲染进程，可以通过`@FromIpc`结合`FromMainMessage`来实现对应的转换。详情见`@virid/renderer` 。

```ts
//在渲染进程
import { FromIpc, FromMainMessage } from '@virid/main'
//@FromIpc('file-dialog')表明当主进程发送一个ToRenderMessage，而且
//  __virid_target: string = 'renderer'
//  __virid_messageType: string = 'file-dialog'
// 时，这个消息将被自动投递到virid调度中心触发相应的渲染进程System
@FromIpc('file-dialog')
class ChooseBgImageMessage extends FromMainMessage {
  constructor(public path: string) {
    super()
  }
}
```

### `FromRenderMessage/@FromRenderer()`

- **功能**：一个特殊的消息基类，可被继承。所有继承自`FromRenderMessage`的Message将在渲染进程发送消息时自动转换并投递到主进程的`virid`调度中心
- **逻辑**：`@FromRenderer()`接受一个字符串类型的ID，该ID与渲染进程中发送的`ToMainMessage`的ID应该相同。
- **示例**：

```ts
//在主进程
import { FromRenderer, FromRenderMessage } from '@virid/renderer'
// 发往渲染进程的消息
export class RenderDialogMessage extends ToRendererMessage {
  __virid_target: string = 'renderer'
  __virid_messageType: string = 'file-dialog'
  constructor(public path: string) {
    super()
  }
}
// 将来自渲染进程且 __virid_messageType: string = 'file-dialog'的消息转换成主进程的OpenDialogMessage
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
    // 调用原生对话框
    const result = await dialog.showOpenDialog(message.senderWindow, message.options)
    // 如果用户没有取消，并且确实选择了文件
    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0]
      return new RenderDialogMessage(selectedPath)
    }
    return
  }
}
```

在渲染进程，可以通过`@FromIpc`结合`ToMainMessage`来实现对应的转换和消息的发送。详情见`@virid/renderer` 。

```ts
// 在渲染进程
import { ToMainMessage，FromIpc } from '@virid/renderer'
// 打开文件选择框
@FromIpc('file-dialog')
class ChooseBgImageMessage extends FromMainMessage {
  constructor(public path: string) {
    super()
  }
}
//打开文件选择框
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



