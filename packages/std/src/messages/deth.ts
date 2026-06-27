import { type ViridApp, type Newable, BaseMessage } from "@virid/core";

interface DebounceContext<T> {
  time: number;
  merge: (currentMessage: T, nextMessage: T) => void;
}

interface DebounceTask {
  message: BaseMessage;
  timer: any;
}

const debounceMap = new Map<Newable<BaseMessage>, DebounceContext<any>>();
// Store the current anti shake task corresponding to each message class (including merged message content and timer)
const prevDebounceTask = new Map<Newable<BaseMessage>, DebounceTask>();

const throttleMap = new Map<Newable<BaseMessage>, number>();
// Store the timestamp of the last actual execution of each message class
const prevThTime = new Map<Newable<BaseMessage>, number>();

/**
 * Anti shake decorator: Messages triggered continuously will be merged until they stop triggering for a period of time before execution
 */
export function Debounce<T extends BaseMessage>(
  time: number = 100,
  merge: (currentMessage: T, nextMessage: T) => void = () => {},
) {
  return function (target: Newable<T>) {
    debounceMap.set(target, {
      time,
      merge,
    });
  };
}

/**
 * Throttle decorator: Limit the frequency of message triggering
 */
export function Throttle(time: number = 100) {
  return function (target: Newable<BaseMessage>) {
    throttleMap.set(target, time);
  };
}

function middleWare(message: BaseMessage, next: () => void): void {
  const messageClass = message.constructor as Newable<BaseMessage>;
  // 处理防抖
  const de = debounceMap.get(messageClass);

  if (de) {
    const prevTask = prevDebounceTask.get(messageClass);
    // 如果之前已经有在排队的任务，清除旧计时器并合并消息
    if (prevTask) {
      clearTimeout(prevTask.timer);
      de.merge(message, prevTask.message);
      const newTimer = setTimeout(() => {
        prevDebounceTask.delete(messageClass);
        next();
      }, de.time);

      prevDebounceTask.set(messageClass, {
        message: message,
        timer: newTimer,
      });
    } else {
      // First trigger
      const timer = setTimeout(() => {
        prevDebounceTask.delete(messageClass);
        next();
      }, de.time);
      prevDebounceTask.set(messageClass, { message, timer });
    }
    return; // Intercept the current message without immediately executing downwards
  }
  // 处理节流
  const th = throttleMap.get(messageClass);
  if (th) {
    const now = Date.now();
    const lastTime = prevThTime.get(messageClass) || 0;
    if (now - lastTime >= th) {
      prevThTime.set(messageClass, now);
      next();
    } else {
      // Time is not enough, discard the message directly
      return;
    }
    return;
  }
  next();
}

export function activateDeTh(app: ViridApp) {
  app.useMiddleware(middleWare);
}
