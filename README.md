# DeepSeek Harness 斗地主插件（纯本地版）

这是斗地主插件在加入公网部署能力之前的本地版本。游戏服务、房间状态、Agent 工具和浏览器牌桌全部运行在同一个 DeepSeek Harness 进程中，不连接公网游戏服务器，也不包含 VPS、域名、Caddy、systemd 或云端数据库配置。

## 功能

- 斗地主直接嵌入 DeepSeek Harness 主界面。
- 三个本机 Agent 或浏览器玩家加入同一个进程内房间。
- 完整牌型、回合、过牌、炸弹和胜负校验。
- 实时牌桌更新、当前出牌人显示、胜负动效和“再来一局”。
- Agent 与用户控制模式，玩家只能看到自己席位的手牌。
- 本地观战页面不显示任何手牌。

## 本地版限制

- 房间只保存在内存中，Harness 重启后房间消失。
- 页面和 API 固定使用当前 Harness 的 `location.origin`。
- 默认监听 `127.0.0.1`，邀请链接不能供外网 Agent 使用。
- 不包含 SQLite 持久化、公网地址配置、跨设备同步或服务器部署模板。

## 安装

此插件使用 DeepSeek Harness 的 `workspace:^` 依赖，需要放入兼容版本的 Harness 源码工作区。

假设两个仓库位于同一父目录：

```bash
export HARNESS_DIR=/path/to/deepseek-harness
export PLUGIN_DIR=/path/to/deepseek-harness-doudizhu-local

rsync -a "$PLUGIN_DIR/packages/game/doudizhu/" "$HARNESS_DIR/packages/game/doudizhu/"
rsync -a "$PLUGIN_DIR/packages/client/ui-doudizhu/" "$HARNESS_DIR/packages/client/ui-doudizhu/"
```

在 `packages/bundle/web-app/package.json` 的 `dependencies` 中加入：

```json
"@deepseek-ai/dsh-client-ui-doudizhu": "workspace:^",
"@deepseek-ai/dsh-doudizhu": "workspace:^"
```

在 `packages/bundle/web-app/cordis.patch.yml` 的 Web Server 条目之后加入：

```yaml
- id: doudizhu
  name: '@deepseek-ai/dsh-doudizhu'
  config:
    localOnly: true

- id: client-ui-doudizhu
  name: '@deepseek-ai/dsh-client-ui-doudizhu'
```

在根目录 `tsconfig.host.json` 的 `references` 中加入：

```json
{ "path": "./packages/game/doudizhu" }
```

在根目录 `tsconfig.client.json` 的 `references` 中加入：

```json
{ "path": "./packages/client/ui-doudizhu" }
```

安装并构建：

```bash
cd "$HARNESS_DIR"
pnpm install
pnpm exec vitest run packages/game/doudizhu/tests
pnpm run build:lib:host
pnpm run build:lib:client
```

## 启动

```bash
cd "$HARNESS_DIR"
pnpm dsh web --port 3099
```

打开 [http://127.0.0.1:3099](http://127.0.0.1:3099)，然后从侧栏进入“斗地主”。

## 使用

1. 输入名字并创建房间。
2. 点击“邀请本地 Agent”，复制邀请码或本地提示词。
3. 另外两个本机 Agent 使用 `doudizhu_room join` 加入。
4. 每个 Agent 询问用户由本人操作还是 Agent 代打，再调用 `control`。
5. 三个席位都确认控制方式后，房主开始游戏。

邀请链接包含 `127.0.0.1` 或当前本机来源，只能在同一台电脑上使用。不要把它当作公网邀请链接发送给远程用户。

## Agent 工具

`doudizhu_room` 支持：

- `create`：创建本地房间。
- `join`：使用邀请码加入。
- `control`：选择 `human` 或 `agent`。
- `status`：读取本席手牌、当前回合和合法动作。
- `start`：开始游戏。
- `play`：出牌；空数组表示不出。

## 安全说明

Harness 默认应监听 `127.0.0.1`。不要把 Harness 端口直接绑定到 `0.0.0.0` 或通过路由器、隧道、反向代理暴露到公网，因为 Harness 还包含游戏以外的本地能力。

## 许可证

项目采用 MIT License。DouZero 相关来源与适配说明见 `packages/game/doudizhu/NOTICE.md`。
