# @virid/vue

`@virid/vue` is the UI adapter for `@virid/core`, responsible for delivering data processed by systems to Vue for display. In this architecture, Vue acts strictly as a **"Data Projection Layer"** and is not responsible for handling complex business logic. Its purpose is to establish a controlled, unidirectional communication tunnel between Vue's reactivity system and the `@virid/core` kernel.

## 🌟 Core Design Philosophy

In `@virid/vue`, Vue components no longer hold business state directly. Instead, they delegate all authority and functionality to a **Controller** via the `useController` hook. You will not—and should not—use most of Vue's built-in APIs, such as `ref`, `computed`, `watch`, `emit`, `provide`, or `inject`, state management tools like Pinia also should no longer be used.

- **Physically Isolated Modification Rights:** The Controller acts as the intermediary between Vue and Components. While Vue components can directly observe Component data, any operation that leads to a state change must be converted into a **Message** and sent to a **System** for processing.
- **Enforced Read-Only (Deep Shield):** In `@virid/vue`, "read-only" is more than just a suggestion. Through the **createDeepShield** mechanism, all data not owned by the current context is forced into a "Deep Read-Only" state. All write operations are prohibited, and even methods cannot be called unless explicitly marked with the `@Safe()` decorator. This physically eliminates the possibility of UI components accidentally polluting external states.
- **Full Vue Ecosystem Compatibility:** Controllers are pure classes. When combined with `@OnHook` and `@Use` decorators, they can perceive the Vue lifecycle and utilize any hooks from the Vue ecosystem without being tightly coupled to a specific DOM structure.

## 🔌Enable plugins

```ts
import { createVirid } from '@virid/core'
import { VuePlugin } from '@virid/vue'
const app = createVirid()
app.use(VuePlugin, {})
```

## 🛠️ @virid/vue Core API Overview

### 1. Vue Adapter Decorators

#### `@Responsive(shallow?: boolean)`

- **Function:** Marks a class property as reactive. This decorator is available for both `Controllers` and `Components`.
- **Logic:** `@virid/vue` transforms any class property marked with `@Responsive()` into a reactive state upon instantiation. A key advantage is that **you do not need to use `.value`** to access or modify the data.
- **Example:**

```ts
// Marking a property in a global Component as reactive.
// Functionally similar to a Pinia store, but with full Dependency Injection support.
@Component()
export class SettingComponent {
  @Responsive()
  public counter: number = 0;

  // Passing 'true' will wrap the property with a ShallowRef instead of a standard Ref.
  // @Responsive(true)
  // public counter: number = 0;
}

export class SettingSystem {
  /**
   * Updates settings when a specific message is dispatched.
   */
  @System({
    messageClass: ChangeCounterMessage
  })
  static LoadSetting(settings: SettingComponent) {
    // Note: No need for .value. Direct assignment works perfectly.
    settings.counter += 1;
  }
}

// Marking a property in a Vue UI Controller as reactive.
@Controller()
export class PageController {
  @Responsive()
  public currentPageIndex: number = 0;
}

// Inside a Vue component, use useController to retrieve the instance.
import { useController } from '@virid/vue';
import { PageController } from './controllers';

const pct = useController(PageController);

// Usage in template:
// <div>Current Page: {{ pct.currentPageIndex }}</div>
```

#### `@Project()`

- **Function:** The most powerful projection mechanism in `@virid/vue`. it allows you to pull data from any `Component` or derive new values from local `@Responsive()` properties while maintaining full reactivity.
- **Logic:** `@Project` is conceptually similar to Vue's `computed`, but far more powerful. The resulting data is **strictly read-only**, ensuring that the projection layer cannot accidentally modify the source of truth.
- **Example:**

