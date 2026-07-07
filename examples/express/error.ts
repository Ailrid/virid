/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid
 */
import "reflect-metadata";
import express from "express";
import { createVirid } from "@virid/core";
import {
  HttpRequestMessage,
  HttpSystem,
  HttpRoute,
  ExpressPlugin,
  BadRequest,
  NotFound,
  InternalServerError,
  HttpError,
} from "@virid/express";

const app = createVirid();
const expressPlugin = new ExpressPlugin();
const server = express();

@HttpRoute({ method: "get", path: "/http-error" })
class HttpErrorMessage extends HttpRequestMessage {}

@HttpRoute({ method: "get", path: "/custom-error" })
class CustomErrorMessage extends HttpRequestMessage {}

@HttpRoute({ method: "get", path: "/internal-error" })
class InternalErrorMessage extends HttpRequestMessage {}

class CustomError extends HttpError {
  constructor(status: number, msg: string) {
    super(status, msg);
  }
}

class ServerError {
  @HttpSystem({
    messageClass: HttpErrorMessage,
  })
  static httpError() {
    throw new Error(`Http Error`);
  }

  @HttpSystem({
    messageClass: CustomErrorMessage,
  })
  static customError() {
    throw new CustomError(400, `Custom Error`);
  }
  @HttpSystem({
    messageClass: InternalErrorMessage,
  })
  static internalError() {
    return BadRequest("something went wrong");
    // return NotFound();
    // return InternalServerError();
  }
}

// register HTTP system
expressPlugin.register(ServerError.httpError);
expressPlugin.register(ServerError.customError);
expressPlugin.register(ServerError.internalError);
// register the routing message you need
expressPlugin.bindRoute(HttpErrorMessage);
expressPlugin.bindRoute(CustomErrorMessage);
expressPlugin.bindRoute(InternalErrorMessage);

// enable plugin
app.use(expressPlugin, { server });
server.listen(3000);

// http:localhost:3000/error ->{"error": "Http Error"}
//  ✖ [Virid Error] Global Error Caught:
// Context: [Virid Dispatcher]: Sync System Error.
// SystemLocation: ServerError.httpError
// MessageName:    HttpErrorMessage
// MessageData:    {"__virid_express_id":0}
// Details: Error: Http Error

// http:localhost:3000/http-error ->"Custom Error"
//  ✖ [Virid Error] Global Error Caught:
// Context: [Virid Dispatcher]: Sync System Error.
// SystemLocation: ServerError.customError
// MessageName:    CustomErrorMessage
// MessageData:    {"__virid_express_id":1}
// Details: CustomError: Custom Error

// http:localhost:3000/internal-error ->{"error": "something went wrong"}


