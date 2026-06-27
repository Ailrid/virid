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
// Execution team columns cached in each key
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
      // Only when the current task is successfully executed, will we proceed to the next one
      if (executeGroup.length > 0) {
        const { resolve } = executeGroup.shift()!;
        resolve();
      }
      if (executeGroup.length == 0) {
        callBackMap.get(key)!(true);
        clearGroup(key);
      }
    } else {
      callBackMap.get(key)!(false);
      clearGroup(key);
      // If there is an error, cancel the execution queue directly
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
  // Construct a string of promises and store the resolutions, with each resolution initiating the next promise
  if (executeGroupMap.has(id)) {
    MessageWriter.error(
      new Error(
        `[ExecuteGroup] Unavailable ID: The id '${id}' not yet executed`,
      ),
    );
    return Promise.resolve(false);
  }
  // Register this execution group
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

  // Immediately trigger the first one
  MessageWriter.write(messages[0]);
  return promise;
}

export function activateGroupMessages(app: ViridApp) {
  app.onAfterExecute(EventMessage, afterExecuteHook);
}
