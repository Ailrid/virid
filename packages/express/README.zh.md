#  @virid/express

`@virid/express` 是 ` express` 的适配器，负责来自`http`请求的消息转换为`virid`中的`HttpRequestMessage`。并且提供了一组类似`Nestjs`的依赖注入功能。使得处理`http`请求可以像处理本地`Message`一样简单。

## 🌟 核心设计理念

在 `@virid/express` 中，`express`仅充当普通的io层，负责将`http`请求转换为对应的`Message`并投递进入`virid`调度中。`@virid/express`还提供了一组类`Nestjs`的装饰器，使得`http`请求体的`body`、`query`等也可以被注入到`system`中。

- **http请求转Message**：所有的`http`请求将被实例化为特定的`Message`并投递进入调度器。使用装饰器实现`Message`声明即API定义。
- **语义返回值**：可以使用`Ok()`、`NotFound()`、`StreamFile()`等工厂函数从`System`中返回，即可自动转化为相应的`HttpCode`响应并结束`http`请求，或者返回一个新的`HttpRequestMessage`实现请求的内部转发。
- **生命周期计数**：为了支持消息的内部转发与重定向，`@virid/express`为每个`http`请求实现了引用计数的生命周期跟踪功能。当所有的`System`执行完成后如果`http`请求还未响应，`@virid/express`将自动关闭连接并抛出错误，防止请求挂起。

## 🔌启用插件

```ts
import { createVirid } from '@virid/core'
import { ExpressPlugin } from '@virid/express'
import express from 'express'

const server = express()
const virid = createVirid()
  .use(ExpressPlugin, { server: server })
```

## 🛠️ @virid/express 核心 API 概览

### HttpContext

- **功能**：`@virid/express`将会每一个`http`请求维护一个`HttpContext`，包含一些重要信息，每当对应的`System`执行完，`rc`将会自动-1,当`rc`减为0时若`http`请求还未响应，`@virid/express`将自动关闭连接并打印错误信息。
- **逻辑**：你可以使用`@Ctx()`装饰器在System中以获得当前请求的`HttpContext`
- **示例：**

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

### `HttpRequestMessage与@HttpRoute()`

- **功能**：`HttpRequestMessage`是一种特殊的`Message`类型，每个http请求将被自动转变为一个`HttpRequestMessage`类型的消息。`HttpRoute`则标记了当前`HttpRequestMessage`的路由元信息，包含`path`与`method`等。
- **逻辑**：`HttpRoute`与`HttpRequestMessage`是成对使用的，`HttpRoute`只能在`HttpRequestMessage`上使用。每个`HttpRequestMessage`将自带一个`RequestId`类型的Id，用以作为当前请求的唯一标记。
- **示例：**

```ts
import { HttpRoute, HttpRequestMessage } from '@virid/express'
@HttpRoute({
  path: '/api/login/qr/check',
  method: 'post'
})
export class LoginQrCheckRequestMessage extends HttpRequestMessage {}
```

### `@HttpSystem（）`

- **功能**：`@HttpSystem()`与`@virid/core`中的`@System()`不同。`@HttpSystem()`只能被`HttpRequestMessage`类型的小消息触发，且支持`@Body`、`@Query`等装饰器。
- **逻辑**：`@HttpSystem()`类型的System中抛出错误后，将自动转换为`InternalServerError()`。且`@HttpSystem()`支持直接返回`OK()`、`NotFound()`等等直接来设置响应头和`HttpCode`，也支持返回新的`HttpRequestMessage`来实现请求接力。
- **示例：**

```ts
import { Body, Cookies, Headers, HttpSystem, Ok } from '@virid/express'

export class LoginQrCheckSystem {
  @HttpSystem({
    messageClass: LoginQrCheckRequestMessage
  })
  // 可以直接在system中注入各种http参数
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
    return Ok(answer.data as LoginQrCheckResponse, {
      'Set-Cookie': answer.cookies
    })
  }
}

```

```ts
// 这个示例展示了http请求如何在不同的HttpSystem之间流转
// 内部的两个用于流转的消息类型
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
// 注册路由
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
    // 如果是本地歌曲的url，转发http请求
    const requestId = message.requestId
    if (source == 'local') return new DataFromLocalMessage(requestId, id)
    // ...
   	//  如果有缓存，走缓存
    if (localPath) return new DataFromCacheMessage(requestId, localPath)
	// ....
    // 返回流对象
    return Stream(webStream)
  }

  @HttpSystem()
  public static async songDataFromLocal(
    @Message(DataFromLocalMessage) _message: DataFromLocalMessage,
    dbComponent: DatabaseComponent
  ) {
    // ...
    // 从本地读取文件并返回
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
   	// ....
    // 从缓存文件中读取并返回
    return StreamFile(absolutePath, {
      dotfiles: 'allow'
    })
  }
}
```

### `@Body（）/@Query等`

- **功能**：自动将请求的各种信息提取并作为`HttpSystem`的参数注入，与`Nestjs`的装饰器相似。
- **逻辑**：
- **示例：**

```ts
export class LoginQrCheckSystem {
  @HttpSystem({
    messageClass: LoginQrCheckRequestMessage
  })
  // 可以直接在system中注入各种http参数
  public static async checkQrStatus(
    @Body() body: LoginQrCheckBody,
    @Cookies() cookies: Record<string, string>,
    @Headers() headers: Record<string, string>,
    @Query() id:number,
    @Params() id:LoginQrCheckParams,
    @Req() req:Request,
    @Res() res:Response, 
    @Ctx() ctx: HttpContext,
  ) {
   	//....
    return Ok()
  }
}
```

### Pipe

- **功能**：`@virid/express`支持简单的pipe处理和自动转换，也支持自定义使用特定类型的pipe转换注册。
- **逻辑**：在使用`@Query()`时，`@virid/express`支持一些自动的转换，例如 `@Query() id:number`将自动转换为number类型，或者也可以为自己的类型设置相应的`pipe`转换。
- **示例**:

```ts
import { addAutoPipe } from '@virid/express'
addAutoPipe(YourType,(data:YourType)=>{return newData})
```

## 🛜其他响应类型

```ts

/** 200 OK */
export const Ok = (data: any, headers: HttpHeaders = {}) =>
  new OkResponse(data, headers);

/** 201 Created */
export const Created = (data: any, headers: HttpHeaders = {}) =>
  new CreatedResponse(data, headers);

/** 204 No Content */
export const NoContent = () => new NoContentResponse();

/** 400 Bad Request */
export const BadRequest = (msg = "Bad Request") => new BadRequestResponse(msg);

/** 401 Unauthorized */
export const Unauthorized = (msg = "Unauthorized") =>
  new UnauthorizedResponse(msg);

/** 403 Forbidden */
export const Forbidden = (msg = "Forbidden") => new ForbiddenResponse(msg);

/** 404 Not Found */
export const NotFound = (msg = "Not Found") => new NotFoundResponse(msg);

/** 500 Internal Error */
export const InternalServerError = (msg = "Internal Server Error") =>
  new InternalServerErrorResponse(msg);

export const CustomResponse = (
  status: number,
  data: any,
  headers: HttpHeaders = {},
) => new CustomResponseResponse(status, data, headers);

/** 发送本地文件 (自动处理 Range/206) */
export const StreamFile = (path: string, options?: StreamFileOptions) =>
  new StreamFileResponse(path, options);
/**
 * 发送流响应
 */
export const Stream = (stream: Readable, options?: StreamResponse["options"]) =>
  new StreamResponse(stream, options);

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly message: string,
  ) {
    super(message);
  }
}
```

