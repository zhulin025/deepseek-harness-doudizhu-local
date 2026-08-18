/** Multiplayer DouZero-compatible game plugin, HTTP table, and Agent tool. */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { WebServer } from '@deepseek-ai/dsh-host-webserver'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Card } from './engine.ts'
import { RoomService, type Player } from './room.ts'
import { GAME_HTML } from './ui.ts'

declare module '@deepseek-ai/cordis' {
  interface Context { webServer: WebServer }
}

export const name = 'doudizhu'
export const inject = ['tools', 'webServer']

/** Fixed local-only deployment guard. */
export interface Config {
  localOnly: boolean
}

export const Config: z<Config> = z.object({ localOnly: z.boolean().default(true) })

function bearer(req: IncomingMessage): string | undefined {
  return req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 32_768) throw new Error('REQUEST_TOO_LARGE')
    chunks.push(Buffer.from(buffer))
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('INVALID_BODY')
  return parsed as Record<string, unknown>
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(value))
}

function requireText(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${name.toUpperCase()}_REQUIRED`)
  return value.trim()
}

function cards(value: unknown): Card[] {
  const allowed = new Set([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 20, 30])
  if (!Array.isArray(value) || value.some(card => typeof card !== 'number' || !allowed.has(card))) throw new Error('INVALID_CARDS')
  return value as Card[]
}

function controller(value: unknown, allowUnset = false): Player['controller'] {
  if (value === 'agent' || value === 'human' || (allowUnset && (value === undefined || value === 'unset'))) return value ?? 'unset'
  throw new Error('INVALID_CONTROLLER')
}

/** Install the shared room authority, browser routes, SSE stream, and model-facing room tool. */
export function apply(ctx: Context, config: Config): void {
  if (!config.localOnly) throw new Error('The local DouDizhu edition cannot enable remote access')
  const rooms = new RoomService()
  ctx.effect(() => () => { rooms.close() }, 'doudizhu.close')
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/doudizhu', handler: (_req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    res.end(GAME_HTML)
  } }), 'doudizhu.page')
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: '/doudizhu/api', handler: async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://local')
    const segments = url.pathname.split('/').filter(Boolean).slice(2)
    try {
      if (req.method === 'POST' && segments.join('/') === 'rooms') {
        const input = await body(req)
        json(res, 201, rooms.create(requireText(input.name, 'name'), controller(input.controller, true)))
        return
      }
      if (req.method === 'POST' && segments.join('/') === 'rooms/join') {
        const input = await body(req)
        const inviteCode = requireText(input.inviteCode, 'inviteCode')
        json(res, 201, rooms.join(inviteCode, requireText(input.name, 'name'), controller(input.controller, true)))
        return
      }
      const roomId = segments[1]
      if (segments[0] === 'rooms' && roomId !== undefined && req.method === 'GET' && segments.length === 2) {
        json(res, 200, rooms.snapshot(roomId, bearer(req)))
        return
      }
      if (segments[0] === 'rooms' && roomId !== undefined && req.method === 'POST' && segments[2] === 'start') {
        json(res, 200, rooms.start(roomId, requireText(bearer(req), 'token')))
        return
      }
      if (segments[0] === 'rooms' && roomId !== undefined && req.method === 'POST' && segments[2] === 'controller') {
        const input = await body(req)
        json(res, 200, rooms.setController(roomId, requireText(bearer(req), 'token'), controller(input.controller) as 'agent' | 'human'))
        return
      }
      if (segments[0] === 'rooms' && roomId !== undefined && req.method === 'POST' && segments[2] === 'moves') {
        const input = await body(req)
        json(res, 200, rooms.play(roomId, requireText(bearer(req), 'token'), cards(input.cards)))
        return
      }
      if (segments[0] === 'rooms' && roomId !== undefined && req.method === 'GET' && segments[2] === 'events') {
        res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' })
        res.write(`data: ${JSON.stringify(rooms.snapshot(roomId))}\n\n`)
        const dispose = rooms.subscribe(roomId, (view) => { res.write(`data: ${JSON.stringify(view)}\n\n`) })
        req.once('close', dispose)
        return
      }
      json(res, 404, { error: 'NOT_FOUND' })
    } catch (error) {
      json(res, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  } }), 'doudizhu.api')

  ctx.tools.register(defineTool({
    name: 'doudizhu_room',
    description: 'Create or join a three-Agent DouDizhu room. After taking a seat, ask the user whether they will play this round or want Agent autoplay, then call control before starting or playing. Keep the seat token private; give the returned privatePlayerUrl only to your own user.',
    parameters: {
      action: { type: 'string', required: true, enum: ['create', 'join', 'control', 'status', 'start', 'play'], description: 'Room operation.' },
      agent_name: { type: 'string', description: 'Your Agent name; required for create or join.' },
      invite_code: { type: 'string', description: 'Invite code; required for join.' },
      room_id: { type: 'string', description: 'Room id; required after create or join.' },
      seat_token: { type: 'string', description: 'Private seat token; required for private room operations.' },
      cards: { type: 'array', items: { type: 'integer' }, description: 'Cards to play as DouZero ranks: 3-14, 17=2, 20=small joker, 30=big joker. Empty means pass.' },
      controller: { type: 'string', enum: ['human', 'agent'], description: 'Required for control after asking the user who will play this round.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { result: { type: 'string', required: true } } },
      render: (_args, value) => [{ type: 'text', text: value.result }],
    },
    execute(args) {
      let result: unknown
      switch (args.action) {
        case 'create': result = rooms.create(requireText(args.agent_name, 'agent_name')); break
        case 'join': result = rooms.join(requireText(args.invite_code, 'invite_code'), requireText(args.agent_name, 'agent_name')); break
        case 'control': result = rooms.setController(requireText(args.room_id, 'room_id'), requireText(args.seat_token, 'seat_token'), controller(args.controller) as 'agent' | 'human'); break
        case 'status': result = rooms.snapshot(requireText(args.room_id, 'room_id'), requireText(args.seat_token, 'seat_token')); break
        case 'start': result = rooms.start(requireText(args.room_id, 'room_id'), requireText(args.seat_token, 'seat_token')); break
        case 'play': result = rooms.play(requireText(args.room_id, 'room_id'), requireText(args.seat_token, 'seat_token'), cards(args.cards)); break
        default: throw new Error('UNKNOWN_ACTION')
      }
      return Promise.resolve({ result: JSON.stringify(result) })
    },
    presentCall: args => ({ card: 'generic', title: `DouDizhu: ${args.action}`, kind: args.action === 'status' ? 'read' : 'other', rawInput: args }),
  }))
}
