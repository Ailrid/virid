import { type ViridApp } from "./app";
import {
  AtomicModifyMessage,
  ErrorMessage,
  InfoMessage,
  MessageWriter,
  SystemContext,
  WarnMessage,
} from "./core";

/**
 * 简单的色彩辅助函数
 */
const clr = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
};

/**
 * 为全局处理器包装上下文
 */
function withContext(
  params: any,
  fn: (...args: any[]) => any,
  methodName: string,
) {
  const context: SystemContext = {
    params: params, // 参数类型
    targetClass: Object, // 指向全局 Object 或特定标记类
    methodName: methodName,
    originalMethod: fn,
  };
  (fn as any).ccsContext = context;
  return fn;
}
/**
 * 注册全局默认信息处理系统
 */
const globalInfoHandler = (err: InfoMessage) => {
  const header = `${clr.green}${clr.bold} ✔ [Virid Info] ${clr.reset}`;
  const context = `${clr.magenta}${err.context}${clr.reset}`;

  console.log(
    `${header}${clr.gray}Global Info Caught:${clr.reset}\n` +
      `  ${clr.green}Details:${clr.reset}`,
    err.context || "unknown Info",
  );
};

/**
 * 注册全局默认错误处理系统
 */
const globalErrorHandler = (err: ErrorMessage) => {
  const header = `${clr.red}${clr.bold} ✖ [Virid Error] ${clr.reset}`;
  const context = `${clr.magenta}${err.context}${clr.reset}`;

  console.error(
    `${header}${clr.gray}Global Error Caught:${clr.reset}\n` +
      `  ${clr.red}Context:${clr.reset} ${context}\n` +
      `  ${clr.red}Details:${clr.reset}`,
    err.error || err || "unknown Error",
  );
};

/**
 * 注册全局默认警告处理系统
 */
const globalWarnHandler = (warn: WarnMessage) => {
  const header = `${clr.yellow}${clr.bold} ⚠ [Virid Warn] ${clr.reset}`;
  const context = `${clr.cyan}${warn.context}${clr.reset}`;

  console.warn(
    `${header}${clr.gray}Global Warn Caught:${clr.reset}\n` +
      `  ${clr.yellow}Context:${clr.reset} ${context}`,
  );
};

/**
 * 注册修改处理器
 */
const atomicModifyHandler = (modifications: AtomicModifyMessage<any>) => {
  const rawComponent = activeApp.get(modifications.ComponentClass);

  if (!rawComponent) {
    console.error(
      `[Virid Modify] Component Not Found:\n Component ${modifications.ComponentClass.name} not found in Registry.`,
    );
    return;
  }
  // 执行修改逻辑
  try {
    modifications.recipe(rawComponent);
    // 记录显式的审计日志
    MessageWriter.warn(
      `[Virid Modify] Successfully:\nModify on ${modifications.ComponentClass.name}\nlabel: ${modifications.label}`,
    );
  } catch (e) {
    MessageWriter.error(
      e as Error,
      `[Virid Error] Modify Failed:\n${modifications.label}`,
    );
  }
};

export interface IViridApp {
  get(identifier: any): any;
}

let activeApp: IViridApp | null = null;

/**
 * 激活真正的 App 实例
 */
export function initializeGlobalSystems(app: ViridApp) {
  // 确保全局处理器优先级最高
  app.register(
    AtomicModifyMessage,
    withContext(
      AtomicModifyMessage<any>,
      atomicModifyHandler,
      "GlobalAtomicModifier",
    ),
    1000, // 修改器优先级通常极高，确保状态第一时间更新
  );
  app.register(
    WarnMessage,
    withContext(WarnMessage, globalWarnHandler, "GlobalWarnHandler"),
    -999,
  );
  app.register(
    ErrorMessage,
    withContext(ErrorMessage, globalErrorHandler, "GlobalErrorHandler"),
    -999,
  );
  app.register(
    InfoMessage,
    withContext(InfoMessage, globalInfoHandler, "GlobalInfoHandler"),
    -999,
  );
  activeApp = app;
}

/**
 * viridApp 代理
 */
export const viridApp: IViridApp = new Proxy({} as IViridApp, {
  get(_, prop: keyof IViridApp) {
    return (...args: any[]) => {
      // 检查实例是否存在
      if (!activeApp) {
        console.warn(
          `[Virid Vue] App method "${String(prop)}" called before initialization.`,
        );

        return;
      }

      // 正常转发调用
      // 使用 Reflect 确保 this 指向正确，或者直接从 activeApp 调用
      const targetMethod = activeApp[prop];
      if (typeof targetMethod === "function") {
        // @ts-ignore
        return targetMethod.apply(activeApp, args);
      }
    };
  },
});
