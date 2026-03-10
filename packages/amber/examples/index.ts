import "reflect-metadata";
import {
  createVirid,
  Component,
  System,
  Message,
  SingleMessage,
} from "@virid/core";
import { AmberPlugin, Backup, Amber, amberTickStore } from "@virid/amber"; // 假设在项目根目录运行

class ChangeMessage extends SingleMessage {
  constructor(public value: number) {
    super();
  }
}

@Component()
@Backup({
  onRestore: (old, now, dir) => {
    console.log(
      `[Hook] 组件恢复方向: ${dir}, 数据从 ${old.count} -> ${now.count}`,
    );
  },
  onAfterBackup(newData: { count: number }) {
    console.log(`[Hook] 组件已备份: count=${newData.count}`);
  },
  onBeforeBackup(oldData: { count: number }) {
    console.log(`[Hook] 组件已备份: count=${oldData.count}`);
  },
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

class PlayerSystem {
  @System()
  static onChange(
    @Message(ChangeMessage) msg: ChangeMessage,
    player: PlayerComponent,
  ) {
    player.count += msg.value;
  }
}

// 初始化 App 并安装插件
const app = createVirid();
app.use(AmberPlugin, {});

app.bindComponent(PlayerComponent);

// 获取实例用于断言
const player = app.get(PlayerComponent);

// --- 2. 开始测试流 ---

async function runTest() {
  console.log(">>> 测试开始：初始化检查");
  // V0: 初始状态应为 0
  console.assert(player.count === 0, "初始数据应为0");
  console.assert(Amber.getVersion(PlayerComponent) === 0, "初始版本应为0");

  // --- 第一阶段：产生历史 ---
  console.log("\n>>> 第一阶段：模拟两次数据变更");
  ChangeMessage.send(10); // 产生 Tick 1, Version 1

  await nextTick();
  console.log(
    `Tick 1 完成: count=${player.count}, version=${Amber.getVersion(PlayerComponent)}`,
  );

  ChangeMessage.send(20); // 产生 Tick 2, Version 2
  await nextTick();
  console.log(
    `Tick 2 完成: count=${player.count}, version=${Amber.getVersion(PlayerComponent)}`,
  );

  // --- 第二阶段：局部撤销 (Undo) ---
  console.log("\n>>> 第二阶段：执行局部撤销");
  Amber.undo(PlayerComponent); // 应该回到 count=10, 但产生 Tick 3
  console.assert(player.count === 10, "局部撤销后 count 应为 10");
  console.log(
    `局部撤销完成: count=${player.count}, version=${Amber.getVersion(PlayerComponent)}`,
  );

  // --- 第三阶段：全局撤销 (UndoTick) ---
  console.log("\n>>> 第三阶段：全局撤销");
  // 目前处于 Tick 4 (因为刚才的 undo 产生了一个新 Tick)
  // 我们连退两步，看看能不能回到最初
  Amber.undoTick();
  Amber.undoTick();
  console.log(
    `全局连退两步完成: count=${player.count}, Tick指针=${amberTickStore.currentTick}`,
  );

  // --- 第四阶段：未来坍塌测试 ---
  console.log("\n>>> 第四阶段：修改历史引发平行宇宙坍塌");
  // 现在我们在过去修改数据，原本的“未来”应该被删掉
  ChangeMessage.send(999);
  await nextTick();
  const canRedo = Amber.canRedoTick();
  console.log(`修改后是否有重做可能: ${canRedo} (预期应为 false)`);

  // ... 前面部分保持一致 ...

  // --- 第五阶段：局部重置与全局归零 ---
  console.log("\n>>> 第五阶段：局部重置与全局归零");

  // 确保此时 player.count 确实是 999
  console.log(`重置前数值: ${player.count}`);

  Amber.resetComponent(PlayerComponent);

  console.log(`重置后数值: ${player.count}`);
  console.log(`重置后版本: ${Amber.getVersion(PlayerComponent)}`);

  // 关键断言检查
  if (player.count !== 1009) {
    console.error(`[ERROR] 数据丢失！预期 1009，实际为 ${player.count}`);
  } else {
    console.log("[SUCCESS] 局部重置成功保持了当前状态。");
  }

  Amber.resetAll();

  // 全局重置后的检查
  await nextTick();
  console.log(`全局重置后 Tick 指针: ${amberTickStore.currentTick}`);
  console.log(`全局重置后版本: ${Amber.getVersion(PlayerComponent)}`);
}

/**
 * 辅助函数：等待 Virid Tick 完成
 */
function nextTick() {
  return new Promise((resolve) => queueMicrotask(resolve));
}

runTest().catch(console.error);
