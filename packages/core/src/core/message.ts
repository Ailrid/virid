/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */
import { Newable } from "../interfaces";
import { MessageWriter } from "./io";

export abstract class BaseMessage {
  static send<T extends Newable<any>>(
    this: T,
    ...args: ConstructorParameters<T>
  ) {
    MessageWriter.write(this as any, ...args);
  }
}

export abstract class SingleMessage extends BaseMessage {
  constructor() {
    super();
  }
}

export abstract class EventMessage extends BaseMessage {
  constructor() {
    super();
  }
}

export class ErrorMessage extends EventMessage {
  constructor(
    public readonly error: Error,
    public readonly context?: string,
  ) {
    super();
  }
}

export class WarnMessage extends EventMessage {
  constructor(public readonly context: string) {
    super();
  }
}

export class InfoMessage extends EventMessage {
  constructor(public readonly context: string) {
    super();
  }
}
