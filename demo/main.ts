/**
 * ============================================
 * SSR + Hydrate 演示 - 组件与状态定义（现代暗色主题）
 * ============================================
 * 此文件定义所有 demo 组件、状态管理器和事件总线
 * 不包含任何浏览器端渲染或水合逻辑
 *
 * 文件职责划分：
 *   - main.ts: 组件定义 + 状态 + 事件总线（本文件）
 *   - entry-server.ts: 服务端渲染入口（Node.js 环境执行）
 *   - entry-client.ts: 客户端水合入口（浏览器环境执行）
 *   - server.mjs: Express 服务器（真正的 SSR）
 *
 * UI 设计参考：root index.html 暗色主题（#1a1a2e + #00b4d8）
 * 图标系统：icons.ts 中的 SVG 组件，无 Unicode emoji
 *
 * 组件覆盖清单（核心 SSR + 水合测试）
 * 1.  CounterDisplay   - 纯展示组件 + ref 获取子组件 DOM
 * 2.  CounterPanel     - onClick + Context + 生命周期 + useState 手动 DOM 更新
 * 3.  UserInfo         - useContext 多 Context 消费
 * 4.  ThemeSwitcher    - lifecycle.emit + 状态管理
 * 5.  TaskList         - each() 列表渲染
 * 6.  ConditionalSection - when() 条件渲染
 * 7.  ChildWithExpose  - ref + expose API
 * 8.  NestedLevel3/2/Container - 3 层嵌套 Context 透传
 * 9.  SearchBox        - 表单输入（onInput/onFocus/onBlur/onKeyDown）
 * 10. TodoApp          - CRUD 完整操作
 * 11. EventLog         - ref 回调 + 事件总线
 * 12. HydrationPanel   - 客户端水合检测面板（SSR 占位，水合后填充）
 * 13. PlayerSection    - VideoPlayer SSR 原生渲染 + 水合（非占位，直接输出播放器 HTML）
 * 14. App              - 根组件
 * 15. RootLayout       - 根布局（注入 Context）
 */

import {
  h,
  defineComponent,
  Fragment,
  when,
  each,
  useTemplateRef,
  createContext,
  useContext,
  provide,
  createTypedStateManager,
  createTypedEventBus,
  useState,
} from "@/core";
import { VideoPlayer } from "@/hili-player/player";

// SVG 图标组件（替代 Unicode emoji）
import {
  IconCheck,
  IconX,
  IconSquare,
  IconSun,
  IconMoon,
  IconLock,
  IconUser,
  IconHome,
  IconSettings,
  IconPlus,
  IconMinus,
  IconRefresh,
  IconTrash,
  IconSearch,
  IconTerminal,
  IconZap,
  IconServer,
  IconVideo,
} from "./icons";

// ============================================
// 类型定义
// ============================================

interface AppStateMap {
  "app.count": number;
  "app.theme": string;
  "app.lastAction": string;
  "app.searchQuery": string;
  "app.activeTab": string;
}

interface AppEventMap {
  COUNT_INCREMENT: { count: number };
  COUNT_DECREMENT: { count: number };
  THEME_CHANGE: { theme: string };
  ACTION_LOG: { action: string; timestamp: number };
  SEARCH_INPUT: { query: string };
  TAB_CHANGE: { tab: string };
  HYDRATION_CHECK: { id: string; pass: boolean; detail?: string };
}

interface ThemeContextValue {
  primaryColor: string;
  bgColor: string;
  textColor: string;
  fontSize: string;
}

interface UserContextValue {
  username: string;
  role: string;
  loggedIn: boolean;
}

interface NestLevelContextValue {
  level: number;
  label: string;
}

// ============================================
// Context 创建
// ============================================

const ThemeContext = createContext<ThemeContextValue>({
  primaryColor: "#00b4d8",
  bgColor: "#1a1a2e",
  textColor: "#e0e0e0",
  fontSize: "14px",
});

const UserContext = createContext<UserContextValue>({
  username: "Guest",
  role: "visitor",
  loggedIn: true,
});

const NestLevelContext = createContext<NestLevelContextValue>({
  level: 0,
  label: "根层",
});

// ============================================
// 事件总线和状态管理器
// ============================================

export const appEventBus = createTypedEventBus<AppEventMap>();

export const appState = createTypedStateManager<AppStateMap>({
  app: {
    count: 0,
    theme: "dark",
    lastAction: "init",
    searchQuery: "",
    activeTab: "home",
  },
});

// ============================================
// 主题配置（暗色优先）
// ============================================

const darkTheme: ThemeContextValue = {
  primaryColor: "#00b4d8",
  bgColor: "#1a1a2e",
  textColor: "#e0e0e0",
  fontSize: "14px",
};

