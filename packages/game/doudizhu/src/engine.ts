/** DouZero-compatible DouDizhu card rules and deterministic game state. */

export type Card = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 17 | 20 | 30
export type Seat = 'landlord' | 'landlord_down' | 'landlord_up'
export type Move = Card[]

export const SEATS: readonly Seat[] = ['landlord', 'landlord_down', 'landlord_up']
export const DECK: readonly Card[] = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17]
  .flatMap(card => [card, card, card, card] as Card[]).concat([20, 30] as Card[])

export interface MoveType { kind: number; rank: number; length?: number }

function counts(cards: readonly Card[]): Map<Card, number> {
  const result = new Map<Card, number>()
  for (const card of cards) result.set(card, (result.get(card) ?? 0) + 1)
  return result
}

function groups(cards: readonly Card[], amount: number): Card[] {
  return [...counts(cards)].filter(([, n]) => n === amount).map(([card]) => card).sort((a, b) => a - b)
}

function first(values: readonly Card[]): Card {
  const value = values[0]
  if (value === undefined) throw new Error('EMPTY_CARD_GROUP')
  return value
}

function consecutive(ranks: readonly Card[], minimum: number): boolean {
  const last = ranks.at(-1)
  return ranks.length >= minimum && last !== undefined && last < 15
    && ranks.every((rank, index) => index === 0 || rank === (ranks[index - 1] ?? rank) + 1)
}

/** Classify one move with the same 0-15 type tags used by DouZero. */
export function detectMove(cards: readonly Card[]): MoveType {
  const sorted = [...cards].sort((a, b) => a - b)
  const size = sorted.length
  const histogram = counts(sorted)
  const pairs = groups(sorted, 2)
  const triples = groups(sorted, 3)
  const fours = groups(sorted, 4)
  if (size === 0) return { kind: 0, rank: 0 }
  if (size === 1) return { kind: 1, rank: first(sorted) }
  if (size === 2 && histogram.size === 1) return { kind: 2, rank: first(sorted) }
  if (size === 2 && sorted[0] === 20 && sorted[1] === 30) return { kind: 5, rank: 30 }
  if (size === 3 && histogram.size === 1) return { kind: 3, rank: first(sorted) }
  if (size === 4 && histogram.size === 1) return { kind: 4, rank: first(sorted) }
  if (size === 4 && triples.length === 1) return { kind: 6, rank: first(triples) }
  if (size === 5 && triples.length === 1 && pairs.length === 1) return { kind: 7, rank: first(triples) }
  if (histogram.size === size && consecutive([...histogram.keys()].sort((a, b) => a - b), 5)) {
    return { kind: 8, rank: first(sorted), length: size }
  }
  if (size % 2 === 0 && pairs.length === size / 2 && consecutive(pairs, 3)) {
    return { kind: 9, rank: first(pairs), length: pairs.length }
  }
  if (size % 3 === 0 && triples.length === size / 3 && consecutive(triples, 2)) {
    return { kind: 10, rank: first(triples), length: triples.length }
  }
  if (size % 4 === 0 && triples.length === size / 4 && consecutive(triples, 2)) {
    return { kind: 11, rank: first(triples), length: triples.length }
  }
  if (size % 5 === 0 && triples.length === size / 5 && pairs.length === size / 5 && consecutive(triples, 2)) {
    return { kind: 12, rank: first(triples), length: triples.length }
  }
  if (size === 6 && fours.length === 1) return { kind: 13, rank: first(fours) }
  if (size === 8 && fours.length === 1 && pairs.length === 2) return { kind: 14, rank: first(fours) }
  return { kind: 15, rank: 0 }
}

/** Return whether a proposed move legally follows the current trick. */
export function beats(move: readonly Card[], rival: readonly Card[]): boolean {
  const mine = detectMove(move)
  if (mine.kind === 15 || mine.kind === 0) return false
  const theirs = detectMove(rival)
  if (theirs.kind === 0) return true
  if (mine.kind === 5) return true
  if (theirs.kind === 5) return false
  if (mine.kind === 4 && theirs.kind !== 4) return true
  return mine.kind === theirs.kind && mine.length === theirs.length && mine.rank > theirs.rank
}

function choose<T>(values: readonly T[], amount: number): T[][] {
  if (amount === 0) return [[]]
  const result: T[][] = []
  values.forEach((value, index) => {
    for (const tail of choose(values.slice(index + 1), amount - 1)) result.push([value, ...tail])
  })
  return result
}

function serial(ranks: readonly Card[], minimum: number, repeat: number, exact?: number): Move[] {
  const result: Move[] = []
  for (let start = 0; start < ranks.length; start += 1) {
    for (let length = exact ?? minimum; length <= (exact ?? ranks.length); length += 1) {
      const run = ranks.slice(start, start + length)
      if (run.length === length && consecutive(run, minimum)) result.push(run.flatMap(rank => Array<Card>(repeat).fill(rank)))
    }
  }
  return result
}

