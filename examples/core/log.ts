/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid
 */
// This file shows how to replace the logging system of virid
// You need to import 'reflect metadata' in the first line;
import "reflect-metadata";
import {
  createVirid,
  ErrorMessage,
  WarnMessage,
  InfoMessage,
  System,
  Message,
  MessageWriter,
  SingleMessage,
} from "@virid/core";

// The embedded logging system can be turned off in the settings
const app = createVirid({
  enableLog: false,
});

class TestMessage extends SingleMessage {}

class LogSystem {
  @System()
  static info(@Message(InfoMessage) message: InfoMessage) {
    console.log(`[INFO] ${message.context}]`);
  }

  @System()
  static warn(@Message(WarnMessage) message: WarnMessage) {
    console.log(`[WARN] ${message.context}]`);
  }
  @System()
  static error(@Message(ErrorMessage) message: ErrorMessage) {
    console.log(
      `[ERROR] ${message.error.message}\nDetail: ${message.context}]`,
    );
  }

  @System()
  static test(@Message(TestMessage) message: TestMessage) {
    // If any error occurs in a system
    // it will be captured by the scheduler and automatically converted into a new Error Message
    throw new Error("Error Test");
  }
}

MessageWriter.info("This is a info message");
MessageWriter.warn("This is a warn message");
MessageWriter.error(new Error("Error Text"), "This is a info message");
TestMessage.send();

async function wait() {
  await new Promise<void>((resolve) => resolve());
}

wait();
