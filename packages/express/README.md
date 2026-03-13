

# **@virid/express**

`@virid/express` is an adapter for Express responsible for converting incoming HTTP request messages into Virid’s `HttpRequestMessage`. It also provides a set of dependency injection features similar to NestJS, making the handling of HTTP requests as seamless as processing local Messages.

## 🌟 Core Design Philosophy

In `@virid/express`, Express serves merely as a standard I/O layer. Its role is to convert HTTP requests into corresponding Messages and deliver them into the Virid scheduler. Additionally, `@virid/express` provides a set of NestJS-like decorators, allowing HTTP request components—such as the **body** and **query**—to be injected directly into the System.

- **HTTP Request to Message:** All HTTP requests are instantiated as specific Messages and dispatched to the scheduler. By using decorators, the Message declaration itself becomes the API definition.
- **Semantic Return Values:** You can use factory functions like `Ok()`, `NotFound()`, or `StreamFile()` within a System. These are automatically converted into the appropriate HTTP status codes to terminate the request. Alternatively, returning a new `HttpRequestMessage` enables internal request forwarding.
- **Lifecycle Reference Counting:** To support internal forwarding and redirection, `@virid/express` implements reference-counted lifecycle tracking for every HTTP request. If a request has not been responded to after all Systems finish execution, `@virid/express` will automatically close the connection and throw an error to prevent the request from hanging.

## 🔌Enable plugins

```ts
import { createVirid } from '@virid/core'
import { ExpressPlugin } from '@virid/express'
import express from 'express'

const server = express()
const virid = createVirid()
  .use(ExpressPlugin, { server: server })
```

## 🛠️ @virid/express Core API Overview

### **HttpContext**

- **Function:** `@virid/express` maintains an `HttpContext` for every HTTP request, containing critical metadata. Whenever a corresponding `System` finishes execution, the Reference Count (**RC**) is automatically decremented by 1. If the RC reaches 0 and the HTTP request has not yet received a response, `@virid/express` will automatically close the connection and log an error message.
- **Logic:** You can use the `@Ctx()` decorator within a `System` to retrieve the `HttpContext` of the current request.
- **Example:**

```ts
export class HttpContext {
  public rc: number = 0;
  public isClosed: boolean = false;

  constructor(
    public readonly id: number,
    public readonly req: Request,
    public readonly res: Response,
    public readonly timestamp: number,
    public readonly route: string,
  ) {}
}
```

------

### **HttpRequestMessage & @HttpRoute()**

- **Function:** `HttpRequestMessage` is a specialized Message type. Every incoming HTTP request is automatically converted into a message of this type. The `@HttpRoute` decorator marks the routing metadata for the `HttpRequestMessage`, including the **path** and **method**.
- **Logic:** `@HttpRoute` and `HttpRequestMessage` are designed to be used as a pair; `@HttpRoute` can only be applied to classes extending `HttpRequestMessage`. Each `HttpRequestMessage` comes with a `RequestId` type ID, serving as the unique identifier for the current request.
- **Example:**

```ts
import { HttpRoute, HttpRequestMessage } from '@virid/express';

@HttpRoute({
  path: '/api/login/qr/check',
  method: 'post'
})
export class LoginQrCheckRequestMessage extends HttpRequestMessage {}
```

### **@HttpSystem()**

- **Function:** `@HttpSystem()` differs from the standard `@System()` found in `@virid/core`. It can only be triggered by messages of type `HttpRequestMessage` and supports specialized decorators such as `@Body`, `@Query`, etc.
- **Logic:** If an error is thrown within an `@HttpSystem`, it is automatically caught and converted into an `InternalServerError()`. Furthermore, `@HttpSystem` supports returning factory functions like `Ok()` or `NotFound()` to directly set response headers and HTTP status codes. It also allows returning a new `HttpRequestMessage` to achieve "request relay" (internal forwarding).

#### **Example 1: Parameter Injection**

You can inject various HTTP parameters directly into the system method.

```ts
import { Body, Cookies, Headers, HttpSystem, Ok } from '@virid/express'

export class LoginQrCheckSystem {
  @HttpSystem({
    messageClass: LoginQrCheckRequestMessage
  })
  // Directly inject various HTTP parameters into the system
  public static async checkQrStatus(
    @Body() body: LoginQrCheckRequest,
    @Cookies() cookies: Record<string, string>,
    @Headers() headers: Record<string, string>
  ) {
    const { unikey } = body

    const answer = await createRequest({
      url: '/login/qrcode/client/login',
      data: {
        key: unikey,
        type: 3
      },
      cookies,
      headers
    })
    
    // Returns a 200 OK with data and custom headers
    return Ok(answer.data as LoginQrCheckResponse, {
      'Set-Cookie': answer.cookies
    })
  }
}
```

