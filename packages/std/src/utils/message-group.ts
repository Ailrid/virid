import {
  EventMessage,
  type ViridApp,
  type ExecuteHookContext,
  MessageWriter,
} from "@virid/core";
interface ExecuteContext {
  message: EventMessage;
  resolve: () => void;
}
// 每个key中缓存的执行组队列
const executeGroupMap = new Map<string, ExecuteContext[]>();
const messageKeyMap = new Map<EventMessage, string>();
const keyMessageMap = new Map<string, EventMessage[]>();
const callBackMap = new Map<string, (success: boolean) => void>();

function clearGroup(id: string) {
  for (const message of keyMessageMap.get(id)!) {
    messageKeyMap.delete(message);
  }
  keyMessageMap.delete(id);
  executeGroupMap.delete(id);
  callBackMap.delete(id);
}

function afterExecuteHook(
  message: EventMessage,
  _hookContext: ExecuteHookContext,
  success: boolean,
) {
  const key = messageKeyMap.get(message);
  if (key) {
    const executeGroup = executeGroupMap.get(key)!;
    if (success) {
      // 只有当前任务执行成功，才继续下一个
      if (executeGroup.length > 0) {
        const { resolve } = executeGroup.shift()!;
        resolve();
        if (executeGroup.length == 0) {
          callBackMap.get(key)!(true);
          clearGroup(key);
        }
      }
    } else {
      callBackMap.get(key)!(false);
      clearGroup(key);
      // 如果出错了，直接取消执行队列
      MessageWriter.error(
        new Error(
          `[ExecuteGroup] Queue Execution Failed: Due to an error in the System execution triggered by ${message.constructor.name}, the message group '${key}' has been cancelled`,
        ),
      );
    }
  }
}
export async function executeGroup(
  messages: EventMessage[],
  id: string = "default",
): Promise<boolean> {
  // 构造一串promise并且把resolve存起来,每个resolve会启动下一个promise
  if (executeGroupMap.has(id)) {
    MessageWriter.error(
      new Error(
        `[ExecuteGroup] Unavailable ID: The id '${id}' not yet executed`,
      ),
    );
    return Promise.resolve(false);
  }
  // 注册这一个执行组
  const executeChain: ExecuteContext[] = [];
  keyMessageMap.set(id, messages);
  messages.forEach((message, index) => {
    let resolve: () => void;
    if (index == messages.length - 1) {
      resolve = () => {};
    } else {
      resolve = () => MessageWriter.write(messages[index + 1]);
    }
    executeChain.push({
      message,
      resolve,
    });
    messageKeyMap.set(message, id);
  });
  let resolver: (success: boolean) => void;
  const promise = new Promise<boolean>((res) => {
    resolver = res;
  });
  callBackMap.set(id, resolver!);

  executeGroupMap.set(id, executeChain);

  // 立刻触发第一个
  MessageWriter.write(messages[0]);
  return promise;
}

export function activateGroupMessages(app: ViridApp) {
  app.onAfterExecute(EventMessage, afterExecuteHook);
}