const userInfoValue: UserContextValue = {
  username: "HiliDev",
  role: "admin",
  loggedIn: true,
};

// ============================================
// 共用样式工具
// ============================================
// 所有样式已提取到 demo/styles.css
// 组件通过 class 属性引用 CSS 类名

// ============================================
// 子组件1：计数器显示（纯展示组件）
// ============================================

interface CounterDisplayProps {
  count: number;
}

const CounterDisplay = defineComponent<CounterDisplayProps>(
  (props, lifecycle) => {
    const counterRef = useTemplateRef<HTMLSpanElement>(lifecycle, 'counterRef');

    lifecycle.onBeforeMount = () => {
      appEventBus.emit("ACTION_LOG", {
        action: "CounterDisplay: onBeforeMount",
        timestamp: Date.now(),
      });
    };

    lifecycle.onMounted = () => {
      appEventBus.emit("ACTION_LOG", {
        action: "CounterDisplay: onMounted",
        timestamp: Date.now(),
      });
      appEventBus.emit("HYDRATION_CHECK", {
        id: "CounterDisplay:ref",
        pass: !!counterRef.value,
        detail: "ref.current 应指向 span.counter-value",
      });
      lifecycle.expose?.(counterRef.value);
    };

    return h(
      "span",
      {
        class: "counter-value",
        ref: 'counterRef',
      },
      String(props.count),
    );
  },
);

// ============================================
// 子组件2：计数器面板
// ============================================

interface CounterPanelEvents {
  increment: undefined;
  decrement: undefined;
  reset: undefined;
}

const CounterPanel = defineComponent<
  Record<string, unknown>,
  CounterPanelEvents
>((_props, lifecycle) => {
  const counterRef = useTemplateRef<HTMLElement>(lifecycle, 'counterRef');

  lifecycle.onBeforeMount = () => {
    appEventBus.emit("ACTION_LOG", {
      action: "CounterPanel: onBeforeMount",
      timestamp: Date.now(),
    });
  };

  lifecycle.onMounted = () => {
    appEventBus.emit("ACTION_LOG", {
      action: "CounterPanel: onMounted",
      timestamp: Date.now(),
    });
    appEventBus.emit("HYDRATION_CHECK", {
      id: "CounterPanel:lifecycle.onMounted",
      pass: true,
    });
    appEventBus.emit("HYDRATION_CHECK", {
      id: "CounterPanel:ref(子组件DOM)",
      pass: !!counterRef.value,
    });

    useState(
      appState,
      "app.count",
      (newVal: number) => {
        if (counterRef.value) {
          counterRef.value.textContent = String(newVal);
        }
      },
      lifecycle,
    );
  };

  const handleIncrement = () => {
    const newCount = (appState.get("app.count") ?? 0) + 1;
    appState.set("app.count", newCount);
    appState.set("app.lastAction", "increment");
    appEventBus.emit("COUNT_INCREMENT", { count: newCount });
    lifecycle.emit?.("increment");
  };

  const handleDecrement = () => {
    const newCount = (appState.get("app.count") ?? 0) - 1;
    appState.set("app.count", newCount);
    appState.set("app.lastAction", "decrement");
    appEventBus.emit("COUNT_DECREMENT", { count: newCount });
    lifecycle.emit?.("decrement");
  };

  const handleReset = () => {
    appState.set("app.count", 0);
    appState.set("app.lastAction", "reset");
    lifecycle.emit?.("reset");
  };

  const count = appState.get("app.count") ?? 0;

  return h(
    "div",
    { class: "panel counter-panel" },
    h("div", { class: "panel-title" }, h(IconTerminal, { size: 16 }), "计数器（onClick + useState）"),
    h(
      "div",
      {
        class: "counter-controls",
      },
      h(
        "button",
        {
          onClick: handleDecrement,
          class: "btn-danger",
          "aria-label": "减少",
        },
        h(IconMinus, { size: 14 }),
        "减少",
      ),
      h(CounterDisplay, { count, ref: 'counterRef' }),
      h(
        "button",
        {
          onClick: handleIncrement,
          class: "btn-success",
          "aria-label": "增加",
        },
        h(IconPlus, { size: 14 }),
        "增加",
      ),
      h(
        "button",
        {
          onClick: handleReset,
          class: "btn-warning",
          "aria-label": "重置",
        },
        h(IconRefresh, { size: 14 }),
        "重置",
      ),
    ),
  );
});

// ============================================
// 子组件3：用户信息（多 Context 消费）
// ============================================

