/*
 * Copyright (c) 2026-present Ailrid.
 * Licensed under the Apache License, Version 2.0.
 * Project: Virid
 */
import "reflect-metadata";
import express from "express";
import { createVirid, Component, System, EventMessage } from "@virid/core";
import {
  HttpRequestMessage,
  HttpSystem,
  HttpRoute,
  RequestId,
  Ok,
  ExpressPlugin,
  Params,
  Query,
} from "@virid/express";

const app = createVirid();
const expressPlugin = new ExpressPlugin();
const server = express();

@Component()
class Database {
  counter = 0;
}

@HttpRoute({ method: "get", path: "/hello/:id" })
class HelloWorldMessage extends HttpRequestMessage {}

@HttpRoute({ method: "post", path: "/relay" })
class RelayMessage extends HttpRequestMessage {}

class ReplyMessage extends HttpRequestMessage {
  public time: number;
  constructor(requestId: RequestId, time: number) {
    super(requestId);
    this.time = time;
  }
}

class updateDatabaseMessage extends EventMessage {}

class Server {
  @HttpSystem({
    messageClass: HelloWorldMessage,
  })
  // using Params can obtain routing parameters
  // Similar examples include @ Body, @ Headers, @ Req, @ Res, @ Ctx, and so on
  static helloWorld(@Params("id") id: string) {
    // you can send non HTTP messages in the HTTP system
    updateDatabaseMessage.send();

    return Ok(`Hello ${id}`);
  }
  @HttpSystem()
  // using Query can obtain routing parameters
  static relay(message: RelayMessage, @Query("time") time: number) {
    // you can forward an HTTP message to another HTTP System
    // and this HTTP message does not need to be decorated with an HTTP route
    // at this point, the reference count will ensure that the connection remains open continuously (requestId)
    return new ReplyMessage(message.requestId, time);
  }
  @HttpSystem()
  static async reply(message: ReplyMessage) {
    const promise = new Promise<void>((resolve) =>
      setTimeout(() => {
        console.log("Reply:", message.time);
        resolve();
      }, message.time),
    );

    await promise;
    return Ok(`Reply: ${message.time}`);
  }

  @System({
    messageClass: updateDatabaseMessage,
  })
  static updateDatabase(database: Database) {
    database.counter++;
    console.log("Database updated:", database.counter);
  }
}

app.bind(Database);
// register regular system and HTTP system using different register functions
app.register(Server.updateDatabase);
expressPlugin.register(Server.helloWorld);
expressPlugin.register(Server.relay);
expressPlugin.register(Server.reply);
// register the routing message you need
expressPlugin.bindRoute(HelloWorldMessage);
expressPlugin.bindRoute(RelayMessage);
// since ReplyMessage does not automatically send, there is no need to register here
// expressPlugin.bindRoute(ReplyMessage);

// enable plugin
app.use(expressPlugin, { server });
// start the server
server.listen(3000);

// http:localhost:3000/hello/ailird ->"Hello ailird"
// Database updated: 1

// http:localhost:3000/relay?time=3000 ->"Reply: 3000"
// Reply: 3000
