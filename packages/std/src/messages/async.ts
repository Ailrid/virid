import {
  EventMessage,
  type ViridApp,
  type ExecuteHookContext,
  type Newable,
  BaseMessage,
} from "@virid/core";
interface QueueContext {
  message: EventMessage;
  next: () => void;
}

// 消息和key的对应关系
const asyncMessageMap = new Map<Newable<EventMessage>, string>();
// 每个key中缓存的消息序列
const asyncMessageQueue = new Map<string, QueueContext[]>();

/**
 * * 注册异步队列消息
 */
export function AsyncMessage(key: string = "default") {
  return function (target: Newable<EventMessage>) {
    asyncMessageMap.set(target, key);
  };
}

/**
 * * 拦截所有异步消息
 */
function middleWare(message: BaseMessage, next: () => void): void {
  const key = asyncMessageMap.get(message.constructor as Newable<EventMessage>);
  if (key && message instanceof EventMessage) {
    const currentQueue = asyncMessageQueue.get(key) || [];
    currentQueue.push({ message, next });
    asyncMessageQueue.set(key, currentQueue);
    // 如果没有暂存队列，立刻放行
    if (currentQueue.length == 1) next();
  } else {
    next();
  }
}

function afterExecuteHook(
  message: EventMessage,
  _hookContext: ExecuteHookContext,
) {
  // 当前消息是否是需要排序的
  const key = asyncMessageMap.get(message.constructor as Newable<EventMessage>);
  if (key) {
    // 如果此消息正是队列头部记录的message
    // 那么立刻这一个，然后投递另一个后继消息
    const currentQueue = asyncMessageQueue.get(key)!;
    if (currentQueue.at(0)?.message === message) {
      currentQueue.shift();
      currentQueue.at(0)?.next();
    }
  }
}

export function activateAsyncQueue(app: ViridApp) {
  app.useMiddleware(middleWare);
  app.onAfterExecute(EventMessage, afterExecuteHook);
}
