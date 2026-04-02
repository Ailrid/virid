/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */
import { viridApp } from "../app";
import {
  BaseMessage,
  MessageWriter,
  EventMessage,
  SingleMessage,
} from "../core";
import { VIRID_METADATA } from "./constant";
import {
  type SystemContext,
  type Newable,
  type SystemParams,
  type MessageMetadata,
  type ObserverMetadata,
  type SafeMetadata,
} from "../interfaces";
// 统一处理返回值：System 可以直接 return 一个消息来实现“链式反应”
export const handleResult = (res: any) => {
  if (!res) return;
  const messages = Array.isArray(res) ? res : [res];
  messages.forEach((m) => {
    if (m instanceof BaseMessage) {
      MessageWriter.write(m);
    } else {
      MessageWriter.warn(
        `[Virid HandleResult] Invalid Return Type: Must return Message or  Message[].`,
      );
    }
  });
};

/**
 * @description: 系统装饰器
 * @param priority 优先级，数值越大越早执行
 */
export function System(
  params: SystemParams = {
    priority: 0,
    messageClass: null,
  },
) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    const types = Reflect.getMetadata("design:paramtypes", target, key);
    const messageMetadata: MessageMetadata =
      Reflect.getMetadata(VIRID_METADATA.MESSAGE, target, key) || null;

    if (!types) {
      const error = new Error(
        `[Virid System] System Parameter Loss:\nUnable to recognize system parameters, please confirm if import "reflection-metadata" was introduced at the beginning!`,
      );
      MessageWriter.error(error);
      return;
    }
    // 检查是否有参数类型丢失
    if (types.some((t: any) => t === undefined)) {
      const error =
        new Error(`[Virid System] Parameter Metadata Loss in "${key}": 
  One or more parameters have 'undefined' types. 
  This usually happens when you forget to add a type annotation to a decorated parameter.
  Check parameter at index: ${types.indexOf(undefined)}`);

      MessageWriter.error(error);
      return;
    }
    // 不能同时使用@message() 和 SystemParams
    if (params.messageClass && messageMetadata) {
      MessageWriter.error(
        new Error(
          `[Virid System] Multiple Messages Are Not Allowed: Cannot use @ message() and SystemParams simultaneously in ${key}`,
        ),
      );
      return;
    }
    // @message() 和 SystemParams至少得有一个
    if (!params.messageClass && !messageMetadata) {
      MessageWriter.error(
        new Error(
          `[Virid System] System Parameter Loss:\nPlease declare the message type using the Message decorator`,
        ),
      );
      return;
    }

    const wrappedSystem = (currentMessage: EventMessage | SingleMessage[]) => {
      const args = types.map((type: any, index: number) => {
        // 先看看这个参数是不是标记过的Event
        if (messageMetadata && messageMetadata.index == index) {
          const { messageClass, single } = messageMetadata;
          // 基础校验：判断当前投递的消息实例是否属于装饰器声明的类或其子类
          const sample = Array.isArray(currentMessage)
            ? currentMessage[0]
            : currentMessage;
          if (!(sample instanceof messageClass)) {
            const receivedName = (sample as object).constructor.name;
            // 如果类型不匹配，说明 Dispatcher 路由逻辑或元数据配置有问题
            throw new Error(
              `[Virid System] Type Mismatch: Expected ${messageClass.name}, but received ${receivedName}`,
            );
          }
          // 处理 SingleMessage (合并且批处理类型)
          if (sample instanceof SingleMessage) {
            // 如果用户标记了 single: true，则只取最后一条（最新的一条）
            if (single) {
              return Array.isArray(currentMessage)
                ? currentMessage[currentMessage.length - 1]
                : currentMessage;
            }
            // 否则默认返回整个数组（批处理模式）
            return Array.isArray(currentMessage)
              ? currentMessage
              : [currentMessage];
          }
          // 处理 EventMessage (顺序单发类型)
          if (sample instanceof EventMessage) {
            return currentMessage;
          }
          throw new Error(
            `[Virid System] unknown Message Types: Message ${messageClass.name} is not a subclass of SingleMessage or EventMessage!`,
          );
        }
        // 处理普通的依赖注入
        const param = viridApp.get(type);
        if (!param) {
          throw new Error(
            `[Virid System] unknown Inject Data Types: ${type.name} is not registered in the container!`,
          );
        }
        return param;
      });

      // 执行业务逻辑
      const result = originalMethod.apply(target, args);

      return result instanceof Promise
        ? result.then(handleResult)
        : handleResult(result);
    };
    // 给包装后的函数挂载上下文信息（供 Dispatcher 读取）
    const systemContext: SystemContext = {
      params: types,
      targetClass: target,
      methodName: key,
      originalMethod: originalMethod,
    };
    (wrappedSystem as any).systemContext = systemContext;
    // 修改方法定义
    descriptor.value = wrappedSystem;
    // 注册到调度中心
    const messageClass = params.messageClass || messageMetadata.messageClass;
    viridApp.register(messageClass, wrappedSystem, params.priority);
  };
}

/**
 * @description: 标记参数为 MessageReader 并锁定其消息类型
 */
export function Message<T extends BaseMessage>(
  messageClass: Newable<T>,
  single = true,
) {
  return (target: any, key: string, index: number) => {
    if (Reflect.hasOwnMetadata(VIRID_METADATA.MESSAGE, target, key)) {
      MessageWriter.error(
        new Error(
          `[Virid Message] Multiple Messages Are Not Allowed: ${key} has multiple @Message() decorators!`,
        ),
      );
      return;
    }
    const messageMetadata: MessageMetadata = {
      index,
      messageClass,
      single,
    };
    Reflect.defineMetadata(
      VIRID_METADATA.MESSAGE,
      messageMetadata,
      target,
      key,
    );
  };
}

/**
 * @description: 标识controller或者组件的方法是否是安全的，可被其他controller直接调用
 */
export function Safe() {
  return (target: any, key: string, _descriptor: PropertyDescriptor) => {
    // 标识这个方法是“只读安全”的
    // 只需要标记这个 key
    const safeMethods: SafeMetadata =
      Reflect.getMetadata(VIRID_METADATA.SAFE, target) || new Set<string>();
    safeMethods.add(key);
    // 存回到 prototype
    Reflect.defineMetadata(VIRID_METADATA.SAFE, safeMethods, target);
  };
}

/**
 * @description: 标识Component里的这个属性被改了之后需要调用一个回调
 */
export function Observer(
  callback: (oldVal: any, newVale: any) => void | BaseMessage | BaseMessage,
) {
  return (target: any, key: string) => {
    // 记录哪些属性需要变成响应式
    const observerMetadata: ObserverMetadata =
      Reflect.getMetadata(VIRID_METADATA.OBSERVER, target) || [];
    observerMetadata.push({ key, callback });
    Reflect.defineMetadata(VIRID_METADATA.OBSERVER, observerMetadata, target);
  };
}

/**
 * @description: 标记Controller身份
 */
export function Controller() {
  return (target: any) => {
    // 打上身份标签
    Reflect.defineMetadata(VIRID_METADATA.CONTROLLER, true, target);
  };
}
/**
 * @description: 标记Component身份
 */
export function Component() {
  return (target: any) => {
    // 打上组件标签
    Reflect.defineMetadata(VIRID_METADATA.COMPONENT, true, target);
  };
}