const UserInfo = defineComponent(() => {
  const user = useContext(UserContext);

  return h(
    "div",
    { class: "panel user-info" },
    h("div", { class: "panel-title" }, h(IconUser, { size: 16 }), "用户信息（useContext）"),
    h(
      "div",
      {
        class: "user-info-row",
      },
      h(
        "div",
        { class: "user-info-item" },
        h(IconUser, { size: 14, color: "var(--text-secondary)" }),
        h("span", { class: "user-info-label" }, "用户:"),
        h("span", { class: "user-info-value" }, user.username),
      ),
      h(
        "div",
        { class: "user-info-item" },
        h(IconLock, { size: 14, color: "var(--text-secondary)" }),
        h("span", { class: "user-info-label" }, "角色:"),
        h(
          "span",
          {
            class: "user-role-badge",
          },
          user.role,
        ),
      ),
      h(
        "div",
        { class: "user-info-item" },
        user.loggedIn
          ? h(IconCheck, { size: 14, color: "#4ade80" })
          : h(IconX, { size: 14, color: "#f87171" }),
        h(
          "span",
          {
            class: user.loggedIn ? "user-status-online" : "user-status-offline",
          },
          user.loggedIn ? "已登录" : "未登录",
        ),
      ),
    ),
  );
});

// ============================================
// 子组件4：主题切换
// ============================================

interface ThemeSwitcherEvents {
  themeChange: { theme: string };
}

const ThemeSwitcher = defineComponent<
  Record<string, unknown>,
  ThemeSwitcherEvents
>((_props, lifecycle) => {
  const themeBtnRef = useTemplateRef<HTMLElement>(lifecycle, 'themeBtnRef');
  const themeIconRef = useTemplateRef<HTMLElement>(lifecycle, 'themeIconRef');
  const themeLabelRef = useTemplateRef<HTMLElement>(lifecycle, 'themeLabelRef');

  lifecycle.onMounted = () => {
    appEventBus.emit("ACTION_LOG", {
      action: "ThemeSwitcher: onMounted",
      timestamp: Date.now(),
    });

    useState(
      appState,
      "app.theme",
      (newTheme: string) => {
        const isDark = newTheme === "dark";
        if (themeLabelRef.value) {
          themeLabelRef.value.textContent = isDark ? "切换到亮色" : "切换到暗色";
        }
        // 通过 data 属性标记当前主题图标，初次的图标由 SSR 渲染决定
        if (themeIconRef.value) {
          themeIconRef.value.setAttribute(
            "data-theme-icon",
            isDark ? "moon" : "sun",
          );
        }
        if (themeBtnRef.value) {
          themeBtnRef.value.style.background = isDark
            ? "rgba(255,255,255,0.06)"
            : "rgba(255,255,255,0.18)";
        }
      },
      lifecycle,
    );
  };

  const handleToggle = () => {
    const currentTheme = appState.get("app.theme") ?? "dark";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    appState.set("app.theme", newTheme);
    appState.set("app.lastAction", "theme-toggle");
    appEventBus.emit("THEME_CHANGE", { theme: newTheme });
    lifecycle.emit?.("themeChange", { theme: newTheme });
  };

  const isDark = (appState.get("app.theme") ?? "dark") === "dark";

  return h(
    "div",
    { class: "panel theme-switcher" },
    h("div", { class: "panel-title" }, h(IconSettings, { size: 16 }), "主题切换（lifecycle.emit）"),
    h(
      "div",
      { class: "theme-switcher-row" },
      h(
        "button",
        {
          ref: 'themeBtnRef',
          onClick: handleToggle,
          class: "btn",
          "aria-label": "切换主题",
        },
        h(
          "span",
          { ref: 'themeIconRef', class: "theme-icon-wrap" },
          isDark ? h(IconMoon, { size: 14 }) : h(IconSun, { size: 14 }),
        ),
        h("span", { ref: 'themeLabelRef' }, isDark ? "切换到亮色" : "切换到暗色"),
      ),
    ),
  );
});

// ============================================
// 子组件5：列表渲染
// ============================================

interface TaskListProps {
  tasks: Array<{ id: number; text: string; done: boolean }>;
}

const TaskList = defineComponent<TaskListProps>((props) => {
  return h(
    "div",
    { class: "panel task-list" },
    h("div", { class: "panel-title" }, h(IconCheck, { size: 16 }), "列表渲染（each）"),
    h(
      "ul",
      {
        class: "task-list-ul",
      },
      ...each(
        props.tasks,
        (task) =>
          h(
            "li",
            {
              key: String(task.id),
              class: "task-item",
            },
            task.done
              ? h(IconCheck, { size: 14, color: "#4ade80" })
              : h(IconSquare, { size: 14, color: "var(--text-secondary)" }),
            h(
              "span",
              task.done ? { class: "task-text-done" } : {},
              task.text,
            ),
          ),
      ),
    ),
  );
});

