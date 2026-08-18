/** Process-local room authority for multiplayer DouDizhu. */

import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { createGame, legalMoves, play, type Card, type GameState, type Move, type Seat, SEATS } from './engine.ts'

export interface Player {
  id: string
  name: string
  initial: string
  seat: Seat
  tokenHash: string
  browserTokenHash: string
  controller: 'unset' | 'agent' | 'human'
}
export interface Room {
  id: string
  inviteCode: string
  status: 'waiting' | 'playing' | 'finished'
  players: Partial<Record<Seat, Player>>
  game?: GameState
  revision: number
}
export interface RoomView {
  id: string
  inviteCode: string
  status: Room['status']
  revision: number
  mySeat?: Seat
  players: {
    seat: Seat
    name: string
    initial: string
    cardCount: number
    controller: Player['controller']
  }[]
  game?: {
    turn: Seat
    landlordCards: Card[]
    lastMove: Move
    lastMover: Seat
    history: { seat: Seat; cards: Move }[]
    bombs: number
    winner?: 'landlord' | 'farmers'
    mySeat?: Seat
    myHand?: Card[]
    legalMoves?: Move[]
  }
}

function initial(name: string): string {
  return Array.from(name.trim())[0]?.toLocaleUpperCase() ?? '?'
}

export class RoomService {
  private readonly rooms = new Map<string, Room>()
  private readonly listeners = new Map<string, Set<(view: RoomView) => void>>()
  /** Create a room and reserve the landlord seat for its creator. */
  create(name: string, controller: Player['controller'] = 'unset'): { room: RoomView; token: string; browserToken: string } {
    const room: Room = { id: randomUUID(), inviteCode: randomBytes(6).toString('base64url').toUpperCase(), status: 'waiting', players: {}, revision: 0 }
    const { player, token, browserToken } = this.player(name, 'landlord', controller)
    room.players.landlord = player
    this.rooms.set(room.id, room)
    return { room: this.view(room, token), token, browserToken }
  }

  /** Join the first open farmer seat using a room invite code. */
  join(inviteCode: string, name: string, controller: Player['controller'] = 'unset'): { room: RoomView; token: string; browserToken: string } {
    const room = [...this.rooms.values()].find(candidate => candidate.inviteCode === inviteCode.toUpperCase())
    if (room === undefined) throw new Error('ROOM_NOT_FOUND')
    if (room.status !== 'waiting') throw new Error('ROOM_ALREADY_STARTED')
    const seat = SEATS.find(candidate => room.players[candidate] === undefined)
    if (seat === undefined) throw new Error('ROOM_FULL')
    const { player, token, browserToken } = this.player(name, seat, controller)
    room.players[seat] = player
    this.changed(room)
    return { room: this.view(room, token), token, browserToken }
  }

  /** Select the sole actor allowed to submit moves for a seat before dealing. */
  setController(roomId: string, token: string, controller: Exclude<Player['controller'], 'unset'>): RoomView {
    const room = this.authorizeAgent(roomId, token)
    if (room.status !== 'waiting') throw new Error('ROOM_ALREADY_STARTED')
    const player = this.playerByToken(room, token)
    if (player === undefined) throw new Error('UNAUTHORIZED_SEAT')
    player.controller = controller
    this.changed(room)
    return this.view(room, token)
  }

  /** Deal after all three seats have joined. */
  start(roomId: string, token: string): RoomView {
    const room = this.authorize(roomId, token)
    const host = room.players.landlord
    const kind = host === undefined ? undefined : this.credentialKind(host, token)
    if (host === undefined || (host.controller === 'human' ? kind !== 'browser' : kind !== 'agent')) throw new Error('HOST_ONLY')
    if (SEATS.some(seat => room.players[seat] === undefined)) throw new Error('ROOM_NOT_FULL')
    if (SEATS.some(seat => room.players[seat]?.controller === 'unset')) throw new Error('CONTROLLER_REQUIRED')
    if (room.status !== 'waiting') throw new Error('ROOM_ALREADY_STARTED')
    room.game = createGame()
    room.status = 'playing'
    this.changed(room)
    return this.view(room, token)
  }

  /** Submit a legal action for the caller's seat. */
  play(roomId: string, token: string, cards: readonly Card[]): RoomView {
    const room = this.authorize(roomId, token)
    const player = this.playerByCredential(room, token)
    if (player === undefined) throw new Error('UNAUTHORIZED_SEAT')
    const kind = this.credentialKind(player, token)
    if ((player.controller === 'agent' && kind !== 'agent') || (player.controller === 'human' && kind !== 'browser')) throw new Error('CONTROLLER_MISMATCH')
    if (room.game === undefined) throw new Error('GAME_NOT_STARTED')
    play(room.game, player.seat, cards)
    if (room.game.winner !== undefined) room.status = 'finished'
    this.changed(room)
    return this.view(room, token)
  }

