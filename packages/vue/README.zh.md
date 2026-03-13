#  @virid/vue

`@virid/vue` 是 ` @virid/core` 的UI 适配器，负责将`system`处理完成的数据交付给`Vue`显示。`Vue`在此过程中仅仅是是一个 **“数据投影层”**，不负责处理任何复杂的逻辑,其宗旨是在 `Vue` 的响应式系统与 `@virid/core`核心之间建立一条受控的、单向的通讯隧道。

## 🌟 核心设计理念

在 `@virid/vue` 中，`Vue` 组件不再直接持有业务状态，而是通过 `useController` 将**所有权限和功能**委托给一个 **Controller**。**你不会，也不应该**使用`Vue`提供的绝大部分API，例如`ref`,`computed`,`watch` `emit`，`privode`, `inject`等，也不应该再使用`Pinia`之类的状态管理工具。

- **物理隔离的修改权**：`Controller` 充当 `Vue` 与 `Component` 之间的中介。Vue 组件可以直接观察 `Component` 数据，但所有导致状态变更的操作必须转化为 `Message` 发送给 System 处理。
- **强制只读**：在`@virid/vue`中，只读不仅仅只是建议，过 `createDeepShield` 机制，**所有非自身所有**的数据，都被强制转化为 **“深度只读”** 禁止任何写操作，甚至连方法也无法任意调用，除非被@Safe装饰器标记。在物理层面杜绝了 UI 组件意外污染非自身的可能性。
- **Vue生态全适配**：`Controller` 本身是纯粹的类，配合 `@OnHook` 与`@Use`装饰器，它可以感知 `Vue` 的生命周期并使用所有`Vue`生态的钩子，但又不与特定的 DOM 结构绑定。

## 🔌启用插件

```ts
import { createVirid } from '@virid/core'
import { VuePlugin } from '@virid/vue'
const app = createVirid()
app.use(VuePlugin, {})
```

## 🛠️ @virid/vue 核心 API 概览

### 1. Vue适配装饰器

#### `@Responsive（shallow?: boolean）`

- **功能**：将类属性标记为响应式的，该装饰器在`Component`上也可用。
- **逻辑**：`@virid/vue`会在任何`Controller`或`Component`实例化时，将标记为`@Responsive()`的类属性变为响应式的。并且，**不需要使用.value来访问**。
- **示例：**

```ts
//将一个全局的Component中的属性标记为响应式的
//这在功能上类似于一个pinia store
//但是，你仍然可以使用依赖注入功能
@Component()
export class SettingComponent {
  @Responsive()
  public counter:number=0
  //传入true，virid/vue将会用ShadowRef来包装而不是使用Ref
  //@Responsive(true)
  //public counter:number=0
}

export class SettingSystem {
  /**
   * *消息发送时更新设置
   */
  @System({
    messageClass: ChangeCounterMessage
  })
  static LoadSetting(settings: SettingComponent) {
   //注意⚠️，不需要使用.value。直接赋值即可
   settings.counter +=1 
  }
}

```

```ts
//将一个vue组件的Controller中的属性标记为响应式的
@Controller()
export class PageController {
  @Responsive()
  public currentPageIndex:number=0
}

//在vue组件中，使用useContoller来获得控制器
import { useController } from '@virid/vue'
import { PageController } from './controllers'
const pct = useController(PageController)
//然后，你可以直接使用
<div>当前页面是：{{pct.currentPageIndex}}<div>
```

#### `@Project（）`

- **功能**：`@virid/vue`最强大的投影机制，可以从**任意**`component`中拉取数据或从自身被`@Responsive()`标记的属性中生成新数，且保留响应式。
- **逻辑**：`@Project`类似于`vue`中的`compouted`，但是远比`compouted`更为强大，其得到的数据是**强制只读**的，并且可以从任意`Component`中拉取数据
- **示例：**