#### **Example 2: Request Relay and Flow Control**

This example demonstrates how an HTTP request can flow between different `HttpSystems` using internal message types.

```ts
// Internal message types used for request flow/relay
class DataFromLocalMessage extends HttpRequestMessage {
  constructor(
    requestId: RequestId,
    public songId: number
  ) {
    super(requestId)
  }
}

class DataFromCacheMessage extends HttpRequestMessage {
  constructor(
    requestId: RequestId,
    public cachePath: string
  ) {
    super(requestId)
  }
}

// Route Registration
@HttpRoute({
  path: '/cache/songs/data',
  method: 'get'
})
class CacheSongDataRequestMessage extends HttpRequestMessage {}

export class CacheSongDataSystem {
  @HttpSystem()
  public static async songData(
    @Message(CacheSongDataRequestMessage) message: CacheSongDataRequestMessage,
    @Query('id') id: number,
    @Query('md5') md5: string,
    @Query('source') source: 'net' | 'local',
    @Headers() headers: Record<string, string>,
  ) {
    const requestId = message.requestId
    
    // Relay the request to local logic by returning a new Message
    if (source === 'local') return new DataFromLocalMessage(requestId, id)
    
    // Relay to cache logic if a local path exists
    if (localPath) return new DataFromCacheMessage(requestId, localPath)

    // Otherwise, return a web stream directly
    return Stream(webStream)
  }

  @HttpSystem()
  public static async songDataFromLocal(
    @Message(DataFromLocalMessage) _message: DataFromLocalMessage,
    dbComponent: DatabaseComponent
  ) {
    // Read file from local storage and return as a file stream
    return StreamFile(absolutePath, {
      dotfiles: 'allow'
    })
  }

  @HttpSystem()
  public static async songDataFromCache(
    @Message(DataFromCacheMessage) message: DataFromCacheMessage,
    @Query('id') id: number,
    @Query('md5') md5: string,
    dbComponent: DatabaseComponent
  ) {
    // Read from cache file and return as a file stream
    return StreamFile(absolutePath, {
      dotfiles: 'allow'
    })
  }
```

### **@Body(), @Query(), and Parameter Decorators**

- **Function:** Automatically extracts various information from the incoming request and injects it as arguments into the `HttpSystem` method. This behavior is similar to NestJS decorators.
- **Example:**

```ts
export class LoginQrCheckSystem {
  @HttpSystem({
    messageClass: LoginQrCheckRequestMessage
  })
  // You can directly inject various HTTP parameters into the system
  public static async checkQrStatus(
    @Body() body: LoginQrCheckBody,
    @Cookies() cookies: Record<string, string>,
    @Headers() headers: Record<string, string>,
    @Query() id: number,
    @Params() params: LoginQrCheckParams,
    @Req() req: Request,
    @Res() res: Response, 
    @Ctx() ctx: HttpContext,
  ) {
    // ....
    return Ok();
  }
}
```

------

### **Pipes**

- **Function:** `@virid/express` supports lightweight pipe processing and automatic type conversion. It also allows for custom transformation logic for specific types.
- **Logic:** When using `@Query()`, `@virid/express` performs automatic type casting. For instance, `@Query() id: number` will automatically be converted to a `number` type. You can also register custom pipes for your own specific types.
- **Example:**

```ts
import { addAutoPipe } from '@virid/express';

// Register a global transformation for YourType
addAutoPipe(YourType, (data: any) => { 
    // Perform transformation logic here
    return newData; 
});
```

------

### 🛜 **Other Response Types**

The following factory functions can be used within a System to return standardized HTTP responses:

- **`Ok(data, headers)`**: `200 OK`.
- **`Created(data, headers)`**: `201 Created`.
- **`NoContent()`**: `204 No Content`.
- **`BadRequest(msg)`**: `400 Bad Request`.
- **`Unauthorized(msg)`**: `401 Unauthorized`.
- **`Forbidden(msg)`**: `403 Forbidden`.
- **`NotFound(msg)`**: `404 Not Found`.
- **`InternalServerError(msg)`**: `500 Internal Server Error`.
- **`CustomResponse(status, data, headers)`**: Returns a response with a custom status code.
- **`StreamFile(path, options)`**: Sends a local file, automatically handling **Range** requests and **206 Partial Content**.
- **`Stream(stream, options)`**: Sends a raw `Readable` stream response.

#### **Error Handling**

The `HttpError` class can be thrown within a system to trigger a specific HTTP status response automatically:

TypeScript

```
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly message: string,
  ) {
    super(message);
  }
}
```