// ============================================
// 子组件6：条件渲染
// ============================================

interface ConditionalSectionProps {
  showAdmin: boolean;
}

const ConditionalSection = defineComponent<ConditionalSectionProps>(
  (props) => {
    return h(
      "div",
      { class: "panel conditional-section" },
      h("div", { class: "panel-title" }, h(IconZap, { size: 16 }), "条件渲染（when）"),
      when(
        props.showAdmin,
        h(
          "div",
          {
            class: "admin-panel",
          },
          h(IconLock, { size: 14 }),
          "管理员面板（showAdmin=true 时显示）",
        ),
      ),
      when(
        !props.showAdmin,
        h(
          "div",
          {
            class: "guest-panel",
          },
          h(IconUser, { size: 14 }),
          "访客面板（showAdmin=false 时显示）",
        ),
      ),
    );
  },
);

// ============================================
// 子组件7：ref + expose API
// ============================================

interface ChildWithExposeProps {
  initialValue?: string;
}

interface ChildWithExposeEvents {
  valueChange: { value: string };
}

const ChildWithExpose = defineComponent<
  ChildWithExposeProps,
  ChildWithExposeEvents
>((props, lifecycle) => {
  const inputRef = useTemplateRef<HTMLInputElement>(lifecycle, 'inputRef');
  let value = props.initialValue ?? "";

  lifecycle.onMounted = () => {
    appEventBus.emit("HYDRATION_CHECK", {
      id: "ChildWithExpose:ref(input)",
      pass: !!inputRef.value,
    });

    // expose API：父组件可以通过 ref.current 调用子组件方法
    lifecycle.expose?.({
      getValue: () => value,
      setValue: (v: string) => {
        value = v;
        if (inputRef.value) inputRef.value.value = v;
      },
      focus: () => inputRef.value?.focus(),
    });
  };

  const handleInput = (e: Event) => {
    value = (e.target as HTMLInputElement).value;
    lifecycle.emit?.("valueChange", { value });
  };

  return h(
    "div",
    {
      class: "input-row",
    },
    h("input", {
      ref: 'inputRef',
      type: "text",
      value: props.initialValue ?? "",
      onInput: handleInput,
      placeholder: "输入值，父组件通过 expose 读取",
      class: "input-field",
    }),
  );
});

// ============================================
// 子组件8：事件日志（ref 回调 + 事件总线）
// ============================================

const EventLog = defineComponent((_props, _lifecycle) => {
  return h(
    "div",
    { class: "panel event-log" },
    h(
      "div",
      { class: "panel-title-between" },
      h(
        "div",
        { class: "log-header-row" },
        h(IconTerminal, { size: 16 }),
        "事件日志（事件总线）",
      ),
      h(
        "span",
        {
          class: "log-count",
        },
        "0 条",
      ),
    ),
    h("div", {
      class: "log-content",
    }),
  );
});

// ============================================
// 子组件9-11：3 层嵌套（Context 透传）
// ============================================

const NestedLevel3 = defineComponent(() => {
  const nestLevel = useContext(NestLevelContext);

  return h(
    "div",
    {
      class: "nested-level-3",
    },
    h(IconServer, { size: 12, color: "var(--accent)" }),
    h("span", {}, "第 " + nestLevel.level + " 层: " + nestLevel.label),
    h(
      "span",
      { class: "nested-level-hint" },
      "（Context 从第 1 层透传到第 3 层）",
    ),
  );
});

const NestedLevel2 = defineComponent(() => {
  return h(
    "div",
    {
      class: "nested-level-2",
    },
    h(
      "span",
      {
        class: "nested-level-label",
      },
      "第 2 层（中间层，不消费 NestLevelContext）",
    ),
    h(NestedLevel3, {}),
  );
});

const NestedContainer = defineComponent(() => {
  return h(
    "div",
    { class: "panel nested-container" },
    h("div", { class: "panel-title" }, h(IconServer, { size: 16 }), "3 层嵌套（Context 透传）"),
    h(
      "div",
      {
        class: "nested-inner",
      },
      h(
        "span",
        {
          class: "nested-level-label",
        },
        "第 1 层（provide NestLevelContext）",
      ),
      // provide 在 NestedContainer 中注入，NestedLevel3 通过 useContext 消费
      provide(
        [{ contextId: NestLevelContext.id, value: { level: 3, label: "深层节点" } }],
        () => h(NestedLevel2, {}),
      ),
    ),
  );
});

// ============================================
// 子组件12：搜索框（表单输入）
// ============================================

interface SearchBoxEvents {
  search: { query: string };
}