```ts
@Controller()
export class PageController {
  // Define a local reactive property first
  @Responsive()
  public currentPageIndex: number = 0;

  // Usage 1: Using a 'get' accessor to remap local reactive data
  @Project()
  get nextPageIndex() {
    // nextPageIndex behaves like computed(() => this.currentPageIndex + 1)
    return this.currentPageIndex + 1;
  }
    
  // Usage 2: Using an arrow function to remap data
  // The first argument of the function is the Controller instance itself.
  // No initialization required; @virid/vue ensures previousPageIndex is available on the instance.
  @Project<PageController>(i => i.currentPageIndex - 1)
  public previousPageIndex!: number;
    
  // Usage 3: Pulling data directly from a global Component
  // Arg 1: The Component constructor type.
  // Arg 2: An arrow function receiving the Component instance.
  // If SettingComponent.counter is decorated with @Responsive(), 
  // then currentCounter will also be reactive.
  @Project(SettingComponent, i => i.counter)
  public currentCounter!: number;
}
```

------

#### `@Inherit()`

- **Function:** Enables data sharing across different Controllers, bypassing component hierarchy entirely. The **enforced read-only** nature ensures that one Controller can never modify the data owned by another.
- **Logic:** `@Inherit()` is used to share local, non-global variables between Controllers—ideal for data that needs to be shared but doesn't belong in a global `Component` (e.g., specific UI states).
- **Example:**

```ts
// --- In PageController.ts ---
@Controller()
export class PageController {
  @Responsive()
  public currentPageIndex: number = 0;
}

// --- In Page.vue ---
import { useController } from '@virid/vue';
import { PageController } from './controllers';
// Instantiate and assign a unique ID
const pct = useController(PageController, { id: "page-controller" });

// --- In OtherController.ts ---
@Controller()
export class OtherController {
  /**
   * Use @Inherit with three arguments:
   * 1. The target Controller constructor.
   * 2. The ID registered during useController.
   * 3. An arrow function to pick the data.
   * * Virid automatically creates 'myPageIndex' on this instance and keeps it reactive.
   * It is protected as read-only; OtherController cannot modify the source data.
   * If the PageController with this ID is destroyed, myPageIndex becomes null.
   */
  @Inherit(PageController, "page-controller", (i) => i.currentPageIndex)
  public myPageIndex!: number | null;
}
```

#### `@Watch()`

- **Function:** An enhanced version of Vue's `watch` utility. It can observe any `Component` or local properties marked with `@Responsive()`.
- **Logic:** Provides a mechanism for triggering side effects based on state changes.
- **Example:**

```ts
@Controller()
export class OtherController {
  @Inherit(PageController, "page-controller", (i) => i.currentPageIndex)
  public myPageIndex!: number | null;

  // Usage 1: Watch data derived from @Inherit(), @Project(), or @Responsive().
  @Watch<OtherController>(i => i.myPageIndex, { immediate: true })
  onPageIndexChange() {
    // Logic here...
  }

  // Usage 2: Watch data on a global Component directly, regardless of where it is used.
  // Both usage styles support Vue's standard WatchOptions as the final argument.
  @Watch(SettingComponent, i => i.counter, { deep: true })
  onCounterChange() {
    // Logic here...
  }
}
```

------

#### `@OnHook(lifecycle)`

- **Function:** Vue lifecycle bridging. It allows Vue to trigger your Controller's methods at the appropriate lifecycle stages.
- **Logic:** In addition to standard Vue lifecycles, it introduces a unique **`onSetup`** hook. Methods marked with `onSetup` are executed immediately after the Controller is instantiated and its data is prepared.
- **Example:**

```ts
@Controller()
export class OtherController {
  @OnHook("onMounted")
  public onMounted() {
    // Called after the Vue component is mounted
  }

  @OnHook("onSetup")
  public onSetup() {
    // Called immediately after Controller initialization, prior to onMounted
  }
}
```

------

#### `@Use()`

- **Function:** Provides seamless compatibility with any Hook in the Vue ecosystem, binding them directly to the Controller instance.
- **Logic:** The return value of the provided function is bound to the class property. You can interact with these external hooks as if they were native members of your class.
- **Example:**

