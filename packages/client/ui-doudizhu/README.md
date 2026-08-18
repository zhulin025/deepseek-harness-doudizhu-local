# @deepseek-ai/dsh-client-ui-doudizhu

English | [中文](README.zh.md)

This Web Client plugin registers a DouDizhu trigger in the Harness sidebar and renders the existing same-origin game table inside the center column. Closing the table restores the mounted conversation.

The trigger and center surface share one root-scoped store. The table uses an iframe only as a presentation isolation boundary; room authority, private hands, legal moves, and realtime updates remain owned by `@deepseek-ai/dsh-doudizhu`.

## Model Experience

### Browser-only surface

#### What the model sees

Nothing. This package only changes browser presentation and emits no `user/message` or tool result.

#### Token effect

Zero direct token effect.

#### KV Cache effect

The package contributes no model request tokens and does not affect prefix reuse.

## Known Limitations and Deferred Work

- **Same-origin Host dependency** — The embedded view requires the Host `@deepseek-ai/dsh-doudizhu` route to be mounted in the same Web composition.
