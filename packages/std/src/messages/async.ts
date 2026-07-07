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
interface AsyncMessageKey {
  key: string;
  maxSize: number;
}

// The correspondence between messages and keys
const asyncMessageMap = new Map<Newable<EventMessage>, AsyncMessageKey>();
// The message sequence cached in each key
const asyncMessageQueue = new Map<string, QueueContext[]>();

/**
 * Register asynchronous queue messages
 */
export function AsyncQueue(key: string = "default", maxSize: number = 1) {
  return function (target: Newable<EventMessage>) {
    asyncMessageMap.set(target, { key, maxSize });
  };
}

/**
 * Intercept all asynchronous messages
 */
function middleWare(message: BaseMessage, next: () => void): void {
  const item = asyncMessageMap.get(
    message.constructor as Newable<EventMessage>,
  );
  if (item && message instanceof EventMessage) {
    const currentQueue = asyncMessageQueue.get(item.key) || [];
    // check the maximum length
    if (currentQueue.length >= item.maxSize) return;
    currentQueue.push({ message, next });
    asyncMessageQueue.set(item.key, currentQueue);

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
  const item = asyncMessageMap.get(
    message.constructor as Newable<EventMessage>,
  );
  if (item) {
    // If this message is exactly the message recorded at the head of the queue
    // So immediately send this one, and then deliver another follow-up message
    const currentQueue = asyncMessageQueue.get(item.key)!;
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
