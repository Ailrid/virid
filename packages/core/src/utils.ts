/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Core
 */
import { type ViridApp } from "./app";
import { ErrorMessage, InfoMessage, WarnMessage } from "./core";
import { System } from "./decorators";

let globalSwitch = true;

export function toggleSwitch(enable: boolean) {
  globalSwitch = enable;
}

const clr = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
};

class ViridLogHandler {
  /**
   * Register the global default information processing system
   */
  @System()
  static globalInfoHandler(info: InfoMessage) {
    if (!globalSwitch) return;
    const header = `${clr.green}${clr.bold} ✔ [Virid Info] ${clr.reset}`;
    const context = `${clr.magenta}${info.context}${clr.reset}`;

    console.log(
      `${header}${clr.gray}Global Info Caught:${clr.reset}\n` +
      `${clr.green}Details:${clr.reset}`,
      context || "unknown Info",
    );
  }

  /**
   * Register the global default error handling system
   */
  @System()
  static globalErrorHandler(err: ErrorMessage) {
    if (!globalSwitch) return;
    const header = `${clr.red}${clr.bold} ✖ [Virid Error] ${clr.reset}`;
    const context = `${clr.magenta}${err.context}${clr.reset}`;

    console.error(
      `${header}${clr.gray}Global Error Caught:${clr.reset}\n` +
      `${clr.red}Context:${clr.reset} ${context}\n` +
      `${clr.red}Details:${clr.reset}`,
      err.error || err || "unknown Error",
    );
  }

  /**
   * Register the global default warning handling system
   */
  @System()
  static globalWarnHandler(warn: WarnMessage) {
    if (!globalSwitch) return;
    const header = `${clr.yellow}${clr.bold} ⚠ [Virid Warn] ${clr.reset}`;
    const context = `${clr.cyan}${warn.context}${clr.reset}`;

    console.warn(
      `${header}${clr.gray}Global Warn Caught:${clr.reset}\n` +
      `${clr.yellow}Context:${clr.reset} ${context}`,
    );
  }
}

export function registerBasicSystems(app: ViridApp) {
  app.register(ViridLogHandler.globalInfoHandler);
  app.register(ViridLogHandler.globalErrorHandler);
  app.register(ViridLogHandler.globalWarnHandler);
}
