#  @virid/renderer

`@virid/renderer` 是electron应用的渲染进程适配器，提供`ToMainMessage`和`FromMainMessage`的自动路由功能与主进程报道功能。

## 🌟 核心设计理念

在 `@virid/renderer` 中，渲染进程朝主进程发送消息被抽象为`ToMainMessage`，该消息可以直接通过调度器分发，消息将会通过IPC直接传送到主进程或其他渲染进程并触发对应的`System`。主进程朝渲染进程发送的消息被抽象为`FromMainMessage`，一旦主进程发送了对应的消息，`FromMainMessage`将会自动被投递到调度器触发相应的渲染进程`System`。

- **路由自动注册**：渲染进程窗口开启后，自动向主进程注册自身，以后所有的消息都将携带自身的窗口信息。
- **类型恢复**：消息在通过IPC通道后，恢复成真正的Message类重新进入`@virid/core`并被调度器识别并分发。实现不同进程的位置无关性。
- **消息定向与广播**：可以通过其他渲染进程的ID来实现定向通信，或者使用*来广播消息。

## 🔌启用插件

```ts
import { createVirid } from '@virid/core'
import { RenderPlugin } from '@virid/renderer'
const app = createVirid()
//需要给每个窗口指定一个唯一的windowId来向主进程报道
app.use(RenderPlugin, {
  windowId: 'renderer'
})
```

## 🛠️ @virid/renderer 核心 API 概览

### `ToMainMessage`

- **功能**：一个特殊的消息基类，可被继承。所有继承自`ToMainMessage`的Message将被发往其他进程
- **逻辑**：该消息类型需要两个特殊标记，`__virid_target`标记了目的地，`__virid_messageType`标记了在目的地应该被还原为的Message类型
- **示例**：

```ts
//在渲染进程
import { ToMainMessage } from '@virid/renderer'
// __virid_target=‘main’,说明消息需要发往主进程
// 当指定__virid_target=‘*’时，消息将会对所有渲染进程广播
// __virid_messageType: string = 'close-window'，描述了在主进程，该消息将会重新变为的类型

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

在主进程，可以通过`@FromRender`结合`FromRenderMessage`来实现对应的转换。详情见`@virid/main` 。

```ts
//在主进程
import { FromRenderMessage, FromRenderer, ToRenderMessage } from '@virid/main'
//这里的每个id都和渲染进程的消息对应
@FromRenderer('close-window')
export class CloseWindowMessage extends FromRendererMessage {}
@FromRenderer('minimize-window')
export class MinimizeWindowMessage extends FromRendererMessage {}
@FromRenderer('maximize-window')
export class MaximizeWindowMessage extends FromRendererMessage {}

// 通过这三个System，可以实现所有窗口的最小化、最大化、关闭功能
// senderWindow为发送消息的窗口本身
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

### `FromMainMessage/@FromIpc()`

- **功能**：一个特殊的消息基类，可被继承。所有继承自`FromMainMessage`的Message将在主进程发送消息时自动转换并投递到当前进程的`virid`调度中心
- **逻辑**：`@FromIpc()`接受一个字符串类型的ID，该ID与主进程中发送的`ToRendererMessage`的ID应该相同。
- **示例**：

```ts
//在渲染进程
import { FromIpc, FromMainMessage, ToMainMessage } from '@virid/renderer'

@FromIpc('file-dialog')
class ChooseBgImageMessage extends FromMainMessage {
  constructor(public path: string) {
    super()
  }
}

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

在主进程，可以通过`@FromRender`结合`FromRenderMessage`来实现对应的转换。详情见`@virid/main` 。

```ts
//在主进程
import { FromRendererMessage, FromRenderer, ToRenderMessage } from '@virid/main'

// @FromRender('open-dialog')表明，当上面的渲染进程调用OpenDialogMessage.send(options)时
// 主进程的OpenDialogMessage将被自动投递，因此下面的openDialog System将被virid自动调用
// 当openDialog执行完毕，将返回一个RenderDialogMessage，该RenderDialogMessage标记了目的地与类型
// 其会转换为渲染进程的OpenDialogMessage并触发渲染进程的System或者Listener执行

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