const SearchBox = defineComponent<Record<string, unknown>, SearchBoxEvents>(
  (_props, lifecycle) => {
    const inputRef = useTemplateRef<HTMLInputElement>(lifecycle, 'inputRef');
    const hintRef = useTemplateRef<HTMLSpanElement>(lifecycle, 'hintRef');

    lifecycle.onMounted = () => {
      appEventBus.emit("HYDRATION_CHECK", {
        id: "SearchBox:ref(input)",
        pass: !!inputRef.value,
      });

      useState(
        appState,
        "app.searchQuery",
        (query: string) => {
          if (hintRef.value) {
            hintRef.value.textContent = query
              ? "当前查询: " + query
              : "等待输入...";
          }
        },
        lifecycle,
      );
    };

    const handleInput = (e: Event) => {
      const value = (e.target as HTMLInputElement).value;
      appState.set("app.searchQuery", value);
      appEventBus.emit("SEARCH_INPUT", { query: value });
      lifecycle.emit?.("search", { query: value });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        appEventBus.emit("ACTION_LOG", {
          action: "SearchBox: Enter 按下",
          timestamp: Date.now(),
        });
      }
    };

    return h(
      "div",
      { class: "panel search-box" },
      h("div", { class: "panel-title" }, h(IconSearch, { size: 16 }), "表单输入（onInput + onKeyDown）"),
      h(
        "div",
        { class: "search-row" },
        h(
          "div",
          {
            class: "search-container",
          },
          h("span", {
            class: "search-icon",
          }, h(IconSearch, { size: 14 })),
          h("input", {
            ref: 'inputRef',
            type: "text",
            placeholder: "输入内容，回车确认...",
            onInput: handleInput,
            onKeyDown: handleKeyDown,
            class: "search-input",
          }),
        ),
        h(
          "span",
          {
            ref: 'hintRef',
            class: "search-hint",
          },
          "等待输入...",
        ),
      ),
    );
  },
);

// ============================================
// 子组件13：TodoApp（CRUD 完整操作）
// ============================================

interface TodoItem {
  id: number;
  text: string;
  done: boolean;
}

interface TodoAppEvents {
  add: { text: string };
  toggle: { id: number };
  delete: { id: number };
}

const TodoApp = defineComponent<Record<string, unknown>, TodoAppEvents>(
  (_props, lifecycle) => {
    const inputRef = useTemplateRef<HTMLInputElement>(lifecycle, 'inputRef');
    const listRef = useTemplateRef<HTMLUListElement>(lifecycle, 'listRef');
    let nextId = 1;
    let todos: TodoItem[] = [
      { id: 0, text: "学习 h() 函数", done: true },
    ];

    const renderList = () => {
      if (!listRef.value) return;
      // 简化：直接通过事件日志反馈，DOM 操作由用户点击触发
    };

    lifecycle.onMounted = () => {
      appEventBus.emit("HYDRATION_CHECK", {
        id: "TodoApp:ref(input+list)",
        pass: !!inputRef.value && !!listRef.value,
      });
      renderList();
    };

    const handleAdd = () => {
      if (!inputRef.value || !inputRef.value.value.trim()) return;
      const text = inputRef.value.value.trim();
      todos = [...todos, { id: nextId++, text, done: false }];
      inputRef.value.value = "";
      appEventBus.emit("ACTION_LOG", {
        action: "TodoApp: 添加 - " + text,
        timestamp: Date.now(),
      });
      lifecycle.emit?.("add", { text });
      // 重新渲染列表
      appendTodoItem(text);
    };

    const appendTodoItem = (text: string) => {
      if (!listRef.value) return;
      const li = document.createElement("li");
      li.className = "todo-item";
      li.textContent = text;
      listRef.value.appendChild(li);
    };

    const handleInputKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleAdd();
    };

    return h(
      "div",
      { class: "panel todo-app" },
      h("div", { class: "panel-title" }, h(IconCheck, { size: 16 }), "Todo App（CRUD 完整操作）"),
      h(
        "div",
        { class: "todo-add-row" },
        h("input", {
          ref: 'inputRef',
          type: "text",
          placeholder: "输入待办事项，回车添加...",
          onKeyDown: handleInputKeyDown,
          class: "todo-input",
        }),
        h(
          "button",
          { onClick: handleAdd, class: "btn-accent" },
          h(IconPlus, { size: 14 }),
          "添加",
        ),
      ),
      h(
        "ul",
        {
          ref: 'listRef',
          class: "todo-list",
        },
        ...each(todos, (todo) =>
          h(
            "li",
            {
              key: String(todo.id),
              class: "todo-item",
            },
            todo.done
              ? h(IconCheck, { size: 14, color: "#4ade80" })
              : h(IconSquare, { size: 14, color: "var(--text-secondary)" }),
            h(
              "span",
              {
                class: todo.done ? "todo-text-done" : "todo-text",
              },
              todo.text,
            ),
            h(
              "button",
              {
                onClick: () => {
                  todos = todos.filter((t) => t.id !== todo.id);
                  lifecycle.emit?.("delete", { id: todo.id });
                  appEventBus.emit("ACTION_LOG", {
                    action: "TodoApp: 删除 - " + todo.text,
                    timestamp: Date.now(),
                  });
                },
                class: "todo-delete-btn",
                "aria-label": "删除",
              },
              h(IconTrash, { size: 14 }),
            ),
          ),
        ),
      ),
    );
  },
);

