#  @virid/amber

`@virid/amber` 是 ` @virid/core` 的时光机器，负责自动化保存和记录被标记的`Component`，并提供全局与`Component`级别的undo/redo功能，支持`Component`级别的自定义与副作用触发以及多种钩子。

## 🌟 核心设计理念

在 `@virid/amber` 中，`Component`的undo与redo是**全自动、0入侵**的，业务逻辑代码中不会存在任何手动备份的逻辑。

- **Component级与全局Tick回退**：通过使用`@virid/amber`，不仅可以只回退某个局部状态而不回退整体，还能一次性回退整个Tick内的所有变化，灵活的控制局部与整体的变化。
- **0业务入侵**：`@virid/amber`的自动备份功能将会在每个tick自动执行，开发者只须告诉`@virid/amber`如何对比、备份、还原此数据，`@virid/amber`即可自动进行数据管理并备份和恢复数据。
- **副作用钩子**：`@virid/amber`提供了大量的副作用钩子来让开发者自己决定如何处理 undo/redo过程中产生的副作用。

## 🔌启用插件

```ts
import { createVirid } from '@virid/core'
import { AmberPlugin, Backup, Amber } from "@virid/amber";
const app = createVirid()
app.use(AmberPlugin, {});
```

## 🛠️ @virid/amber 核心 API 概览

### 1. Vue适配装饰器

#### `@Backup(shallow?: boolean)`

- **功能**：标记在一个Component上，告诉amber，此Component是需要被备份的。
- **逻辑**：在每个Tick结束后，amber将会自动找出那些Component发生了变化，并保存一份备份
- **示例：**

```ts

@Component()
@Backup({
  // onRestore钩子可以用于处理副作用
  onRestore: (old, now, dir) => {
    console.log(
      `[Hook] 组件恢复方向: ${dir}, 数据从 ${old.count} -> ${now.count}`,
    );
  },
  // 这两个钩子可以在备份前后执行一些逻辑
  onAfterBackup(newData: { count: number }) {
    console.log(`[Hook] 组件已备份: count=${newData.count}`);
  },
  onBeforeBackup(oldData: { count: number }) {
    console.log(`[Hook] 组件已备份: count=${oldData.count}`);
  },
  // 这三个方法可以让amber使用开发者自定义的对比、储存、恢复方法
  // 用于支持各种类型的自定义数据与避免不必要的全量备份
  diff(oldData: number, component: PlayerComponent) {
    return oldData !== component.count;
  },
  serialize(player: PlayerComponent) {
    return {
      count: player.count,
    };
  },
  deserialize(
    component: PlayerComponent,
    newData: {
      count: number;
    },
  ) {
    component.count = newData.count;
  },
})
class PlayerComponent {
  public count = 0;
}

```

#### `Amber`

- **功能**：通过一个全局的Amber类，即可控制每个组件的版本，实现特定组件、全局的Tick的 undo/redo功能
- **示例：**

```ts
// 组件撤销重做
Amber.undo(PlayerComponent); 
Amber.redo(PlayerComponent); 
// Tick级撤销重做
Amber.undoTick();
Amber.reodoTick();
// 清空所有版本记录
Amber.resetAll();

```

## ⚠️一些重要注意事项

为了处理全局和局部的状态版本不一致问题，Amber采取了一种“全局的undo/redo是局部的更新，局部的undo/redo是全局的更新”的哲学。这意味着当你在undo/redo某个Component时，全局的Tick将会增加。而当你在undo/redo当前的Tick时，所有的组件都将产生新的版本。因此，Amber可以实现“全局的回退可以回退局部的回退”，但是这往往容易产生混乱，因此大多数情况下只建议使用一种功能。

Amber采取了常见的“线性时间”模型，当在过去时如果产生了新的历史，那么从过去到新的历史之间的“已经发生的未来”将会被裁剪。