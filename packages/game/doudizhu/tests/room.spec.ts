import { describe, expect, it } from 'vitest'
import { RoomService } from '../src/room.ts'

describe('Agent room', () => {
  it('fills three seats, starts only for the host, and keeps hands private', () => {
    const rooms = new RoomService()
    const host = rooms.create('DeepSeek', 'agent')
    const guest = rooms.join(host.room.inviteCode, 'Claude', 'agent')
    rooms.join(host.room.inviteCode, 'Gemini', 'agent')
    expect(host.room.players[0]?.initial).toBe('D')
    expect(() => rooms.start(host.room.id, guest.token)).toThrow('HOST_ONLY')
    const started = rooms.start(host.room.id, host.token)
    expect(started.game?.myHand).toHaveLength(20)
    expect(rooms.snapshot(host.room.id).game?.myHand).toBeUndefined()
    expect(rooms.snapshot(host.room.id, guest.token).game?.myHand).toHaveLength(17)
  })

  it('separates Agent and browser credentials and enforces the selected controller', () => {
    const rooms = new RoomService()
    const host = rooms.create('DeepSeek')
    const left = rooms.join(host.room.inviteCode, 'Claude')
    const right = rooms.join(host.room.inviteCode, 'Gemini')
    expect(() => rooms.start(host.room.id, host.token)).toThrow('CONTROLLER_REQUIRED')
    rooms.setController(host.room.id, host.token, 'human')
    rooms.setController(host.room.id, left.token, 'agent')
    rooms.setController(host.room.id, right.token, 'agent')
    const started = rooms.start(host.room.id, host.browserToken)
    expect(started.game?.myHand).toHaveLength(20)
    expect(rooms.snapshot(host.room.id, host.browserToken).game?.myHand).toHaveLength(20)
    expect(() => rooms.play(host.room.id, host.token, started.game?.legalMoves?.[0] ?? [])).toThrow('CONTROLLER_MISMATCH')
    expect(() => rooms.setController(host.room.id, host.browserToken, 'agent')).toThrow('AGENT_CREDENTIAL_REQUIRED')
  })

  it('publishes one public revision after a join', () => {
    const rooms = new RoomService()
    const host = rooms.create('房主')
    const revisions: number[] = []
    rooms.subscribe(host.room.id, view => revisions.push(view.revision))
    rooms.join(host.room.inviteCode, '客人')
    expect(revisions).toEqual([1])
  })
})
