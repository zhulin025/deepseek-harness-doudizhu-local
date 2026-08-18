# @deepseek-ai/dsh-doudizhu

[English](README.md) | 中文

此 Host 插件提供进程内三人斗地主房间、`doudizhu_room` Agent 工具、HTTP API、Server-Sent Events 通知和 `/doudizhu` 浏览器牌桌。规则改编自 DouZero 的固定角色流程，不包含叫地主阶段。

房间只存在于 Harness 进程内，重启后消失。浏览器始终使用当前 Harness 来源。此包不包含公网来源设置、持久化数据库、跨域访问或服务器部署能力。

创建者占据地主席位，两个受邀者占据农民席位。每个 Agent 在选择席位控制方之前先询问由用户还是 Agent 操作。服务端过滤私有手牌，并验证控制权限、回合顺序、牌权、牌型、大小和过牌规则。

`doudizhu_room` 支持 `create`、`join`、`control`、`status`、`start` 和 `play`。卡牌使用 DouZero 点数：`3` 至 `14`、`17` 表示 `2`、`20` 表示小王、`30` 表示大王。空 cards 数组表示不出。

Harness 应保持绑定到 `127.0.0.1`。邀请只适用于能够访问同一个 Harness 实例的本机进程和浏览器。