  /** Return a role-filtered snapshot; omitted token yields a spectator view. */
  snapshot(roomId: string, token?: string): RoomView {
    const room = this.rooms.get(roomId)
    if (room === undefined) throw new Error('ROOM_NOT_FOUND')
    if (token !== undefined) this.authorize(roomId, token)
    return this.view(room, token)
  }

  /** Subscribe to public room changes. */
  subscribe(roomId: string, listener: (view: RoomView) => void): () => void {
    if (!this.rooms.has(roomId)) throw new Error('ROOM_NOT_FOUND')
    const listeners = this.listeners.get(roomId) ?? new Set()
    listeners.add(listener)
    this.listeners.set(roomId, listeners)
    return () => { listeners.delete(listener) }
  }

  /** Drop process-local listeners during plugin disposal. */
  close(): void {
    this.listeners.clear()
  }

  private player(name: string, seat: Seat, controller: Player['controller']): { player: Player; token: string; browserToken: string } {
    const trimmed = name.trim()
    if (trimmed.length === 0 || trimmed.length > 80) throw new Error('INVALID_AGENT_NAME')
    const token = randomBytes(32).toString('base64url')
    const browserToken = randomBytes(32).toString('base64url')
    const player = {
      id: randomUUID(), name: trimmed, initial: initial(trimmed), seat,
      tokenHash: tokenHash(token), browserTokenHash: tokenHash(browserToken), controller,
    }
    return { player, token, browserToken }
  }

  private authorize(roomId: string, token: string): Room {
    const room = this.rooms.get(roomId)
    if (room === undefined) throw new Error('ROOM_NOT_FOUND')
    if (this.playerByCredential(room, token) === undefined) throw new Error('UNAUTHORIZED_SEAT')
    return room
  }

  private authorizeAgent(roomId: string, token: string): Room {
    const room = this.authorize(roomId, token)
    const player = this.playerByToken(room, token)
    if (player === undefined) throw new Error('AGENT_CREDENTIAL_REQUIRED')
    return room
  }

  private playerByToken(room: Room, token: string): Player | undefined {
    const candidate = Buffer.from(tokenHash(token), 'hex')
    return Object.values(room.players).find((player) => {
      const expected = Buffer.from(player.tokenHash, 'hex')
      return expected.length === candidate.length && timingSafeEqual(expected, candidate)
    })
  }

  private playerByCredential(room: Room, token: string): Player | undefined {
    return Object.values(room.players).find(player => this.credentialKind(player, token) !== undefined)
  }

  private credentialKind(player: Player, token: string): 'agent' | 'browser' | undefined {
    const candidate = Buffer.from(tokenHash(token), 'hex')
    for (const [kind, hash] of [['agent', player.tokenHash], ['browser', player.browserTokenHash]] as const) {
      const expected = Buffer.from(hash, 'hex')
      if (expected.length === candidate.length && timingSafeEqual(expected, candidate)) return kind
    }
    return undefined
  }

  private changed(room: Room): void {
    room.revision += 1
    const publicView = this.view(room)
    for (const listener of this.listeners.get(room.id) ?? []) listener(publicView)
  }

  private view(room: Room, token?: string): RoomView {
    const player = token === undefined ? undefined : this.playerByCredential(room, token)
    const game = room.game
    return {
      id: room.id, inviteCode: room.inviteCode, status: room.status, revision: room.revision,
      ...(player === undefined ? {} : { mySeat: player.seat }),
      players: SEATS.flatMap((seat) => {
        const occupant = room.players[seat]
        return occupant === undefined ? [] : [{
          seat, name: occupant.name, initial: occupant.initial, cardCount: game?.hands[seat].length ?? 0, controller: occupant.controller,
        }]
      }),
      ...(game === undefined ? {} : { game: {
        turn: game.turn, landlordCards: [...game.landlordCards], lastMove: [...game.lastMove], lastMover: game.lastMover,
        history: game.history.map(item => ({ seat: item.seat, cards: [...item.cards] })), bombs: game.bombs,
        ...(game.winner === undefined ? {} : { winner: game.winner }),
        ...(player === undefined ? {} : {
          mySeat: player.seat, myHand: [...game.hands[player.seat]],
          legalMoves: game.turn === player.seat
            ? legalMoves(game.hands[player.seat], game.lastMover === player.seat || game.passes === 2 ? [] : game.lastMove)
            : [],
        }),
      } }),
    }
  }
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
