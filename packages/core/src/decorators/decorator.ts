/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */
import { BaseMessage, MessageWriter, SingleMessage } from "../core";
import { VIRID_METADATA } from "./constant";
import {
  type SystemContext,
  type Newable,
  type SystemParams,
  type ObserverMetadata,
  type SafeMetadata,
  SystemConfig,
} from "../interfaces";

// Unified processing of return values: System can directly return a message to achieve a chain reaction
export function handleResult(res: any) {
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
}

/**
 * Check if there are multiple message type parameters in the parameters
 * @param types Parameter list
 */
function checkMessageParam(types: Array<any>) {
  const foundMatches: { type: any; idx: number }[] = [];

  types.forEach((type, idx) => {
    const isBaseMessage =
      type === BaseMessage || (type && type.prototype instanceof BaseMessage);

    if (isBaseMessage) {
      foundMatches.push({ type, idx });
    }
  });

  if (foundMatches.length === 0) {
    return null; // 或者根据你的业务返回 undefined / 报错
  }

  if (foundMatches.length > 1) {
    // 发现多个，把所有的错误信息组合起来抛出
    const errorDetails = foundMatches
      .map((item) => `[Index: ${item.idx}, Name: ${item.type.name}]`)
      .join(", ");

    throw new Error(
      `[Virid System] Multiple Messages: Multiple Message type parameters detected, this is not allowed! specific location: ${errorDetails}`,
    );
  }

  return foundMatches[0];
}

/**
 * System Decorator
 * @param params Priority and MessageClass config
 */
export function System(
  params: SystemParams = {
    messageClass: null,
    priority: 0,
  },
) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    if (typeof target !== "function") {
      throw new Error(
        `[Virid System] Method Type Error: The Method ${key} is not a static method, please check if there is a static keyword tag.`,
      );
    }

    const originalMethod = descriptor.value;
    const types: Array<any> = Reflect.getMetadata(
      "design:paramtypes",
      target,
      key,
    );

    // Verify if metadata exists
    if (!types) {
      throw new Error(
        `[Virid System] System Parameter Loss: Unable to recognize system parameters, please confirm if import "reflect-metadata" was introduced at the beginning.`,
      );
    }

    // Verify if there are undefined parameters
    const undefinedIndices = types
      .map((t, i) => (t === undefined ? i : -1))
      .filter((i) => i !== -1);
    if (undefinedIndices.length > 0) {
      throw new Error(
        `[Virid System] Parameter Metadata Loss in "${key}": One or more parameters have 'undefined' types. This usually happens when you forget to add a type annotation or due to circular dependencies. Check parameter at indices: [${undefinedIndices.join(", ")}]`,
      );
    }

    let messageClass: Newable<BaseMessage>;
    // eslint-disable-next-line no-useless-assignment
    let messageIdx: number = -1;
    let batchMode = false;
    const listIdx = types.indexOf(Array);

    if (listIdx !== -1) {
      // Batch processing mode (with Array parameters)
      if (!params.messageClass) {
        throw new Error(
          `[Virid System] System Parameter Loss: When using batch processing mode with Array, the messageClass parameter must be specified in decorator options.`,
        );
      }
      if (!(params.messageClass.prototype instanceof SingleMessage)) {
        throw new Error(
          `[Virid System] System Parameter Loss: When using the batch processing mode, the messageClass parameter must inherit from SingleMessage.`,
        );
      }
      messageClass = params.messageClass;
      messageIdx = listIdx; //  In batch processing mode, idx points to the position of Array
      batchMode = true;
    } else {
      // Non batch processing mode
      const matchedMessage = checkMessageParam(types); // { type: any, idx: number } | null

      if (matchedMessage && params.messageClass) {
        throw new Error(
          `[Virid System] Multiple Messages Are Not Allowed: Cannot specify messageClass in decorator options while already declaring it in method parameters at index ${matchedMessage.idx} in ${key}.`,
        );
      }

      if (matchedMessage) {
        messageClass = matchedMessage.type;
        messageIdx = matchedMessage.idx; // In single mode, idx points to the location of a specific BaseMessage subclass
      } else if (params.messageClass) {
        messageClass = params.messageClass;
        messageIdx = -1; // Only provided in the configuration, cannot be found in the parameters, set to -1
      } else {
        throw new Error(
          `[Virid System] System Parameter Loss: Please declare the message type either in method parameters or via the Message decorator options.`,
        );
      }
    }

    // Attach contextual information to the packaged function
    const systemContext: SystemContext = {
      params: types,
      targetClass: target,
      methodName: key,
      originalMethod: originalMethod,
    };
    const systemConfig: SystemConfig = {
      messageClass: messageClass,
      messageIdx: messageIdx,
      priority: params.priority || 0,
      batchMode: batchMode,
    };

    // Purely mounting data without changing the execution logic of the original method
    (descriptor.value as any).systemContext = systemContext;
    (descriptor.value as any).systemConfig = systemConfig;
  };
}

/**
 * Is the method used to identify the controller or component safe and can be directly called by other controllers
 */
export function Safe() {
  return (target: any, key: string, _descriptor: PropertyDescriptor) => {
    const safeMethods: SafeMetadata =
      Reflect.getMetadata(VIRID_METADATA.SAFE, target) || new Set<string>();
    safeMethods.add(key);
    Reflect.defineMetadata(VIRID_METADATA.SAFE, safeMethods, target);
  };
}

/**
 * Observer Decorator
 */
export function Observer(
  callback: (oldVal: any, newVale: any) => void | BaseMessage | BaseMessage[],
) {
  return (target: any, propertyKey: string) => {
    const observerMetadata: ObserverMetadata =
      Reflect.getMetadata(VIRID_METADATA.OBSERVER, target) || [];
    observerMetadata.push({ propertyKey, callback });
    Reflect.defineMetadata(VIRID_METADATA.OBSERVER, observerMetadata, target);
  };
}

/**
 * Controller Decorator
 */
export function Controller() {
  return (target: any) => {
    Reflect.defineMetadata(VIRID_METADATA.CONTROLLER, true, target);
  };
}
/**
 * Component Decorator
 */
export function Component() {
  return (target: any) => {
    // 打上组件标签
    Reflect.defineMetadata(VIRID_METADATA.COMPONENT, true, target);
  };
}
