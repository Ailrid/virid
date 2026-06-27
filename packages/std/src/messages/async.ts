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

// The correspondence between messages and keys
const asyncMessageMap = new Map<Newable<EventMessage>, string>();
// The message sequence cached in each key
const asyncMessageQueue = new Map<string, QueueContext[]>();

/**
 * Register asynchronous queue messages
 */
export function AsyncQueue(key: string = "default") {
  return function (target: Newable<EventMessage>) {
    asyncMessageMap.set(target, key);
  };
}

/**
 * Intercept all asynchronous messages
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
  // Is the current message to be sorted
  const key = asyncMessageMap.get(message.constructor as Newable<EventMessage>);
  if (key) {
    // If this message is exactly the message recorded at the head of the queue
    // So immediately send this one, and then deliver another follow-up message
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