// ============================================
// 子组件14：Fragment 演示
// ============================================

const FragmentDemo = defineComponent(() => {
  return h(
    "div",
    { class: "panel fragment-demo" },
    h("div", { class: "panel-title" }, h(IconZap, { size: 16 }), "Fragment 演示"),
    h(
      Fragment,
      {},
      h(
        "span",
        {
          class: "fragment-item-1",
        },
        "Fragment 子项 1",
      ),
      h(
        "span",
        {
          class: "fragment-item-2",
        },
        "Fragment 子项 2",
      ),
      h(
        "span",
        {
          class: "fragment-item-3",
        },
        "Fragment 子项 3",
      ),
    ),
  );
});

// ============================================
// 子组件15：Tabs（标签页切换）
// ============================================

const Tabs = defineComponent((_props, lifecycle) => {
  const contentRef = useTemplateRef<HTMLDivElement>(lifecycle, 'contentRef');

  lifecycle.onMounted = () => {
    appEventBus.emit("HYDRATION_CHECK", {
      id: "Tabs:ref(content)",
      pass: !!contentRef.value,
    });
  };

  const tabs = [
    { id: "home", label: "首页", icon: IconHome },
    { id: "profile", label: "个人", icon: IconUser },
    { id: "settings", label: "设置", icon: IconSettings },
  ];

  const contents: Record<string, () => ReturnType<typeof h>> = {
    home: () =>
      h(
        "div",
        { class: "tab-content" },
        h(IconHome, { size: 14, color: "var(--accent)" }),
        " 首页内容：欢迎来到 Hili Framework",
      ),
    profile: () =>
      h(
        "div",
        { class: "tab-content" },
        h(IconUser, { size: 14, color: "var(--accent)" }),
        " 个人信息：HiliDev - 前端开发者",
      ),
    settings: () =>
      h(
        "div",
        { class: "tab-content" },
        h(IconSettings, { size: 14, color: "var(--accent)" }),
        " 设置：主题切换、语言选择等",
      ),
  };

  const handleClick = (tabId: string) => {
    appState.set("app.activeTab", tabId);
    appEventBus.emit("TAB_CHANGE", { tab: tabId });
    // 通过 ref 手动更新内容
    if (contentRef.value) {
      contentRef.value.innerHTML = "";
      // 简化：直接通过 textContent 显示
      const text: string = {
        home: "首页内容：欢迎来到 Hili Framework",
        profile: "个人信息：HiliDev - 前端开发者",
        settings: "设置：主题切换、语言选择等",
      }[tabId] ?? "";
      contentRef.value.textContent = text;
    }
  };

  const activeTab = appState.get("app.activeTab") ?? "home";

  return h(
    "div",
    { class: "panel tabs" },
    h("div", { class: "panel-title" }, h(IconSettings, { size: 16 }), "标签页（onClick + 条件渲染）"),
    h(
      "div",
      {
        class: "tabs-container",
      },
      ...tabs.map((tab) =>
        h(
          "button",
          {
            key: tab.id,
            onClick: () => handleClick(tab.id),
            class: activeTab === tab.id ? "tab-btn-active" : "tab-btn",
          },
          h(tab.icon, { size: 14 }),
          tab.label,
        ),
      ),
    ),
    h(
      "div",
      {
        ref: 'contentRef',
        class: "tab-content",
      },
      contents[activeTab]?.() ?? contents.home(),
    ),
  );
});

// ============================================
// 子组件16：水合检测面板（SSR 占位，水合后填充）
// ============================================

