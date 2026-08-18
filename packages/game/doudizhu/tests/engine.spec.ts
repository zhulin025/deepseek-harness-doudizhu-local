import { describe, expect, it } from 'vitest'
import { beats, createGame, detectMove, legalMoves, play } from '../src/engine.ts'

describe('DouDizhu engine', () => {
  it('classifies every compound DouZero move family', () => {
    expect(detectMove([3, 3, 3, 4])).toMatchObject({ kind: 6, rank: 3 })
    expect(detectMove([3, 3, 3, 4, 4])).toMatchObject({ kind: 7, rank: 3 })
    expect(detectMove([3, 4, 5, 6, 7])).toMatchObject({ kind: 8, length: 5 })
    expect(detectMove([3, 3, 4, 4, 5, 5])).toMatchObject({ kind: 9, length: 3 })
    expect(detectMove([3, 3, 3, 4, 4, 4, 7, 8])).toMatchObject({ kind: 11, length: 2 })
    expect(detectMove([6, 6, 6, 6, 7, 7, 8, 8])).toMatchObject({ kind: 14, rank: 6 })
  })

  it('applies bomb and rocket precedence', () => {
    expect(beats([4, 4, 4, 4], [14])).toBe(true)
    expect(beats([20, 30], [17, 17, 17, 17])).toBe(true)
    expect(beats([3, 3, 3, 3], [20, 30])).toBe(false)
  })

  it('deals 54 cards and validates the turn flow', () => {
    const state = createGame(() => 0.5)
    expect(Object.values(state.hands).map(hand => hand.length)).toEqual([20, 17, 17])
    const action = legalMoves(state.hands.landlord, [])[0]!
    play(state, 'landlord', action)
    expect(state.turn).toBe('landlord_down')
    expect(() => { play(state, 'landlord', []) }).toThrow('NOT_YOUR_TURN')
  })
})