```ts
@Controller()
export class OtherController {
  // Access vue-router state via 'this.route'
  @Use(() => useRoute())
  public route!: ReturnType<typeof useRoute>;

  // Bind a template reference
  @Use(() => useTemplateRef("html"))
  public htmlElement!: ReturnType<typeof useTemplateRef>;
}
```

------

#### `@Env()`

- **Function:** Captures data provided by a parent component via `defineProps` and binds it to the Controller.
- **Logic:** When calling `useController`, pass the `props` into the `context`. The Controller will then automatically synchronize with those values.
- **Example:**

```ts
// --- Inside your Vue Component ---
const props = defineProps<{
  pageIndex: number
  maxPageLength: number
  messageType: Newable<BaseMessage>
}>();

// Pass props to the context during creation
const sct = useController(ScrubberController, {
  context: props
});

// --- Inside ScrubberController.ts ---
@Controller()
export class ScrubberController {
  // These properties will automatically stay reactive!
  @Env()
  public pageIndex!: number;

  @Env()
  public maxPageLength!: number;

  @Env()
  public messageType!: Newable<BaseMessage>;
}
```

### 2. Controller Messaging

In `@virid/vue`, Controllers are not passive observers; they can actively listen for messages of interest and trigger internal callbacks.

#### `@Listener()`

- **Function:** The `@Listener()` decorator empowers a Controller to perceive environmental changes autonomously. It transitions the Controller from a passive receiver to an active listener.

- **Lifecycle:** Listeners are automatically tied to the Controller's lifecycle. They are registered upon instantiation and disposed of when the Controller is destroyed, requiring no manual cleanup.

- **Logic:** Provide the specific message type to the `messageClass` parameter within the `@Listener` decorator.

- **Example:**

```ts
  export class PageChangeMessage extends SingleMessage {
    constructor(public pageIndex: number) {
      super();
    }
  }
  
  @Controller()
  export class PlaylistPageController {
    @Responsive()
    public pageIndex: number = 0;
  
    /**
     * Use @Listener to capture specific messages.
     * Note: This only provides access to the message instance itself; 
     * it does not support Component injection.
     * Wherever PageChangeMessage.send(newPage) is called—regardless of 
     * component hierarchy—onPageChange will be triggered.
     */
    @Listener({
      messageClass: PageChangeMessage
    })
    public onPageChange(message: PageChangeMessage) {
      this.pageIndex = message.pageIndex;
    }
  }
```

------

## 🛡️ Physical Read-Only Shield (Deep Shield)

In `@virid/vue`, "prohibiting the modification of external data" is not a suggestion—it is an absolute law.

To ensure determinism, all external data retrieved via `@Project` or `@Inherit` is automatically wrapped in a **recursive physical shield**. This shield intercepts all **Write (Set)** operations and **Illegal Method Calls**, providing detailed error messages regarding the violation path and cause.

### 1. Interception Behavior

- **Assignment Interception:** Any attempt to modify an object property will immediately throw an exception.
- **Mutation Interception:** Calling any method that could modify the original data (e.g., `Array.push`, `Map.set`, `Set.add`) is strictly forbidden.
- **Deep Recursion:** The shield is applied recursively and cached lazily. No matter how deep the data nesting is, all descendant nodes are protected, and the protection is activated only upon access.

### 2. Safe Method Whitelist

To avoid breaking UI rendering logic, non-side-effect utility methods are permitted:

| **Category**       | **Allowed "Safe" Methods/Properties**                        |
| ------------------ | ------------------------------------------------------------ |
| **Base Protocols** | `Symbol.iterator`, `toString`, `valueOf`, `toJSON`, `constructor`, etc. |
| **Array**          | `length`, `map`, `filter`, `reduce`, `slice`, `find`, `includes`, `at`, `join`, `concat`, etc. |
| **Set / Map**      | `has`, `get`, `keys`, `values`, `entries`, `forEach`, `size`. |
| **String**         | `length`, `slice`, `includes`, `split`, `replace`, `trim`, `toUpperCase`, etc. |