```ts
@Controller()
export class PageController {
  //先确保自己有一个响应式数据
  @Responsive()
  public currentPageIndex:number=0
  //用法1：使用get来从自身的响应式数据中重新映射新数据并保持响应式
  @Project()
  get nextPageIndex(){
    // nextPageIndex就等于compouted(()=>this.currentPageIndex+1)
	return this.currentPageIndex + 1;
  }
    
  // 用法2：不使用get而是使用一个箭头函数来重新映射数据，函数接受的第一个参数是controller实例自身
  // 不需要初始化，@virid/vue将会保证previousPageIndex一定会出现在Controller实例上
  @Project<PageController>(i=>.currentPageIndex - 1)
  public previousPageIndex!:number;
    
  // 用法3：直接从某个component上拉取数据，并嫁接到自身'
  // 第一个参数是Component的构造函数类型，第二个参数是箭头函数，参数为前一个构造函数制定的Component类型的实例
  // 不需要初始化，@virid/vue将会保证currentCounter一定会出现在Controller实例上
  // 并且，如果SettingComponent中的counter是被 @Responsive()装饰的
  // 那么，currentCounter也会具有响应式
  @Project(SettingComponent, i=>.counter)
  public currentCounter!:number;
}
```

#### `@Inherit（）`

- **功能**：跨`controller`共享数据，**无视任何组件层级**，同时**强制只读**保证了其他`controller`永远无法更改另一个`controller`的数据。
- **逻辑**：`@Inherit（）`用于`Controller`之间共享一些局部的，非全局的的变量。用于处理那些需要共享但是不需要放在`Component`中存储的数据。
- **示例：**

```ts
//在文件PageController中
//将一个vue组件的Controller中的属性标记为响应式的
@Controller()
export class PageController {
  @Responsive()
  public currentPageIndex:number=0
}

//然后，使用useController来在.vue文件中实例化，并同时指定一个id
//在Page.vue中
import { useController } from '@virid/vue'
import { PageController } from './controllers'
const pct = useController(PageController,{id:"page-controller"})

```

```ts
//在另一个Controller中
@Controller()
export class OtherController {
  // 使用Inherit，并传入三个参数，分别为其他controller的构造函数、使用useController时候注册的id，一个箭头函数
  // virid将为你的Controller自动创建一个myPageIndex属性，并且，将保持响应式
  // 因此，你可以像使用自己的变量一样使用它
  // 并且，myPageIndex是只读保护的，OtherController内绝对无法更改其他Controller内的数据
  // 当对应id的PageController销毁之后，myPageIndex将自动断开连接变为null
  @Inherit(PageController,"page-controller",(i)=>i.currentPageIndex)
  public myPageIndex!: number|null
}
```

#### `@Watch（）`

- **功能**：提供vue中的watch功能的增强版，可以监听**任意**`component`或自身被`@Responsive()`标记的属性。
- **逻辑**：提供副作用触发机制。
- **示例：**

```ts
//在另一个Controller中
@Controller()
export class OtherController {
  @Inherit(PageController,"page-controller",(i)=>i.currentPageIndex)
  public myPageIndex!: number|null
  // 用法1：对于任何使用@Inherit()或者@Project()或@Responsive()得来的数据，你仍然可以使用Watch来监听
  @Watch<OtherController>(i=>i.myPageIndex,{immediate:true})
  onPageIndexChange(){
      //....
  }
  // 用法2：你可以直接监听component上的数据变化,不管component在任何地方
  // 二者都提供一个与vue的watch相同的配置参数对象在最后一个位置
  @Watch(SettingComponent,i=>i.counter,{deep:true})
  onCounterChange(){
      //....
  }
}
```

#### `@OnHook（“OnMounted”|"onUnounted"|"onUpdate"|"onActivated"|"onDeactivated"|"onSetup"）`

- **功能**：`Vue`生命周期桥接，让`Vue`在合适的生命周期调用你的`controller`函数。
- **逻辑**：除了`Vue`组件自身的生命周期，还提供了一个新的`onSetup`生命周期，被标记该生命周期的成员函数将会在`controller`创建时候调用。
- **示例：**

```ts
@Controller()
export class OtherController {
  @OnHook("onMounted")
  public onMounted(){
    //这个函数将会在组件挂载之后调用
  }
  @OnHook("onSetup")
  public onSetup(){
    //这个函数将会在Controller完成数据准备后立刻调用，先与onMounted
  }
}
```

#### `@Use（）`

