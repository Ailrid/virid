import { Newable, type BaseMessage } from "../core";

export interface SystemParams {
  priority?: number;
  eventClass?: Newable<BaseMessage> | null;
}
export interface MessageMetadata {
  index: number;
  eventClass: Newable<BaseMessage>;
  single: boolean;
}

export interface ObserverItem {
  key: string;
  callback: (oldVal: any, newVal: any) => void | BaseMessage | BaseMessage;
}
export type ObserverMetadata = ObserverItem[];

export interface SafeMetadata extends Set<string> {}
