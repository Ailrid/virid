/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Main
 */
const VIRID_CHANNEL = "VIRID_INTERNAL_BUS";
import { type ViridApp, MessageWriter } from "@virid/core";
import { BrowserWindow, ipcMain } from "electron";
import { middleWare, processMessage, ROUTER_MAP } from "./main";
import { type PluginOption } from "./interfaces";
export function activateApp(app: ViridApp, options: PluginOption) {
  //Check parameters
  if (!options?.electronApp) {
    MessageWriter.error(
      new Error(
        `[Virid Main] Missing Initialization Parameters:\nelectronApp:${options?.electronApp}.`,
      ),
    );
  }
  //Bind Electron main process callback
  ipcMain.on(VIRID_CHANNEL, (event, message) => {
    const { __virid_target, __virid_source, __virid_messageType } = message;
    if (!__virid_target || !__virid_source || !__virid_messageType) {
      MessageWriter.error(
        new Error(
          `[Virid Main] Incomplete Message: The message is incomplete and requires __virid_target${__virid_target}, __virid_source${__virid_source}, __virid_messageType${__virid_messageType}`,
        ),
      );
      return;
    }
    // If it is a registration message, then register this rendering process
    if (__virid_messageType === "VIRID_INTERNAL_REGISTER") {
      // Obtain the physical instance through event.sender and bind it with the logical ID
      const win = BrowserWindow.fromWebContents(event.sender);
      //Unable to find window, error reported
      if (!win) {
        MessageWriter.error(
          new Error(
            `[Virid Main] unknown Window: Unable to find the window corresponding to event.sender`,
          ),
        );
        return;
      }
      //If it already exists, report an error
      if (ROUTER_MAP.has(__virid_source)) {
        MessageWriter.error(
          new Error(
            `[Virid Main] Duplicate Registration: This ID has already been registered: ${__virid_source}`,
          ),
        );
        return;
      }
      // Store in routing table
      ROUTER_MAP.set(__virid_source, win);
      // Automatically delete oneself when closed
      win.once("closed", () => {
        ROUTER_MAP.delete(__virid_source);
        MessageWriter.info(
          `[Virid Main] Window unregistered: ${__virid_source}`,
        );
      });
      MessageWriter.info(`[Virid Main] Window registered: ${__virid_source}`);
      return;
    }
    //Distribute messages
    processMessage(message);
  });
  //Register your own middleware function to intercept ToRenderMessage and send it to the specified rendering process
  app.useMiddleware(middleWare);
}
