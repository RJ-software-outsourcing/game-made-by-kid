import { partFor } from './catalog.js'

// A lead is the difference in remaining shell percentages, as on the scoreboard.
function healthGap(match) {
  const [a, b] = match.robots
  return a.hp / a.s.hp - b.hp / b.s.hp
}

export const speakerFor = (kind) => (kind.startsWith('reason') ? 'analyst' : 'caller')

function ringsideNotes() {
  return { rechargeHits: 0, shortSwings: 0, dodgedMisses: 0, quickEvades: 0, shellSaved: 0, heaviest: 0 }
}

export class PlayByPlay {
  constructor(names, time = 0) {
    this.names = names
    this.used = new Map()
    this.next = time + 1.55
    this.analysisTurn = true
    this.notes = [ringsideNotes(), ringsideNotes()]
    this.peakDeficit = [0, 0]
    this.seenLeader = null
    this.lastLeadCall = null
    this.stableSince = time
    this.lastTick = null
  }

  opening() {
    return { subject: this.names[0], kind: 'vs' + this.names[1] }
  }

  finish(match) {
    return match.winner === 2
      ? { subject: 'neutral', kind: 'tie' }
      : { subject: this.names[match.winner], kind: 'win' }
  }

  note(kind, side, time, priority) {
    const subject = this.names[side]
    if (time - (this.used.get(subject + '/' + kind) ?? -100) < 8.5) return
    if (this.play && this.play.until >= time && this.play.priority > priority) return
    this.play = { subject, kind, priority, until: time + 1.15 }
  }

  observe(match) {
    const { time, robots } = match
    for (const e of match.events) {
      const i = e.side,
        defender = 1 - i
      const note = this.notes[i],
        other = this.notes[defender]
      if (e.kind === 'hit' || e.kind === 'guard' || e.kind === 'miss') {
        if (e.outOfReach) note.shortSwings++
        if (e.evaded) {
          other.dodgedMisses++
          const mover = robots[defender],
            attacker = robots[i]
          if (
            mover.s.speed > attacker.s.speed &&
            partFor('motor', mover.build.motor).speed > partFor('motor', attacker.build.motor).speed
          )
            other.quickEvades++
        }
        other.shellSaved += e.shellSaved || 0
        note.shellSaved += e.counterShellSaved || 0
        if (e.damage > 0) note.heaviest = Math.max(note.heaviest, e.damage)
        if (e.reply > 0) other.heaviest = Math.max(other.heaviest, e.reply)
      }
      if (e.kind === 'miss' && e.evaded) this.note('evaded', defender, time, 7)
      else if (e.kind === 'miss' && e.outOfReach) this.note('shortSwing', defender, time, 4)
      else if (e.kind === 'guard') this.note(e.reply ? 'counter' : 'guard', defender, time, 6)
      else if (e.kind === 'hit') {
        if (robots[defender].rest) note.rechargeHits++
        const tool =
          e.weapon < 0 || robots[i].build.weapon < 0 ? 'bash' : ['bump', 'brush', 'pop', 'waveHit'][e.weapon]
        this.note(e.doubleHit ? 'combo' : e.flanking ? 'flank' : tool || 'bash', i, time, e.doubleHit || e.flanking ? 7 : 5)
      } else if (e.kind === 'launch') this.note('bubble', i, time, 2)
      else if (e.kind === 'wave') this.note('wave', i, time, 2)
      else if (e.kind === 'dash' || e.kind === 'dodge') {
        this.note(e.kind, i, time, 4)
      } else if (e.kind === 'charge') this.note('rest', i, time, 3)
    }
  }

  analysis(match, gap, leader) {
    if (leader === null) {
      const full = match.robots.every((r) => r.hp === r.s.hp)
      const kind = full ? 'reasonFull' : 'reasonEven'
      if (match.time - (this.used.get('neutral/' + kind) ?? -100) >= 14) return { subject: 'neutral', kind }
      return null
    }
    if (match.time - this.stableSince < 0.36) return null
    const behind = 1 - leader
    const side = this.names[leader],
      p = match.robots[leader],
      q = match.robots[behind]
    const mine = this.notes[leader],
      theirs = this.notes[behind]
    let kind
    if (this.lastLeadCall !== null && this.lastLeadCall !== leader) kind = 'reasonComeback'
    this.lastLeadCall = leader
    if (!kind && this.peakDeficit[behind] - Math.abs(gap) > 0.11) {
      this.peakDeficit[behind] = Math.abs(gap)
      return { subject: this.names[behind], kind: 'reasonClose' }
    }
    if (!kind) {
      // Prefer a new, directly evidenced explanation to repeating a general
      // comparison. The shield, side and range cues describe actual contacts.
      const candidates = [
        ['reasonReach', p.longHits > 0 && theirs.shortSwings >= 2 && p.s.tool.reach > q.s.tool.reach],
        ['reasonRecharge', mine.rechargeHits > 0],
        ['reasonWheels', mine.quickEvades > 0],
        ['reasonArmor', mine.shellSaved >= p.s.hp * 0.03 && p.s.armor > q.s.armor],
        ['reasonFlank', p.flanks > 0],
        ['reasonRange', p.longHits > 0],
        ['reasonDodge', mine.dodgedMisses > 0],
        ['reasonBlocks', p.blocks >= 2 && p.blocks > q.blocks],
        ['reasonMisses', q.misses >= 2 && q.misses > p.misses],
        ['reasonHits', p.hits >= 2 && p.hits > q.hits],
        ['reasonFirst', p.hits === 1 && q.damage === 0],
        ['reasonForce', theirs.heaviest > 0 && mine.heaviest > theirs.heaviest + 0.8],
        ['reasonLead', true]
      ]
      let oldest = Infinity
      for (const [candidate, verified] of candidates) {
        const last = this.used.get(side + '/' + candidate) ?? -100
        if (verified && last < oldest) {
          kind = candidate
          oldest = last
        }
      }
    }
    return { subject: side, kind }
  }

  nextCall(match) {
    // Some views sample the same fixed step more than once.
    if (this.lastTick === match.time) return null
    this.lastTick = match.time
    this.observe(match)
    const time = match.time,
      gap = healthGap(match)
    const leader = gap > 0.055 ? 0 : gap < -0.055 ? 1 : null
    const gapSign = Math.sign(gap)
    if (this.gapSign && gapSign && this.gapSign !== gapSign) this.peakDeficit.fill(0)
    if (gapSign) this.gapSign = gapSign
    for (let i = 0; i < 2; i++) this.peakDeficit[i] = Math.max(this.peakDeficit[i], i ? gap : -gap)
    if (leader !== this.seenLeader) {
      this.seenLeader = leader
      this.stableSince = time
    }
    if (time < this.next || match.winner !== null) return null
    let call
    if (this.analysisTurn) call = this.analysis(match, gap, leader)
    else if (this.play?.until >= time) call = this.play
    else if (leader !== null && time > this.next + 1.25) {
      const side = this.lastSide === leader ? 1 - leader : leader
      call = { subject: this.names[side], kind: side === leader ? 'lead' : 'trail' }
    }
    if (!call) return null
    this.play = null
    this.used.set(call.subject + '/' + call.kind, time)
    this.lastSide = this.names.indexOf(call.subject)
    this.analysisTurn = !this.analysisTurn
    this.next = time + (this.analysisTurn ? 3.35 : 4.15)
    return { subject: call.subject, kind: call.kind, side: this.lastSide, names: this.names }
  }
}
