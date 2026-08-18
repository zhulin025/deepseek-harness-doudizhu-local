# @deepseek-ai/dsh-client-ui-doudizhu

[English](README.md) | 中文

此 Web Client 插件在 Harness 侧栏注册斗地主入口，并在主内容列中渲染现有的同源游戏牌桌。关闭牌桌后会恢复一直保持挂载的对话界面。

入口和主内容界面共享一个根作用域 store。牌桌使用 iframe 仅用于隔离呈现；房间权威、私有手牌、合法动作和实时更新仍由 `@deepseek-ai/dsh-doudizhu` 管理。

## 模型体验

### 仅浏览器界面

#### 模型看到的内容

无。此包只改变浏览器呈现，不产生 `user/message` 或工具结果。

#### Token 影响

没有直接 token 影响。

#### KV Cache 影响

此包不贡献模型请求 token，也不影响前缀复用。

## 已知限制和延期工作

- **同源 Host 依赖** — 内嵌视图要求同一个 Web 组合挂载 Host `@deepseek-ai/dsh-doudizhu` 路由。