/** Enumerate all legal actions exactly from a hand and the current rival move. */
export function legalMoves(hand: readonly Card[], rival: readonly Card[]): Move[] {
  const histogram = counts(hand)
  const ranks = [...histogram.keys()].sort((a, b) => a - b)
  const pairs = ranks.filter(rank => (histogram.get(rank) ?? 0) >= 2)
  const triples = ranks.filter(rank => (histogram.get(rank) ?? 0) >= 3)
  const fours = ranks.filter(rank => histogram.get(rank) === 4)
  const all: Move[] = ranks.map(rank => [rank])
  all.push(...pairs.map(rank => [rank, rank]), ...triples.map(rank => [rank, rank, rank]), ...fours.map(rank => [rank, rank, rank, rank]))
  if (histogram.has(20) && histogram.has(30)) all.push([20, 30])
  for (const triple of triples) {
    all.push(...ranks.filter(rank => rank !== triple).map(rank => [triple, triple, triple, rank]))
    all.push(...pairs.filter(rank => rank !== triple).map(rank => [triple, triple, triple, rank, rank]))
  }
  all.push(
    ...serial(ranks.filter(rank => rank < 15), 5, 1),
    ...serial(pairs.filter(rank => rank < 15), 3, 2),
    ...serial(triples.filter(rank => rank < 15), 2, 3),
  )
  for (let length = 2; length <= triples.length; length += 1) {
    for (const body of serial(triples.filter(rank => rank < 15), 2, 3, length)) {
      const bodyRanks = new Set(body)
      const remainingCards = hand.filter(card => !bodyRanks.has(card))
      for (const wings of choose(remainingCards, length)) all.push([...body, ...wings])
      const remainingPairs = pairs.filter(rank => !bodyRanks.has(rank))
      for (const wings of choose(remainingPairs, length)) all.push([...body, ...wings.flatMap(rank => [rank, rank])])
    }
  }
  for (const four of fours) {
    const remainingCards = hand.filter(card => card !== four)
    for (const wings of choose(remainingCards, 2)) all.push([four, four, four, four, ...wings])
    for (const wings of choose(pairs.filter(rank => rank !== four), 2)) {
      all.push([four, four, four, four, ...wings.flatMap(rank => [rank, rank])])
    }
  }
  const unique = new Map(all.map((move) => {
    const sorted = move.sort((a, b) => a - b)
    return [sorted.join(','), sorted]
  }))
  const result = [...unique.values()].filter(move => rival.length === 0 || beats(move, rival))
  if (rival.length > 0) result.push([])
  return result
}

function shuffle(cards: readonly Card[], random: () => number): Card[] {
  const result = [...cards]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    const current = result[index]
    const replacement = result[target]
    if (current === undefined || replacement === undefined) throw new Error('INVALID_SHUFFLE_INDEX')
    result[index] = replacement
    result[target] = current
  }
  return result
}

export interface GameState {
  hands: Record<Seat, Card[]>
  landlordCards: Card[]
  turn: Seat
  lastMove: Move
  lastMover: Seat
  passes: number
  history: { seat: Seat; cards: Move }[]
  bombs: number
  winner?: 'landlord' | 'farmers'
}

/** Deal the DouZero fixed-role flow: landlord receives the three bottom cards and opens. */
export function createGame(random: () => number = Math.random): GameState {
  const deck = shuffle(DECK, random)
  const bottom = deck.slice(17, 20).sort((a, b) => a - b)
  return {
    hands: {
      landlord: deck.slice(0, 20).sort((a, b) => a - b),
      landlord_up: deck.slice(20, 37).sort((a, b) => a - b),
      landlord_down: deck.slice(37, 54).sort((a, b) => a - b),
    },
    landlordCards: bottom,
    turn: 'landlord', lastMove: [], lastMover: 'landlord', passes: 0, history: [], bombs: 0,
  }
}

/** Apply one action after validating turn, ownership, pass rules, and move strength. */
export function play(state: GameState, seat: Seat, cards: readonly Card[]): void {
  if (state.winner !== undefined) throw new Error('GAME_OVER')
  if (state.turn !== seat) throw new Error('NOT_YOUR_TURN')
  const action = [...cards].sort((a, b) => a - b)
  const available = counts(state.hands[seat])
  for (const [card, amount] of counts(action)) if ((available.get(card) ?? 0) < amount) throw new Error('CARD_NOT_OWNED')
  const rival = state.lastMover === seat || state.passes === 2 ? [] : state.lastMove
  if (action.length === 0 && rival.length === 0) throw new Error('CANNOT_PASS')
  if (action.length > 0 && !beats(action, rival)) throw new Error('ILLEGAL_MOVE')
  state.history.push({ seat, cards: action })
  if (action.length === 0) state.passes += 1
  else {
    state.lastMove = action
    state.lastMover = seat
    state.passes = 0
    const type = detectMove(action).kind
    if (type === 4 || type === 5) state.bombs += 1
    for (const card of action) state.hands[seat].splice(state.hands[seat].indexOf(card), 1)
    if (state.hands[seat].length === 0) state.winner = seat === 'landlord' ? 'landlord' : 'farmers'
  }
  state.turn = SEATS[(SEATS.indexOf(seat) + 1) % SEATS.length] ?? 'landlord'
}