- **功能**：无缝兼容所有的`Vue`生态中的`hook`，将其绑定到`controller`自己身上。
- **逻辑**：使用`@Use()`，其返回值将会直接绑定到对应的类属性上，因此你可以像操作自身成员一样操作所有`hook`的返回值
- **示例：**

```ts
@Controller()
export class OtherController {
  // 轻松获得vue-router中的route，然后你可以像操作自己的 route一样使用this.route来访问
  @Use(()=>useRoute())
  public route!:ReturnType<typeof useRoute>;
  // 获取html元素
  @Use(()=>useTemplateRef("html"))
  public htmlElement!:ReturnType<typeof useTemplateRef>;                        
}
```

#### `@Env（）`

- **功能**：接受父组件使用`defineProps`提供给自己的数据，并绑定到自己身上。
- **逻辑**：在使用`useController`的时，将`defineProps`的数据传给`context`，`controller`即可自动获得其上的数据
- **示例：**

```ts
// 定义一个props
const props = defineProps<{
  pageIndex: number
  maxPageLength: number
  messageType: Newable<BaseMessage>
}>()
//创建时将其传递给context
const sct = useController(ScrubberController, {
  context: props
})


//在你的controller上，直接使用这些数据！他们将会保持响应式
@Controller()
export class ScrubberController {
  @Env()
  public pageIndex!: number
  @Env()
  public maxPageLength!: number
  @Env()
  public messageType!: Newable<BaseMessage>
}
```

------

### 2. Conrtoller消息

`@virid/vue`中的`Controller`不是盲目的，也可以监听自己在意的消息并触发回调。

#### `@Listener()`

- **特性**：`@Listener()`使得`Controller`能够自主感知环境变化，使其从被动接受变为主动监听，且将会随着`controller`的生命周期被一同卸载，**无需手动卸载监听**。

- **逻辑**：对于**任何消息类型**，指定`@Listener`的`messageClass`参数即可

- **示例：**

 ```ts
export class PageChangeMessage extends SingleMessage {
  constructor(public pageIndex: number) {
    super()
  }
}

@Controller()
export class PlaylistPageController {
  // 当前的页面
  @Responsive()
  public pageIndex: number = 0
  // 使用@Listener来收听自己在意的消息。注意，只能获得消息本身，无法注入component
  // 在任何地方，不管是子组件还是父组件还是兄弟组件，只要有人发出了PageChangeMessage.send(newPage)
  // onPageChange就会被自动调用
  @Listener({
    messageClass: PageChangeMessage
  })
  public onPageChange(message: PageChangeMessage) {
    this.pageIndex = message.pageIndex
  }
}
 ```

## 🛡️ 物理级只读护盾 (Deep Shield)

在 `@virid/vue` 中，**“禁止修改父组件数据”不是一种建议，而是一种铁律。**

为了确保确定性，所有通过 `@Project` 或 `@Inherit` 获取的外部数据，都会被自动套上一层递归的物理护盾。 该护盾会拦截所有的 **写操作 (Set)** 以及 **非法方法调用**并**详细指出原因及其访问的路径**。

### 1. 拦截行为

- **赋值拦截**：尝试修改对象的属性将直接触发异常。
- **变异方法拦截**：禁止调用任何可能修改原数据的函数（如 `Array.push`, `Map.set`, `Set.add`）。
- **深度递归**：护盾是递归生效的且惰性缓存的，无论数据嵌套多深，其后代节点均受保护，且只有访问时才生效。

### 2. 安全方法白名单

为了不影响 UI 层的渲染逻辑，放行了所有**无副作用**的工具方法：

| **分类**      | **允许调用的安全方法**                                       |
| ------------- | ------------------------------------------------------------ |
| **基础协议**  | `Symbol.iterator`, `toString`, `valueOf`, `toJSON`, `constructor` 等。 |
| **Array**     | `length`, `map`, `filter`, `reduce`, `slice`, `find`, `includes`, `at`, `join`, `concat` 等。 |
| **Set / Map** | `has`, `get`, `keys`, `values`, `entries`, `forEach`, `size`。 |
| **String**    | `length`, `slice`, `includes`, `split`, `replace`, `trim`, `toUpperCase` 等。 |



