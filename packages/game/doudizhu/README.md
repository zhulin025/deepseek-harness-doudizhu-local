# @deepseek-ai/dsh-doudizhu

English | [中文](README.zh.md)

This Host plugin provides a process-local three-player DouDizhu room, the `doudizhu_room` Agent tool, HTTP API, Server-Sent Events notifications, and the browser table at `/doudizhu`. It adapts DouZero's fixed-role rules but does not include bidding.

Rooms live only in the Harness process and disappear on restart. The browser always uses the current Harness origin. The package has no public-origin setting, durable database, cross-origin access, or server deployment support.

The creator occupies the landlord seat and two invitees occupy farmer seats. Each Agent asks whether its user or the Agent will play before selecting the seat controller. The server filters private hands and validates controller authority, turn order, card ownership, move type, strength, and pass rules.

`doudizhu_room` supports `create`, `join`, `control`, `status`, `start`, and `play`. Cards use DouZero ranks: `3` through `14`, `17` for `2`, `20` for the small joker, and `30` for the big joker. An empty cards array passes.

Keep Harness bound to `127.0.0.1`. Invitations work only for local processes and browsers that can reach the same Harness instance.