const HydrationPanel = defineComponent((_props, _lifecycle) => {
  return h(
    "div",
    {
      class: "panel hydration-panel",
    },
    h(
      "div",
      { class: "panel-title-between" },
      h(
        "div",
        { class: "log-header-row" },
        h(IconZap, { size: 16 }),
        "水合检测面板",
      ),
      h(
        "span",
        {
          class: "hydration-summary",
        },
        "等待水合...",
      ),
    ),
    h(
      "div",
      {
        class: "hydration-info",
      },
      h(
        "span",
        {},
        "SSR 渲染耗时: ",
        h(
          "span",
          { class: "hydration-time" },
          "—",
        ),
      ),
    ),
    h("div", {
      class: "hydration-list",
    }),
  );
});

// ============================================
// 子组件17：PlayerSection（VideoPlayer SSR 原生集成）
// ============================================

/**
 * VideoPlayer 实例持有者
 * - SSR 阶段：createSSRPlayer 创建实例，render() 返回 VNode 用于 renderToString
 * - 客户端水合后：同一实例的 onMounted 回调自动绑定事件到已有 DOM
 * - entry-client.ts 通过此变量访问播放器实例（切换源、销毁等）
 */
export let playerInstance: VideoPlayer | null = null;

/**
 * 更新播放器实例引用（供 entry-client.ts 切换源时调用）
 */
export function setPlayerInstance(p: VideoPlayer | null): void {
  playerInstance = p;
}

/**
 * VideoPlayer SSR 原生集成组件
 *
 * 工作原理：
 * 1. 创建 VideoPlayer 实例（构造函数 SSR 安全，不访问 DOM）
 * 2. 调用 player.render() 获取 VNode（包含完整播放器 UI 结构）
 * 3. SSR 阶段：renderToString 将 VNode 序列化为 HTML，播放器 UI 直接在首屏
 * 4. 客户端水合：hydrate() 调用 PlayerDocker 的 onMounted，自动绑定事件到已有 DOM
 *
 * 优势：
 * - 首屏即包含完整播放器 HTML（非空占位）
 * - 水合后立即可交互，无需二次挂载
 * - 与框架的 SSR/Hydrate 流程完全一致
 */
const PlayerSection = defineComponent(() => {

  return h(
    "div",
    { class: "panel player-section" },
    h("div", { class: "panel-title" }, h(IconVideo, { size: 16 }), "VideoPlayer SSR 原生渲染 + 水合"),
    /**
     * 播放器容器
     * 直接嵌入 player.render() 返回的 VNode
     * SSR 阶段输出完整播放器 HTML，水合阶段绑定事件
     */
    h(
      "div",
      {
        id: "player-wrapper",
        class: "player-wrapper",
      },
      h("div", { class: "player-empty" }, "请先添加视频来源"),
    ),
    h(
      "div",
      {
        class: "player-controls",
      },
      h(
        "button",
        {
          id: "btn-destroy-player",
          class: "btn-danger",
        },
        h(IconTrash, { size: 14 }),
        "销毁播放器",
      ),
    ),
    h(
      "section",
      {
        class: "source-card",
      },
      h("h3", { class: "source-card-title" }, "添加来源"),
      h(
        "div",
        {
          class: "source-row",
        },
        h("input", {
          id: "input-source-url",
          class: "source-input",
          placeholder: "粘贴 mpd / m3u8 链接，或 DASH/HLS JSON",
        }),
        h(
          "button",
          {
            id: "btn-add-source",
            class: "btn-accent source-btn",
          },
          "添加链接",
        ),
      ),
      h(
        "div",
        {
          class: "source-row",
        },
        h(
          "label",
          {
            class: "source-file",
          },
          h("span", { class: "source-file-label" }, "本地视频"),
          h("input", {
            id: "input-local-file",
            class: "source-file-input",
            type: "file",
            accept: "video/*",
          }),
        ),
        h(
          "label",
          {
            class: "source-file",
          },
          h("span", { class: "source-file-label" }, "JSON 清单"),
          h("input", {
            id: "input-json-file",
            class: "source-file-input",
            type: "file",
            accept: ".json,application/json",
          }),
        ),
      ),
    ),
    h(
      "section",
      {
        class: "source-card",
      },
      h("h3", { class: "source-card-title" }, "来源列表"),
      h("ul", { id: "source-list", class: "source-list" }),
    ),
    h(
      "p",
      {
        class: "player-description",
      },
      "SSR 阶段直接渲染播放器完整 HTML（video 标签 + 控制栏 + 弹幕层），水合时自动绑定事件。点击「切换视频源」在客户端重新创建播放器实例。",
    ),
  );
});

// ============================================
// 根应用组件
// ============================================

