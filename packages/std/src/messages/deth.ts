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
// 存储每个消息类对应的当前防抖任务（包含合并后的消息内容和计时器）
const prevDebounceTask = new Map<Newable<BaseMessage>, DebounceTask>();

const throttleMap = new Map<Newable<BaseMessage>, number>();
// 存储每个消息类上一次真正执行的时间戳
const prevThTime = new Map<Newable<BaseMessage>, number>();

/**
 * 防抖装饰器：连续触发的消息会合并，直到停止触发一段时间后才执行
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
 * 节流装饰器：限制消息触发的频率
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
      // 第一次触发
      const timer = setTimeout(() => {
        prevDebounceTask.delete(messageClass);
        next();
      }, de.time);
      prevDebounceTask.set(messageClass, { message, timer });
    }
    return; // 拦截当前消息，不立即向下执行
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
      // 时间不够，直接丢弃该消息
      return;
    }
    return;
  }
  next();
}

export function activateDeTh(app: ViridApp) {
  app.useMiddleware(middleWare);
}
