// src/renderer/src/main.ts
import "reflect-metadata";
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";

const app = createApp(App);
app.use(router);
/**
 * 全局错误处理
 */
app.config.errorHandler = (err, instance, info) => {
  // DI 错误
  if (err instanceof Error && err.message.includes("[DI Error]")) {
    console.error(
      "Core dependencies are missing, program rendering interrupted:",
      {
        message: err.message,
        component: instance?.$options.name || "unknown",
        lifecycle: info,
      },
    );
    return;
  }

  // 其他类型的通用错误
  console.error("Vue Caught:", err, info);
};

import { bootstrapDI } from "./logic/ioc.config";
bootstrapDI();

app.mount("#app");
