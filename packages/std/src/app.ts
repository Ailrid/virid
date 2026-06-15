/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid Std
 */

import { type ViridApp } from "@virid/core";
import { activateUtils } from "./utils";
import { activateMessages } from "./messages";

export function activateApp(app: ViridApp) {
  activateUtils(app);
  activateMessages(app);
}