const App = defineComponent((_props, lifecycle) => {
  const user = useContext(UserContext);

  const tasks = [
    { id: 1, text: "学习 h() 函数", done: true },
    { id: 2, text: "理解 defineComponent", done: true },
    { id: 3, text: "掌握 Context 上下文", done: true },
    { id: 4, text: "实现 SSR 渲染", done: false },
    { id: 5, text: "完成 Hydrate 水合", done: false },
  ];

  const appRootRef = useTemplateRef<HTMLElement>(lifecycle, 'appRootRef');

  /**
   * 生成主题 CSS 自定义属性
   * 默认暗色主题（#1a1a2e + #00b4d8）
   */
  const getThemeVars = (isDark: boolean): Record<string, string> => ({
    "--accent": isDark ? "#00b4d8" : "#1976D2",
    "--accent-hover": isDark ? "#0096b7" : "#1565C0",
    "--bg-base": isDark ? "#1a1a2e" : "#f5f5f5",
    "--panel-bg": isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
    "--btn-bg": isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    "--border-color": isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
    "--text-primary": isDark ? "#e0e0e0" : "#333333",
    "--text-secondary": isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
    "--font-size": "14px",
  });

  lifecycle.onMounted = () => {
    appEventBus.emit("ACTION_LOG", {
      action: "App: onMounted (水合完成)",
      timestamp: Date.now(),
    });
    appEventBus.emit("HYDRATION_CHECK", {
      id: "App:生命周期.onMounted",
      pass: true,
    });
    appEventBus.emit("HYDRATION_CHECK", {
      id: "App:ref(app-root)",
      pass: !!appRootRef.value,
    });

    useState(
      appState,
      "app.theme",
      (newTheme: string) => {
        const isDark = newTheme === "dark";
        const vars = getThemeVars(isDark);
        if (appRootRef.value) {
          for (const [key, value] of Object.entries(vars)) {
            appRootRef.value.style.setProperty(key, value);
          }
        }
      },
      lifecycle,
    );
  };

  const isDark = (appState.get("app.theme") ?? "dark") === "dark";
  const themeVars = getThemeVars(isDark);

  return h(
    "div",
    {
      class: "app-root",
      ref: 'appRootRef',
      style: themeVars,
    },
    // ===== 顶部标题 =====
    h(
      "header",
      {
        class: "app-header",
      },
      h(
        "h1",
        {
          class: "app-title",
        },
        "Hili Framework",
      ),
      h(
        "p",
        {
          class: "app-subtitle",
        },
        "SSR + Hydrate 全功能验证 · VideoPlayer 集成测试",
      ),
    ),

    // ===== 主内容区 =====
    h(
      "main",
      {
        class: "app-main",
      },
      // VideoPlayer 集成测试
      h(PlayerSection, {}),

      // 水合检测面板（最重要的调试工具）
      h(HydrationPanel, {}),

      // 用户信息 + 主题切换
      h(UserInfo, {}),
      h(ThemeSwitcher, {}),

      // 计数器
      h(CounterPanel, {
        onIncrement: () => {
          appEventBus.emit("ACTION_LOG", {
            action: "父组件收到 increment 回调",
            timestamp: Date.now(),
          });
        },
        onDecrement: () => {
          appEventBus.emit("ACTION_LOG", {
            action: "父组件收到 decrement 回调",
            timestamp: Date.now(),
          });
        },
        onReset: () => {
          appEventBus.emit("ACTION_LOG", {
            action: "父组件收到 reset 回调",
            timestamp: Date.now(),
          });
        },
      }),

      // 搜索 + Tabs + 条件渲染
      h(SearchBox, {}),
      h(Tabs, {}),
      h(ConditionalSection, { showAdmin: user.loggedIn }),

      // 列表 + Todo
      h(TaskList, { tasks }),
      h(TodoApp, {}),

      // 嵌套 + Fragment
      h(NestedContainer, {}),
      h(FragmentDemo, {}),

      // ref + expose
      h(
        "div",
        {
          class: "panel",
        },
        h("div", { class: "panel-title" }, h(IconLock, { size: 16 }), "ref & expose API"),
        h(ChildWithExpose, {
          initialValue: "Hello Hili",
          onValueChange: (payload: { value: string }) => {
            appEventBus.emit("ACTION_LOG", {
              action: "子组件值变化: " + payload.value,
              timestamp: Date.now(),
            });
          },
        }),
      ),

      // 事件日志
      h(EventLog, {}),
    ),

    // ===== 底部 =====
    h(
      "footer",
      {
        class: "app-footer",
      },
      "Hili Framework SSR + Hydrate Demo · 暗色主题 · SVG 图标",
    ),
  );
});

// ============================================
// 根布局组件
// ============================================

export const RootLayout = defineComponent(() => {
  return h(
    "div",
    {},
    provide(
      [
        { contextId: ThemeContext.id, value: darkTheme },
        { contextId: UserContext.id, value: userInfoValue },
      ],
      () => h(App, {}),
    ),
  );
});
