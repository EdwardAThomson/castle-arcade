(function(){
var __mods={},__cache={};
function __resolve(from,req){
  if(req.charAt(0)!=="."){return req.replace(/\.js$/,"");}
  var dir=from.indexOf("/")>=0?from.slice(0,from.lastIndexOf("/")):"";
  var parts=dir?dir.split("/"):[];
  req.replace(/\.js$/,"").split("/").forEach(function(p){
    if(p==="."){}else if(p===".."){parts.pop();}else{parts.push(p);}
  });
  return parts.join("/");
}
function __require(id){
  if(__cache[id]){return __cache[id].exports;}
  var m={exports:{}};__cache[id]=m;
  __mods[id](m,m.exports,function(r){return __require(__resolve(id,r));});
  return m.exports;
}
__mods["cpu/isa"]=function(module,exports,require){
'use strict'
// CastlePalm CPU ISA v0 — concrete variable-length encoding (PROVISIONAL).
//
// Single source of truth for the assembler and the CPU core. Opcode-byte-first,
// single-pass: byte 0 (the opcode) fully determines the instruction and its total
// length via the operand kinds below. See cpu/ENCODING_V0.md and docs/ISA_DRAFT.md.
//
// Operand-kind byte sizes. 'regs' is one byte packing up to two 4-bit register
// fields (hi nibble = first operand, lo nibble = second); the assembler/core
// interpret the nibbles per-instruction. Multi-byte values are little-endian.
const KIND_BYTES = { regs: 1, imm8: 1, imm16: 2, addr24: 3, disp8: 1, disp16: 2 }

// [mnemonic, opcode, [operand kinds]]. Opcodes are unique and stable.
const TABLE = [
  ['NOP', 0x00, []],

  // --- data movement ---
  ['MOV.i', 0x01, ['regs', 'imm16']],   // MOV Rd,#imm16   (regs: Rd in hi nibble)
  ['MOV.b', 0x02, ['regs', 'imm8']],    // MOV Rd,#imm8
  ['MOV.r', 0x03, ['regs']],            // MOV Rd,Rs
  ['LDA', 0x04, ['regs', 'addr24']],    // LDA An,#imm24
  ['LDADDR', 0x05, ['regs']],           // LDADDR An,[Am]
  ['MOVA', 0x06, ['regs']],             // MOVA Ad,As

  // --- loads / stores: word + byte over the addressing-mode family ---
  ['LDW.ind', 0x10, ['regs']],          // LDW Rd,[An]
  ['LDW.dsp', 0x11, ['regs', 'disp8']], // LDW Rd,[An+#d8]
  ['LDW.idx', 0x12, ['regs', 'regs']],  // LDW Rd,[An+Rm]  (byte1 Rd|An, byte2 Rm)
  ['LDW.abs', 0x13, ['regs', 'addr24']],// LDW Rd,[abs24]
  ['LDB.ind', 0x14, ['regs']],
  ['LDB.dsp', 0x15, ['regs', 'disp8']],
  ['LDB.idx', 0x16, ['regs', 'regs']],
  ['LDB.abs', 0x17, ['regs', 'addr24']],
  ['STW.ind', 0x18, ['regs']],
  ['STW.dsp', 0x19, ['regs', 'disp8']],
  ['STW.idx', 0x1a, ['regs', 'regs']],
  ['STW.abs', 0x1b, ['regs', 'addr24']],
  ['STB.ind', 0x1c, ['regs']],
  ['STB.dsp', 0x1d, ['regs', 'disp8']],
  ['STB.idx', 0x1e, ['regs', 'regs']],
  ['STB.abs', 0x1f, ['regs', 'addr24']],

  // --- arithmetic (16-bit) ---
  ['ADD.r', 0x30, ['regs']],
  ['ADD.i', 0x31, ['regs', 'imm16']],
  ['SUB.r', 0x32, ['regs']],
  ['SUB.i', 0x33, ['regs', 'imm16']],
  ['ADC.r', 0x34, ['regs']],
  ['SBC.r', 0x35, ['regs']],
  ['CMP.r', 0x36, ['regs']],
  ['CMP.i', 0x37, ['regs', 'imm16']],
  ['NEG', 0x38, ['regs']],

  // --- logic ---
  ['AND.r', 0x39, ['regs']],
  ['AND.i', 0x3a, ['regs', 'imm16']],
  ['OR.r', 0x3b, ['regs']],
  ['OR.i', 0x3c, ['regs', 'imm16']],
  ['XOR.r', 0x3d, ['regs']],
  ['XOR.i', 0x3e, ['regs', 'imm16']],
  ['NOT', 0x3f, ['regs']],
  ['BIT.r', 0x40, ['regs']],
  ['TST', 0x41, ['regs']],

  // --- shifts ---
  ['SHL.i', 0x42, ['regs', 'imm8']],
  ['SHR.i', 0x43, ['regs', 'imm8']],
  ['SAR.i', 0x44, ['regs', 'imm8']],
  ['SHL.r', 0x45, ['regs']],
  ['SHR.r', 0x46, ['regs']],
  ['SAR.r', 0x47, ['regs']],

  // --- address arithmetic (24-bit, address regs) ---
  ['ADDA.i', 0x48, ['regs', 'imm16']],  // ADD An,#simm16
  ['ADDA.r', 0x49, ['regs']],           // ADD An,Rm
  ['INCA', 0x4a, ['regs']],
  ['DECA', 0x4b, ['regs']],
  ['CMPA', 0x4c, ['regs']],

  // --- control flow (Bcc are signed + unsigned; disp8 relative) ---
  ['BRA', 0x50, ['disp16']],
  ['BEQ', 0x51, ['disp8']], ['BNE', 0x52, ['disp8']],
  ['BCS', 0x53, ['disp8']], ['BCC', 0x54, ['disp8']],
  ['BMI', 0x55, ['disp8']], ['BPL', 0x56, ['disp8']],
  ['BVS', 0x57, ['disp8']], ['BVC', 0x58, ['disp8']],
  ['BLT', 0x59, ['disp8']], ['BGE', 0x5a, ['disp8']],
  ['BGT', 0x5b, ['disp8']], ['BLE', 0x5c, ['disp8']],
  ['BHI', 0x5d, ['disp8']], ['BLS', 0x5e, ['disp8']],
  ['JMP.abs', 0x60, ['addr24']],
  ['JMP.ind', 0x61, ['regs']],          // JMP [An]
  ['CALL.abs', 0x62, ['addr24']],
  ['CALL.ind', 0x63, ['regs']],         // CALL [An]
  ['RET', 0x64, []],

  // --- stack / system ---
  ['PUSH', 0x70, ['regs']],             // PUSH Rn (word)
  ['POP', 0x71, ['regs']],
  ['PUSHA', 0x72, ['regs']],            // PUSHA An (24-bit, 4-byte slot)
  ['POPA', 0x73, ['regs']],
  ['IRET', 0x74, []],
  ['HALT', 0x75, []],
  ['WAIT', 0x76, []],                   // wait for next vblank
  ['EI', 0x77, []], ['DI', 0x78, []],   // enable / disable interrupts
]

const BYNAME = new Map(TABLE.map(([n, op, k]) => [n, { name: n, opcode: op, kinds: k }]))
const BYOP = new Map(TABLE.map(([n, op, k]) => [op, { name: n, opcode: op, kinds: k }]))

function instr(name) { const e = BYNAME.get(name); if (!e) throw new Error('unknown instruction ' + name); return e }
function lengthOf(opcode) {
  const e = BYOP.get(opcode); if (!e) throw new Error('unknown opcode 0x' + opcode.toString(16))
  return 1 + e.kinds.reduce((s, k) => s + KIND_BYTES[k], 0)
}

// encode(name, values[]) -> Uint8Array. values align with the instruction's
// operand kinds; a 'regs' value is the packed byte. Multi-byte values little-endian.
function encode(name, values = []) {
  const e = instr(name), out = [e.opcode]
  if (values.length !== e.kinds.length) throw new Error(`${name}: expected ${e.kinds.length} operands, got ${values.length}`)
  e.kinds.forEach((k, i) => { let v = values[i] | 0; for (let b = 0; b < KIND_BYTES[k]; b++) { out.push(v & 0xff); v >>>= 8 } })
  return Uint8Array.from(out)
}

// decode(bytes, off) -> { name, opcode, values, length }.
function decode(bytes, off = 0) {
  const op = bytes[off], e = BYOP.get(op)
  if (!e) throw new Error('unknown opcode 0x' + (op || 0).toString(16) + ' at ' + off)
  let p = off + 1; const values = []
  for (const k of e.kinds) {
    const n = KIND_BYTES[k]; let v = 0
    for (let b = 0; b < n; b++) v |= bytes[p++] << (8 * b)
    values.push(v >>> 0)
  }
  return { name: e.name, opcode: op, values, length: p - off }
}

// pack two register numbers into a 'regs' byte (hi = first, lo = second).
const packRegs = (a = 0, b = 0) => ((a & 0xf) << 4) | (b & 0xf)
const unpackRegs = byte => [(byte >> 4) & 0xf, byte & 0xf]

// Interrupt / reset vectors: a table of 24-bit addresses at the ROM base.
const VECTOR_BASE = 0x300000     // matches docs/MEMORY_MAP.md ROM base
const VECTOR_BYTES = 3
const VECTORS = ['reset', 'vblank', 'hblank', 'dmaDone']  // entry i at VECTOR_BASE + i*3
const vectorAddr = name => {
  const i = VECTORS.indexOf(name); if (i < 0) throw new Error('unknown vector ' + name)
  return VECTOR_BASE + i * VECTOR_BYTES
}

module.exports = {
  KIND_BYTES, TABLE, BYNAME, BYOP, instr, lengthOf, encode, decode,
  packRegs, unpackRegs, VECTOR_BASE, VECTOR_BYTES, VECTORS, vectorAddr,
}

};
__mods["cpu/asm"]=function(module,exports,require){
'use strict'
// CastlePalm assembler v0 — text .asm -> bytes, lowering through cpu/isa.js.
//
// Two-pass: pass A parses + classifies each instruction to a concrete isa variant
// (so sizes are known); pass B assigns addresses and resolves labels; pass C emits.
// Provisional, mirrors the docs/ISA_DRAFT.md direction. Syntax is documented in
// cpu/ENCODING_V0.md / examples; deliberately small and regular.

const isa = require('./isa.js')
const { packRegs } = isa

const reg = t => { const m = /^[Rr]([0-7])$/.exec(t); if (!m) throw new Error('expected R0-R7, got "' + t + '"'); return +m[1] }
const aregOrNull = t => { const m = /^[Aa]([0-3])$/.exec(t); return m ? +m[1] : null }
const areg = t => { const a = aregOrNull(t); if (a == null) throw new Error('expected A0-A3, got "' + t + '"'); return a }

function term(t, symbols) {
  t = t.trim()
  if (/^\$[0-9a-fA-F]+$/.test(t)) return parseInt(t.slice(1), 16)
  if (/^0x[0-9a-fA-F]+$/i.test(t)) return parseInt(t, 16)
  if (/^%[01]+$/.test(t)) return parseInt(t.slice(1), 2)
  if (/^-?\d+$/.test(t)) return parseInt(t, 10)
  if (/^'.'$/.test(t)) return t.charCodeAt(1)
  if (symbols && symbols.has(t)) return symbols.get(t)
  throw new Error('unknown symbol "' + t + '"')
}
function resolve(expr, symbols) {
  let total = 0, m; const re = /([+-])?\s*([^+\-\s][^+-]*)/g
  while ((m = re.exec(expr))) total += (m[1] === '-' ? -1 : 1) * term(m[2], symbols)
  return total
}
const isLiteral = expr => { try { resolve(expr, null); return true } catch { return false } }

// split operands on top-level commas (brackets contain no commas in this ISA)
const splitOps = s => s.trim() ? s.split(',').map(x => x.trim()) : []

function parseMem(s) {
  if (!/^\[.*\]$/.test(s)) return null
  const inner = s.slice(1, -1).replace(/\s+/g, '')
  if (inner.includes('+')) {
    const i = inner.indexOf('+')
    const l = inner.slice(0, i), r = inner.slice(i + 1)
    const a = aregOrNull(l)
    if (a != null) {                                  // [An+#disp] or [An+Rm]
      if (r.startsWith('#')) return { mode: 'dsp', a, disp: r.slice(1) }
      return { mode: 'idx', a, m: reg(r) }
    }
    return { mode: 'abs', addr: inner }               // [label+offset] absolute
  }
  const a = aregOrNull(inner)
  return a != null ? { mode: 'ind', a } : { mode: 'abs', addr: inner }
}

const BCC = new Set(['BEQ', 'BNE', 'BCS', 'BCC', 'BMI', 'BPL', 'BVS', 'BVC', 'BLT', 'BGE', 'BGT', 'BLE', 'BHI', 'BLS'])
const NULLARY = new Set(['NOP', 'RET', 'IRET', 'HALT', 'WAIT', 'EI', 'DI'])
const ALU = new Set(['ADD', 'SUB', 'CMP', 'AND', 'OR', 'XOR'])

// classify(mnem, ops) -> { isaName, build(symbols, addr) -> values[] }
function classify(mnem, ops) {
  const mk = (isaName, build) => ({ isaName, build })
  if (NULLARY.has(mnem)) return mk(mnem, () => [])

  if (mnem === 'MOV') {
    const d = reg(ops[0])
    if (ops[1].startsWith('#')) {
      const imm = ops[1].slice(1)
      const small = isLiteral(imm) && resolve(imm, null) >= 0 && resolve(imm, null) < 256
      return small ? mk('MOV.b', s => [packRegs(d, 0), resolve(imm, s) & 0xff])
                   : mk('MOV.i', s => [packRegs(d, 0), resolve(imm, s) & 0xffff])
    }
    return mk('MOV.r', () => [packRegs(d, reg(ops[1]))])
  }
  if (mnem === 'LDA') { const a = areg(ops[0]); const e = ops[1].replace(/^#/, ''); return mk('LDA', s => [packRegs(a, 0), resolve(e, s) & 0xffffff]) }
  if (mnem === 'LDADDR') { const a = areg(ops[0]); const m = parseMem(ops[1]); return mk('LDADDR', () => [packRegs(a, m.a)]) }
  if (mnem === 'MOVA') return mk('MOVA', () => [packRegs(areg(ops[0]), areg(ops[1]))])

  if (['LDW', 'LDB', 'STW', 'STB'].includes(mnem)) {
    const r = reg(ops[0]), m = parseMem(ops[1])
    if (!m) throw new Error(mnem + ' needs a [memory] operand')
    if (m.mode === 'ind') return mk(`${mnem}.ind`, () => [packRegs(r, m.a)])
    if (m.mode === 'dsp') return mk(`${mnem}.dsp`, s => [packRegs(r, m.a), resolve(m.disp, s) & 0xff])
    if (m.mode === 'idx') return mk(`${mnem}.idx`, () => [packRegs(r, m.a), packRegs(m.m, 0)])
    return mk(`${mnem}.abs`, s => [packRegs(r, 0), resolve(m.addr, s) & 0xffffff])
  }

  if (ALU.has(mnem)) {
    const dA = aregOrNull(ops[0])
    if (dA != null) { // address arithmetic
      if (mnem === 'ADD') return ops[1].startsWith('#')
        ? mk('ADDA.i', s => [packRegs(dA, 0), resolve(ops[1].slice(1), s) & 0xffff])
        : mk('ADDA.r', () => [packRegs(dA, reg(ops[1]))])
      if (mnem === 'CMP') return mk('CMPA', () => [packRegs(dA, areg(ops[1]))])
      throw new Error(mnem + ' not valid on address registers')
    }
    const d = reg(ops[0])
    return ops[1].startsWith('#')
      ? mk(`${mnem}.i`, s => [packRegs(d, 0), resolve(ops[1].slice(1), s) & 0xffff])
      : mk(`${mnem}.r`, () => [packRegs(d, reg(ops[1]))])
  }
  if (mnem === 'ADC' || mnem === 'SBC' || mnem === 'BIT') return mk(`${mnem}.r`, () => [packRegs(reg(ops[0]), reg(ops[1]))])
  if (mnem === 'NEG' || mnem === 'NOT' || mnem === 'TST') return mk(mnem, () => [packRegs(reg(ops[0]), 0)])
  if (['SHL', 'SHR', 'SAR'].includes(mnem)) {
    const d = reg(ops[0])
    return ops[1].startsWith('#')
      ? mk(`${mnem}.i`, s => [packRegs(d, 0), resolve(ops[1].slice(1), s) & 0xff])
      : mk(`${mnem}.r`, () => [packRegs(d, reg(ops[1]))])
  }
  if (mnem === 'INC' || mnem === 'INCA') return mk('INCA', () => [packRegs(areg(ops[0]), 0)])
  if (mnem === 'DEC' || mnem === 'DECA') return mk('DECA', () => [packRegs(areg(ops[0]), 0)])

  if (mnem === 'BRA') return mk('BRA', (s, addr) => [(resolve(ops[0], s) - (addr + 3)) & 0xffff])
  if (BCC.has(mnem)) return mk(mnem, (s, addr) => {
    const d = resolve(ops[0], s) - (addr + 2)
    if (d < -128 || d > 127) throw new Error(`${mnem} target out of range (${d}); use BRA`)
    return [d & 0xff]
  })
  if (mnem === 'JMP' || mnem === 'CALL') {
    const m = parseMem(ops[0])
    if (m && m.mode === 'ind') return mk(`${mnem}.ind`, () => [packRegs(m.a, 0)])
    return mk(`${mnem}.abs`, s => [resolve(ops[0], s) & 0xffffff])
  }
  if (mnem === 'PUSH' || mnem === 'POP') return mk(mnem, () => [packRegs(reg(ops[0]), 0)])
  if (mnem === 'PUSHA' || mnem === 'POPA') return mk(mnem, () => [packRegs(areg(ops[0]), 0)])

  throw new Error('unknown mnemonic ' + mnem)
}

// readBinary(relPath) -> bytes lets `INCBIN "file"` embed a raw binary at the current
// address. It is injected by the Node build tools (build-cart/bundle); the browser
// never assembles INCBIN carts, so asm.js itself stays filesystem-free.
function assemble(source, { origin = 0x300000, readBinary = null } = {}) {
  const symbols = new Map()
  const labelLine = new Map()    // label -> first-definition line (duplicate detection)
  const records = []             // {type, ...}
  const lines = source.split('\n')
  const errors = []
  const err = (line, msg) => errors.push({ line, msg, src: (lines[line - 1] || '').trim() })

  lines.forEach((raw, i) => {
    const ln = i + 1
    let line = raw.replace(/;.*$/, '').trim()
    if (!line) return
    const lm = /^([A-Za-z_.][\w.]*):\s*(.*)$/.exec(line)
    if (lm) {
      const name = lm[1]
      if (labelLine.has(name)) err(ln, `duplicate label "${name}" (first defined on line ${labelLine.get(name)})`)
      else { labelLine.set(name, ln); records.push({ type: 'label', name, line: ln }) }
      line = lm[2].trim(); if (!line) return
    }
    const parts = line.split(/\s+/)
    if (parts[1] === 'EQU') {
      try { symbols.set(parts[0], resolve(parts.slice(2).join(' '), symbols)) } catch (e) { err(ln, e.message) }
      return
    }
    const mnem = parts[0].toUpperCase()
    const rest = line.slice(parts[0].length).trim()
    try {
      if (mnem === 'ORG') { records.push({ type: 'org', addr: resolve(rest, symbols), line: ln }); return }
      if (mnem === 'DB' || mnem === 'DW' || mnem === 'DA') {
        const width = mnem === 'DB' ? 1 : mnem === 'DW' ? 2 : 3
        const items = splitOps(rest)
        records.push({ type: 'data', width, items, size: items.length * width, line: ln })
        return
      }
      if (mnem === 'INCBIN') {
        const m = /^"([^"]*)"$/.exec(rest)
        if (!m) { err(ln, 'INCBIN expects a quoted path, e.g. INCBIN "art/ship.bin"'); return }
        if (typeof readBinary !== 'function') { err(ln, 'INCBIN is unavailable here (no binary reader provided to the assembler)'); return }
        let bytes
        try { bytes = Uint8Array.from(readBinary(m[1])) } catch (e) { err(ln, `INCBIN cannot read "${m[1]}": ${e.message}`); return }
        records.push({ type: 'incbin', bytes, size: bytes.length, line: ln })
        return
      }
      const { isaName, build } = classify(mnem, splitOps(rest))
      records.push({ type: 'instr', isaName, build, size: isa.lengthOf(isa.instr(isaName).opcode), line: ln })
    } catch (e) { err(ln, e.message) }   // skip the bad line; keep collecting
  })

  // pass B: addresses + labels. lo is the lowest emitted address (no leading gap).
  let addr = origin, lo = Infinity, hi = origin
  for (const r of records) {
    if (r.type === 'org') { addr = r.addr; continue }
    if (r.type === 'label') { symbols.set(r.name, addr); continue }
    r.addr = addr; addr += r.size
    if (r.addr < lo) lo = r.addr
    if (addr > hi) hi = addr
  }
  if (lo === Infinity) lo = origin

  // pass C: emit (resolve errors collected, not thrown)
  const mem = new Map()
  const lineMap = new Map()      // address -> source line
  for (const r of records) {
    try {
      if (r.type === 'instr') {
        isa.encode(r.isaName, r.build(symbols, r.addr)).forEach((b, k) => mem.set(r.addr + k, b))
        lineMap.set(r.addr, r.line)
      } else if (r.type === 'data') {
        let p = r.addr
        for (const it of r.items) { let v = resolve(it, symbols); for (let b = 0; b < r.width; b++) { mem.set(p++, v & 0xff); v >>= 8 } }
        lineMap.set(r.addr, r.line)
      } else if (r.type === 'incbin') {
        let p = r.addr
        for (const b of r.bytes) mem.set(p++, b & 0xff)
        lineMap.set(r.addr, r.line)
      }
    } catch (e) { err(r.line, e.message) }
  }

  if (errors.length) {
    const body = errors.sort((a, b) => a.line - b.line)
      .map(e => `  line ${e.line}: ${e.msg}\n    > ${e.src}`).join('\n')
    throw new Error(`assembly failed (${errors.length} error${errors.length > 1 ? 's' : ''}):\n${body}`)
  }

  const image = new Uint8Array(Math.max(0, hi - lo))
  for (const [a, b] of mem) image[a - lo] = b
  const lineAddrs = new Map()    // source line -> first address (breakpoints by line)
  for (const [a, l] of lineMap) if (!lineAddrs.has(l)) lineAddrs.set(l, a)
  return { origin: lo, size: image.length, image, symbols, lineMap, lineAddrs }
}

module.exports = { assemble, resolve }

};
__mods["cpu/core"]=function(module,exports,require){
'use strict'
// CastlePalm CPU core v0 — deterministic fetch/decode/execute for Candidate A.
//
// Flat 24-bit little-endian bus with the docs/MEMORY_MAP.md regions. MMIO and the PPU
// port window are dispatched to a pluggable bus object (wired to the PPU + input
// register later); unmapped reads return 0, ROM writes are ignored. Provisional,
// no cycle table yet (step() counts 1 per instruction).

const isa = require('./isa.js')
const { VECTOR_BASE, vectorAddr } = isa

const s8 = v => (v << 24) >> 24
const s16 = v => (v << 16) >> 16
const m16 = v => v & 0xffff
const m24 = v => v & 0xffffff

// status-register bit positions (for interrupt save/restore)
const FZ = 1, FN = 2, FC = 4, FV = 8, FI = 16

class CastlePalmCPU {
  constructor({ rom = new Uint8Array(0), romBase = 0x300000, mmio = null } = {}) {
    this.rom = rom; this.romBase = romBase
    this.mmio = mmio                       // { read(addr)->byte, write(addr,byte) }
    this.ram = new Uint8Array(0x100000)    // $000000-$0FFFFF work RAM (+reserved)
    this.save = new Uint8Array(0x8000)     // $200000-$207FFF
    this.R = new Uint16Array(8)
    this.A = [0, 0, 0, 0]                   // 24-bit address registers
    this.F = { z: false, n: false, c: false, v: false }
    this.reset()
  }

  reset() {
    this.PC = this.read24(VECTOR_BASE)      // reset vector
    this.SP = 0x00ff00
    this.A = [0, 0, 0, 0]
    this.R.fill(0)
    this.F = { z: false, n: false, c: false, v: false }
    this.ie = false; this.halted = false; this.waiting = false
    this.steps = 0
  }

  // ---- bus ----
  read8(a) {
    a = m24(a)
    if (a < 0x100000) return this.ram[a]
    if (a < 0x200000) return this.mmio ? this.mmio.read(a) & 0xff : 0  // MMIO + PPU + audio + reserved devices
    if (a >= 0x200000 && a < 0x208000) return this.save[a - 0x200000]
    if (a >= this.romBase && a < this.romBase + this.rom.length) return this.rom[a - this.romBase]
    return 0
  }
  write8(a, v) {
    a = m24(a); v &= 0xff
    if (a < 0x100000) { this.ram[a] = v; return }
    if (a < 0x200000) { if (this.mmio) this.mmio.write(a, v); return }  // MMIO + PPU + audio + reserved devices
    if (a >= 0x200000 && a < 0x208000) { this.save[a - 0x200000] = v; return }
    // ROM and unmapped: ignored
  }
  read16(a) { return this.read8(a) | (this.read8(a + 1) << 8) }
  read24(a) { return this.read16(a) | (this.read8(a + 2) << 16) }
  write16(a, v) { this.write8(a, v); this.write8(a + 1, v >> 8) }
  write24(a, v) { this.write16(a, v); this.write8(a + 2, v >> 16) }

  // ---- stack ----
  push16(v) { this.SP = m24(this.SP - 2); this.write16(this.SP, v) }
  pop16() { const v = this.read16(this.SP); this.SP = m24(this.SP + 2); return v }
  push24(v) { this.SP = m24(this.SP - 4); this.write24(this.SP, v) }   // 4-byte aligned slot
  pop24() { const v = this.read24(this.SP); this.SP = m24(this.SP + 4); return v }

  // ---- flags ----
  setZN(r) { this.F.z = (r & 0xffff) === 0; this.F.n = (r & 0x8000) !== 0 }
  add16(a, b) { const r = a + b; this.F.c = r > 0xffff; const rr = r & 0xffff; this.F.v = (~(a ^ b) & (a ^ rr) & 0x8000) !== 0; this.setZN(rr); return rr }
  sub16(a, b) { const r = a - b; this.F.c = a >= b; const rr = r & 0xffff; this.F.v = ((a ^ b) & (a ^ rr) & 0x8000) !== 0; this.setZN(rr); return rr }
  adc16(a, b) { return this.add16(a, b + (this.F.c ? 1 : 0)) }
  sbc16(a, b) { return this.sub16(a, b + (this.F.c ? 0 : 1)) }
  logic(r) { r &= 0xffff; this.setZN(r); this.F.v = false; return r }
  packStatus() { const f = this.F; return (f.z ? FZ : 0) | (f.n ? FN : 0) | (f.c ? FC : 0) | (f.v ? FV : 0) | (this.ie ? FI : 0) }
  loadStatus(s) { this.F = { z: !!(s & FZ), n: !!(s & FN), c: !!(s & FC), v: !!(s & FV) }; this.ie = !!(s & FI) }

  cond(name) {
    const f = this.F
    switch (name) {
      case 'BEQ': return f.z; case 'BNE': return !f.z
      case 'BCS': return f.c; case 'BCC': return !f.c
      case 'BMI': return f.n; case 'BPL': return !f.n
      case 'BVS': return f.v; case 'BVC': return !f.v
      case 'BLT': return f.n !== f.v; case 'BGE': return f.n === f.v
      case 'BGT': return !f.z && (f.n === f.v); case 'BLE': return f.z || (f.n !== f.v)
      case 'BHI': return f.c && !f.z; case 'BLS': return !f.c || f.z
    }
    return false
  }

  // raise an interrupt (used once the PPU/timers are wired). Returns whether taken.
  interrupt(name) {
    if (!this.ie) return false
    this.push16(this.packStatus()); this.push24(this.PC)
    this.ie = false; this.waiting = false; this.halted = false
    this.PC = this.read24(vectorAddr(name))
    return true
  }

  // Decode the instruction at PC into a { name, opcode, values, length } object.
  // Retained for tooling/introspection (the disassembler/debugger and tests use
  // isa.decode directly); step() no longer calls this, so the allocation it does
  // is off the hot path. The hot loop reads operands inline (see step()).
  fetch() {
    const op = this.read8(this.PC), len = isa.lengthOf(op)
    const buf = new Uint8Array(len)
    for (let i = 0; i < len; i++) buf[i] = this.read8(m24(this.PC + i))
    return isa.decode(buf, 0)
  }

  // Allocation-free fetch/decode/execute. Operands are read inline from the bus
  // (no Uint8Array, no decode object, no `values` array, no per-step register
  // unpack arrays) and dispatch is on the numeric opcode byte (a dense integer
  // jump) instead of the decoded string `name`. Semantics — operand order,
  // sign-extension (s8/s16), flag effects, shift carry reads, and PC math — are
  // byte-identical to the decode-based reference; tests/determinism.test.js guards
  // that against every future edit.
  step() {
    if (this.halted || this.waiting) return 0
    const at = this.PC
    const R = this.R, A = this.A, F = this.F
    const op = this.read8(at)
    let p = m24(at + 1)            // cursor over operands; advances as we read

    // inline operand readers (advance p, no allocation). The regs byte packs the
    // first operand in the hi nibble (x/a) and the second in the lo nibble (y/m/b).
    let rb = 0, x = 0, y = 0
    const readRegs = () => { rb = this.read8(p); p = m24(p + 1); x = (rb >> 4) & 0xf; y = rb & 0xf }
    const readImm8 = () => { const t = this.read8(p); p = m24(p + 1); return t }
    const readImm16 = () => { const t = this.read16(p); p = m24(p + 2); return t }
    const readAddr24 = () => { const t = this.read24(p); p = m24(p + 3); return t }

    let next                       // set only by control flow; otherwise = address after operands
    switch (op) {
      case 0x00: break                                                            // NOP
      case 0x01: { readRegs(); const i = readImm16(); R[x] = m16(i); break }       // MOV.i
      case 0x02: { readRegs(); const i = readImm8(); R[x] = i & 0xff; break }      // MOV.b
      case 0x03: { readRegs(); R[x] = R[y]; break }                               // MOV.r
      case 0x04: { readRegs(); const a = readAddr24(); A[x] = m24(a); break }      // LDA
      case 0x05: { readRegs(); A[x] = this.read24(A[y]); break }                  // LDADDR
      case 0x06: { readRegs(); A[x] = A[y]; break }                              // MOVA

      case 0x10: { readRegs(); R[x] = this.read16(A[y]); break }                                   // LDW.ind
      case 0x11: { readRegs(); const d = readImm8(); R[x] = this.read16(m24(A[y] + s8(d))); break } // LDW.dsp
      case 0x12: { readRegs(); const m = (this.read8(p) >> 4) & 0xf; p = m24(p + 1); R[x] = this.read16(m24(A[y] + s16(R[m]))); break } // LDW.idx
      case 0x13: { readRegs(); const a = readAddr24(); R[x] = this.read16(a); break }               // LDW.abs
      case 0x14: { readRegs(); R[x] = this.read8(A[y]); break }                                     // LDB.ind
      case 0x15: { readRegs(); const d = readImm8(); R[x] = this.read8(m24(A[y] + s8(d))); break }  // LDB.dsp
      case 0x16: { readRegs(); const m = (this.read8(p) >> 4) & 0xf; p = m24(p + 1); R[x] = this.read8(m24(A[y] + s16(R[m]))); break } // LDB.idx
      case 0x17: { readRegs(); const a = readAddr24(); R[x] = this.read8(a); break }                // LDB.abs
      case 0x18: { readRegs(); this.write16(A[y], R[x]); break }                                    // STW.ind
      case 0x19: { readRegs(); const d = readImm8(); this.write16(m24(A[y] + s8(d)), R[x]); break } // STW.dsp
      case 0x1a: { readRegs(); const m = (this.read8(p) >> 4) & 0xf; p = m24(p + 1); this.write16(m24(A[y] + s16(R[m])), R[x]); break } // STW.idx
      case 0x1b: { readRegs(); const a = readAddr24(); this.write16(a, R[x]); break }               // STW.abs
      case 0x1c: { readRegs(); this.write8(A[y], R[x]); break }                                     // STB.ind
      case 0x1d: { readRegs(); const d = readImm8(); this.write8(m24(A[y] + s8(d)), R[x]); break }  // STB.dsp
      case 0x1e: { readRegs(); const m = (this.read8(p) >> 4) & 0xf; p = m24(p + 1); this.write8(m24(A[y] + s16(R[m])), R[x]); break } // STB.idx
      case 0x1f: { readRegs(); const a = readAddr24(); this.write8(a, R[x]); break }                // STB.abs

      case 0x30: { readRegs(); R[x] = this.add16(R[x], R[y]); break }                  // ADD.r
      case 0x31: { readRegs(); const i = readImm16(); R[x] = this.add16(R[x], m16(i)); break } // ADD.i
      case 0x32: { readRegs(); R[x] = this.sub16(R[x], R[y]); break }                  // SUB.r
      case 0x33: { readRegs(); const i = readImm16(); R[x] = this.sub16(R[x], m16(i)); break } // SUB.i
      case 0x34: { readRegs(); R[x] = this.adc16(R[x], R[y]); break }                  // ADC.r
      case 0x35: { readRegs(); R[x] = this.sbc16(R[x], R[y]); break }                  // SBC.r
      case 0x36: { readRegs(); this.sub16(R[x], R[y]); break }                         // CMP.r
      case 0x37: { readRegs(); const i = readImm16(); this.sub16(R[x], m16(i)); break }// CMP.i
      case 0x38: { readRegs(); R[x] = this.sub16(0, R[x]); break }                     // NEG
      case 0x39: { readRegs(); R[x] = this.logic(R[x] & R[y]); break }                 // AND.r
      case 0x3a: { readRegs(); const i = readImm16(); R[x] = this.logic(R[x] & m16(i)); break } // AND.i
      case 0x3b: { readRegs(); R[x] = this.logic(R[x] | R[y]); break }                 // OR.r
      case 0x3c: { readRegs(); const i = readImm16(); R[x] = this.logic(R[x] | m16(i)); break } // OR.i
      case 0x3d: { readRegs(); R[x] = this.logic(R[x] ^ R[y]); break }                 // XOR.r
      case 0x3e: { readRegs(); const i = readImm16(); R[x] = this.logic(R[x] ^ m16(i)); break } // XOR.i
      case 0x3f: { readRegs(); R[x] = this.logic(~R[x]); break }                       // NOT
      case 0x40: { readRegs(); this.logic(R[x] & R[y]); break }                        // BIT.r
      case 0x41: { readRegs(); this.logic(R[x]); break }                              // TST
      case 0x42: { readRegs(); const n = readImm8() & 15; F.c = n ? !!(R[x] & (1 << (16 - n))) : F.c; R[x] = this.logic(R[x] << n); break }  // SHL.i
      case 0x43: { readRegs(); const n = readImm8() & 15; F.c = n ? !!(R[x] & (1 << (n - 1))) : F.c; R[x] = this.logic(R[x] >>> n); break }  // SHR.i
      case 0x44: { readRegs(); const n = readImm8() & 15; F.c = n ? !!(R[x] & (1 << (n - 1))) : F.c; R[x] = this.logic(s16(R[x]) >> n); break } // SAR.i
      case 0x45: { readRegs(); R[x] = this.logic(R[x] << (R[y] & 15)); break }         // SHL.r
      case 0x46: { readRegs(); R[x] = this.logic(R[x] >>> (R[y] & 15)); break }        // SHR.r
      case 0x47: { readRegs(); R[x] = this.logic(s16(R[x]) >> (R[y] & 15)); break }    // SAR.r

      case 0x48: { readRegs(); const i = readImm16(); A[x] = m24(A[x] + s16(i)); break } // ADDA.i
      case 0x49: { readRegs(); A[x] = m24(A[x] + s16(R[y])); break }                     // ADDA.r
      case 0x4a: { readRegs(); A[x] = m24(A[x] + 1); break }                             // INCA
      case 0x4b: { readRegs(); A[x] = m24(A[x] - 1); break }                             // DECA
      case 0x4c: { readRegs(); F.z = A[x] === A[y]; F.c = A[x] >= A[y]; break }          // CMPA

      // branch displacement base = address after the operand (cursor p)
      case 0x50: { const d = readImm16(); next = m24(m24(p) + s16(d)); break }                       // BRA (disp16)
      case 0x51: { const d = readImm8(); next = F.z ? m24(p + s8(d)) : m24(p); break }               // BEQ
      case 0x52: { const d = readImm8(); next = !F.z ? m24(p + s8(d)) : m24(p); break }              // BNE
      case 0x53: { const d = readImm8(); next = F.c ? m24(p + s8(d)) : m24(p); break }               // BCS
      case 0x54: { const d = readImm8(); next = !F.c ? m24(p + s8(d)) : m24(p); break }              // BCC
      case 0x55: { const d = readImm8(); next = F.n ? m24(p + s8(d)) : m24(p); break }               // BMI
      case 0x56: { const d = readImm8(); next = !F.n ? m24(p + s8(d)) : m24(p); break }              // BPL
      case 0x57: { const d = readImm8(); next = F.v ? m24(p + s8(d)) : m24(p); break }               // BVS
      case 0x58: { const d = readImm8(); next = !F.v ? m24(p + s8(d)) : m24(p); break }              // BVC
      case 0x59: { const d = readImm8(); next = (F.n !== F.v) ? m24(p + s8(d)) : m24(p); break }     // BLT
      case 0x5a: { const d = readImm8(); next = (F.n === F.v) ? m24(p + s8(d)) : m24(p); break }     // BGE
      case 0x5b: { const d = readImm8(); next = (!F.z && (F.n === F.v)) ? m24(p + s8(d)) : m24(p); break } // BGT
      case 0x5c: { const d = readImm8(); next = (F.z || (F.n !== F.v)) ? m24(p + s8(d)) : m24(p); break }  // BLE
      case 0x5d: { const d = readImm8(); next = (F.c && !F.z) ? m24(p + s8(d)) : m24(p); break }     // BHI
      case 0x5e: { const d = readImm8(); next = (!F.c || F.z) ? m24(p + s8(d)) : m24(p); break }     // BLS

      case 0x60: { const a = readAddr24(); next = a; break }                            // JMP.abs
      case 0x61: { readRegs(); next = A[x]; break }                                     // JMP.ind
      case 0x62: { const a = readAddr24(); this.push24(m24(p)); next = a; break }        // CALL.abs
      case 0x63: { readRegs(); this.push24(m24(p)); next = A[x]; break }                 // CALL.ind
      case 0x64: { next = this.pop24(); break }                                          // RET

      case 0x70: { readRegs(); this.push16(R[x]); break }                               // PUSH
      case 0x71: { readRegs(); R[x] = this.pop16(); break }                             // POP
      case 0x72: { readRegs(); this.push24(A[x]); break }                              // PUSHA
      case 0x73: { readRegs(); A[x] = this.pop24(); break }                            // POPA
      case 0x74: { next = this.pop24(); this.loadStatus(this.pop16()); break }           // IRET

      case 0x75: this.halted = true; next = at; break                                   // HALT (re-executes its own address)
      case 0x76: this.waiting = true; break                                             // WAIT (advances; frame loop clears `waiting` at vblank)
      case 0x77: this.ie = true; break                                                  // EI
      case 0x78: this.ie = false; break                                                 // DI
      default: throw new Error('unimplemented opcode 0x' + op.toString(16))
    }

    this.PC = (next === undefined) ? m24(p) : next
    this.steps++
    return 1
  }

  run(maxSteps = 1e7) { let n = 0; while (n < maxSteps && !this.halted && !this.waiting) { this.step(); n++ } return n }
}

module.exports = { CastlePalmCPU, VECTOR_BASE }

};
__mods["cpu/cart"]=function(module,exports,require){
'use strict'
// CastlePalm cartridge format v0 (provisional).
//
// A 32-byte little-endian header followed by the ROM image. Deliberately minimal;
// relocation and richer save metadata are deferred (docs/DECISIONS.md).
//
//   off  size  field
//   0    4     magic "CPLM"
//   4    1     format version (1)
//   5    1     flags (bit0 = has save RAM)
//   6    2     reserved (0)
//   8    16    title (ASCII, null-padded)
//   24   3     load base (24-bit; where the ROM maps — normally $300000)
//   27   1     reserved (0)
//   28   4     ROM length in bytes
//   32   ...   ROM image

const { assemble } = require('./asm.js')
const { CastlePalmCPU } = require('./core.js')

const MAGIC = 'CPLM'
const HEADER = 32
const FLAG_SAVE = 1

function makeCart({ image, origin = 0x300000, title = '', hasSave = false }) {
  const out = new Uint8Array(HEADER + image.length)
  const dv = new DataView(out.buffer)
  for (let i = 0; i < 4; i++) out[i] = MAGIC.charCodeAt(i)
  out[4] = 1
  out[5] = hasSave ? FLAG_SAVE : 0
  for (let i = 0; i < 16 && i < title.length; i++) out[8 + i] = title.charCodeAt(i) & 0x7f
  out[24] = origin & 0xff; out[25] = (origin >> 8) & 0xff; out[26] = (origin >> 16) & 0xff
  dv.setUint32(28, image.length, true)
  out.set(image, HEADER)
  return out
}

function parseCart(bytes) {
  if (bytes.length < HEADER) throw new Error('cartridge too small')
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])
  if (magic !== MAGIC) throw new Error('bad cartridge magic "' + magic + '"')
  const version = bytes[4]
  if (version !== 1) throw new Error('unsupported cartridge version ' + version)
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let title = ''
  for (let i = 0; i < 16; i++) { const c = bytes[8 + i]; if (c) title += String.fromCharCode(c) }
  const loadBase = bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)
  const romLength = dv.getUint32(28, true)
  if (HEADER + romLength > bytes.length) throw new Error('cartridge ROM length exceeds file')
  return {
    version, title, loadBase, hasSave: !!(bytes[5] & FLAG_SAVE),
    rom: bytes.slice(HEADER, HEADER + romLength),
  }
}

// assemble .asm source straight into a cartridge image
function buildCart(source, { title = '', readBinary = null } = {}) {
  const r = assemble(source, { readBinary })
  return makeCart({ image: r.image, origin: r.origin, title })
}

// parse a cartridge and return a CPU ready to run it
function boot(cartBytes, { mmio = null } = {}) {
  const cart = parseCart(cartBytes)
  const cpu = new CastlePalmCPU({ rom: cart.rom, romBase: cart.loadBase, mmio })
  return { cpu, cart }
}

module.exports = { makeCart, parseCart, buildCart, boot, MAGIC, HEADER }

};
__mods["graphics-spike/ppu"]=function(module,exports,require){
'use strict'

class FantasyPPU {
  static WIDTH=320
  static HEIGHT=224
  static VRAM_SIZE=128*1024
  static TILE_BYTES=32
  static TILE_COUNT=2048
  static MAP_WIDTH=64
  static MAP_HEIGHT=64
  static MAP_BYTES=64*64*4
  static MAP_OFFSETS=[0x10000,0x14000]
  static SPRITE_COUNT=128
  static SPRITES_PER_LINE=32

  constructor(){
    this.vram=new Uint8Array(FantasyPPU.VRAM_SIZE)
    this.view=new DataView(this.vram.buffer)
    this.palette=new Uint32Array(256)
    this.layers=[this.makeLayer(0),this.makeLayer(1)]
    this.sprites=Array.from({length:FantasyPPU.SPRITE_COUNT},()=>this.makeSprite())
    this.affineLines=Array(FantasyPPU.HEIGHT).fill(null)
    this.metrics={maxSpritesOnLine:0,droppedSprites:0,visibleSprites:0}
    this.setPalette(0,0,0,0)
  }

  makeLayer(index){
    return {index,enabled:true,scrollX:0,scrollY:0,basePriority:index*2,affine:false}
  }

  makeSprite(){
    return {x:0,y:0,tile:0,palette:0,size:8,priority:3,hflip:false,vflip:false,enabled:false}
  }

  reset(){
    this.vram.fill(0)
    this.palette.fill(0)
    this.layers=[this.makeLayer(0),this.makeLayer(1)]
    this.sprites=Array.from({length:FantasyPPU.SPRITE_COUNT},()=>this.makeSprite())
    this.affineLines.fill(null)
    this.setPalette(0,0,0,0)
  }

  setPalette(index,r,g,b){
    if(index<0||index>255)throw new RangeError('palette index must be 0..255')
    this.palette[index]=(0xff000000|((b&255)<<16)|((g&255)<<8)|(r&255))>>>0
  }

  setTile(index,pixels){
    if(index<0||index>=FantasyPPU.TILE_COUNT)throw new RangeError('tile index out of range')
    if(!pixels||pixels.length!==64)throw new RangeError('tile requires 64 pixels')
    const base=index*FantasyPPU.TILE_BYTES
    for(let i=0;i<64;i+=2)this.vram[base+(i>>1)]=((pixels[i]&15)<<4)|(pixels[i+1]&15)
  }

  tilePixel(index,x,y){
    if(index<0||index>=FantasyPPU.TILE_COUNT)return 0
    const offset=index*FantasyPPU.TILE_BYTES+y*4+(x>>1)
    const packed=this.vram[offset]
    return x&1?packed&15:packed>>4
  }

  encodeMapEntry({tile=0,palette=0,hflip=false,vflip=false,priority=0}={}){
    return ((tile&0x7ff)|((palette&15)<<11)|(hflip?1<<15:0)|(vflip?1<<16:0)|((priority&3)<<17))>>>0
  }

  setMapEntry(layer,x,y,entry){
    this.assertLayer(layer)
    const offset=this.mapOffset(layer,x,y)
    this.view.setUint32(offset,this.encodeMapEntry(entry),true)
  }

  getMapEntry(layer,x,y){
    this.assertLayer(layer)
    const raw=this.view.getUint32(this.mapOffset(layer,x,y),true)
    return {
      tile:raw&0x7ff,
      palette:(raw>>>11)&15,
      hflip:Boolean(raw&(1<<15)),
      vflip:Boolean(raw&(1<<16)),
      priority:(raw>>>17)&3
    }
  }

  mapOffset(layer,x,y){
    x=((x%FantasyPPU.MAP_WIDTH)+FantasyPPU.MAP_WIDTH)%FantasyPPU.MAP_WIDTH
    y=((y%FantasyPPU.MAP_HEIGHT)+FantasyPPU.MAP_HEIGHT)%FantasyPPU.MAP_HEIGHT
    return FantasyPPU.MAP_OFFSETS[layer]+(y*FantasyPPU.MAP_WIDTH+x)*4
  }

  assertLayer(layer){
    if(layer!==0&&layer!==1)throw new RangeError('layer must be 0 or 1')
  }

  setSprite(index,values){
    if(index<0||index>=FantasyPPU.SPRITE_COUNT)throw new RangeError('sprite index out of range')
    const next={...this.makeSprite(),...values}
    if(![8,16,32,64].includes(next.size))throw new RangeError('sprite size must be 8, 16, 32, or 64')
    this.sprites[index]=next
  }

  setAffineLine(y,{startX,startY,dx,dy}){
    if(y<0||y>=FantasyPPU.HEIGHT)throw new RangeError('scanline out of range')
    this.affineLines[y]={startX:startX|0,startY:startY|0,dx:dx|0,dy:dy|0}
  }

  clearAffineLines(){
    this.affineLines.fill(null)
  }

  sampleLayer(layerIndex,worldX,worldY){
    const tileX=Math.floor(worldX/8)
    const tileY=Math.floor(worldY/8)
    const entry=this.getMapEntry(layerIndex,tileX,tileY)
    let px=((worldX%8)+8)%8
    let py=((worldY%8)+8)%8
    if(entry.hflip)px=7-px
    if(entry.vflip)py=7-py
    const colour=this.tilePixel(entry.tile,px,py)
    if(colour===0)return null
    return {colour:this.palette[(entry.palette<<4)|colour],priority:this.layers[layerIndex].basePriority+entry.priority}
  }

  drawLayerLine(layerIndex,y,pixels,priorities){
    const layer=this.layers[layerIndex]
    if(!layer.enabled)return
    const affine=layer.affine?this.affineLines[y]:null
    if(layer.affine&&!affine)return
    let sx=affine?.startX||0,sy=affine?.startY||0
    for(let x=0;x<FantasyPPU.WIDTH;x++){
      const worldX=layer.affine?sx>>16:x+layer.scrollX
      const worldY=layer.affine?sy>>16:y+layer.scrollY
      const sample=this.sampleLayer(layerIndex,worldX,worldY)
      const out=y*FantasyPPU.WIDTH+x
      if(sample&&sample.priority>=priorities[out]){
        pixels[out]=sample.colour
        priorities[out]=sample.priority
      }
      if(layer.affine){sx=(sx+affine.dx)|0;sy=(sy+affine.dy)|0}
    }
  }

  spritePixel(sprite,localX,localY){
    if(sprite.hflip)localX=sprite.size-1-localX
    if(sprite.vflip)localY=sprite.size-1-localY
    const tilesWide=sprite.size>>3
    const tile=sprite.tile+(localY>>3)*tilesWide+(localX>>3)
    return this.tilePixel(tile,localX&7,localY&7)
  }

  drawSpritesLine(y,pixels,priorities){
    const accepted=[]
    let dropped=0
    for(let i=0;i<this.sprites.length;i++){
      const s=this.sprites[i]
      if(!s.enabled||y<s.y||y>=s.y+s.size||s.x>=FantasyPPU.WIDTH||s.x+s.size<=0)continue
      this._seen.add(i)
      if(accepted.length<FantasyPPU.SPRITES_PER_LINE)accepted.push({s,index:i})
      else dropped++
    }
    if(accepted.length>this.metrics.maxSpritesOnLine)this.metrics.maxSpritesOnLine=accepted.length
    this.metrics.droppedSprites+=dropped
    for(let n=accepted.length-1;n>=0;n--){
      const {s}=accepted[n]
      const localY=y-s.y
      for(let localX=0;localX<s.size;localX++){
        const x=s.x+localX
        if(x<0||x>=FantasyPPU.WIDTH)continue
        const colour=this.spritePixel(s,localX,localY)
        if(colour===0)continue
        const out=y*FantasyPPU.WIDTH+x
        if(s.priority>=priorities[out]){
          pixels[out]=this.palette[((s.palette&15)<<4)|colour]
          priorities[out]=s.priority
        }
      }
    }
    this.metrics.visibleSprites=this._seen.size
  }

  // reset per-frame sprite metrics (call once before rendering a frame line-by-line)
  beginFrame(){
    this._seen=new Set()
    this.metrics={maxSpritesOnLine:0,droppedSprites:0,visibleSprites:0}
  }

  // render a single scanline with the CURRENT register/scroll state (enables raster)
  renderLine(y,pixels,priorities){
    const bd=this.palette[0],base=y*FantasyPPU.WIDTH
    for(let x=0;x<FantasyPPU.WIDTH;x++){pixels[base+x]=bd;priorities[base+x]=-1}
    this.drawLayerLine(0,y,pixels,priorities)
    this.drawLayerLine(1,y,pixels,priorities)
    this.drawSpritesLine(y,pixels,priorities)
  }

  render(){
    const pixels=new Uint32Array(FantasyPPU.WIDTH*FantasyPPU.HEIGHT)
    const priorities=new Int8Array(pixels.length)
    this.beginFrame()
    for(let y=0;y<FantasyPPU.HEIGHT;y++)this.renderLine(y,pixels,priorities)
    return pixels
  }
}

if(typeof module!=='undefined')module.exports={FantasyPPU}


};
__mods["apu"]=function(module,exports,require){
'use strict'
// CastlePalm APU v0 (provisional) — 2 square channels + 1 noise channel.
//
// Memory-mapped (system.js routes the audio register block to it), deterministic
// sample generation. The host shell plays the per-frame buffer via Web Audio;
// the core stays headless and deterministic. Channel/register layout is
// provisional (docs/MMIO_V0.md, docs/DECISIONS.md). Square channels are 50% duty;
// a square toggles its sign every `period` samples, so freq = RATE / (2*period).

const RATE = 48000
const SAMPLES_PER_FRAME = 800   // RATE / 60

class CastlePalmAPU {
  constructor() { this.rate = RATE; this.reset() }
  reset() {
    this.sq = [{ period: 0, vol: 0, on: false, cnt: 0, sign: 1 },
               { period: 0, vol: 0, on: false, cnt: 0, sign: 1 }]
    this.noise = { period: 0, vol: 0, on: false, cnt: 0, lfsr: 0x7fff }
  }

  setSquare(i, field, v) {
    const c = this.sq[i]
    if (field === 'periodLo') c.period = (c.period & 0xff00) | (v & 0xff)
    else if (field === 'periodHi') c.period = (c.period & 0x00ff) | ((v & 0xff) << 8)
    else if (field === 'vol') c.vol = v & 0x0f
    else if (field === 'ctrl') c.on = !!(v & 1)
  }
  setNoise(field, v) {
    const n = this.noise
    if (field === 'periodLo') n.period = (n.period & 0xff00) | (v & 0xff)
    else if (field === 'periodHi') n.period = (n.period & 0x00ff) | ((v & 0xff) << 8)
    else if (field === 'vol') n.vol = v & 0x0f
    else if (field === 'ctrl') n.on = !!(v & 1)
  }

  // generate n mono samples in [-1,1] (Float32), advancing channel state.
  generate(n = SAMPLES_PER_FRAME) {
    const out = new Float32Array(n)
    for (let s = 0; s < n; s++) {
      let acc = 0
      for (const c of this.sq) {
        if (c.on && c.period > 0) {
          if (++c.cnt >= c.period) { c.cnt = 0; c.sign = -c.sign }
          acc += c.sign * c.vol
        }
      }
      const no = this.noise
      if (no.on && no.period > 0) {
        if (++no.cnt >= no.period) {
          no.cnt = 0
          const fb = (no.lfsr ^ (no.lfsr >> 1)) & 1
          no.lfsr = (no.lfsr >> 1) | (fb << 14)
        }
        acc += (no.lfsr & 1 ? 1 : -1) * no.vol
      }
      out[s] = acc / 64   // 3 channels * 15 max = 45 -> stays under 1.0
    }
    return out
  }
}

module.exports = { CastlePalmAPU, AUDIO_RATE: RATE, SAMPLES_PER_FRAME }

};
__mods["system"]=function(module,exports,require){
'use strict'
// CastlePalm system v0.2 — composes the CPU core, the PPU, the APU, and input,
// routes the CPU's MMIO ports onto them, and drives a timed scanline frame with
// vblank/hblank interrupts and a DMA channel. Provisional register map
// (docs/MMIO_V0.md); timing follows PPU_ARCHITECTURE_V0_2 at scanline granularity.
//
// v0 note: rendering is still frame-at-once (the PPU draws the whole frame after
// the scan timeline). Per-scanline rasterisation (so hblank-IRQ register changes
// show as splits) is the next increment; the timing/IRQ/DMA infrastructure is here.

const { boot } = require('./cpu/cart.js')
const { FantasyPPU } = require('./graphics-spike/ppu.js')
const { CastlePalmAPU, AUDIO_RATE } = require('./apu.js')

const LINES = 262, VISIBLE_LINES = 224       // 512 ticks/line; vblank at line 224

const REG = {
  INPUT: 0x100000,        // u16 controller word, player 1 (read)
  INPUT1: 0x100002,       // u16 controller word, player 2 (read)
  IRQ_FLAGS: 0x100010,    // read: bit0 vblank, bit1 hblank; write-one-to-clear
  IRQ_ENABLE: 0x100012,   // bit0 vblank, bit1 hblank
  FRAME: 0x100014,        // u16 frame counter (read)
  DMA_SRC: 0x100020,      // 3 bytes: 24-bit source in CPU space
  DMA_DST: 0x100024,      // u16 destination offset within the dest space
  DMA_LEN: 0x100028,      // u16 byte length
  DMA_MODE: 0x10002a,     // u8: bits0-1 space (0 VRAM, 1 OAM, 2 palette, 3 affine table), bit4 fill
  DMA_FILL: 0x10002c,     // u16 fill value
  DMA_CTRL: 0x10002e,     // u8: bit0 start
  VRAM_ADDR: 0x101000,    // 3 bytes: 17-bit VRAM pointer
  VRAM_DATA: 0x101004,    // 2-byte port: vram[ptr++]
  PAL_INDEX: 0x101008,    // u8 palette entry index
  PAL_DATA: 0x10100a,     // 2-byte port: RGB555 -> palette[index++]
  OAM_INDEX: 0x10100c,    // u16 byte offset into OAM
  OAM_DATA: 0x10100e,     // 1-byte port: oam[idx++]
  BG0_SX: 0x101010, BG0_SY: 0x101012, BG1_SX: 0x101014, BG1_SY: 0x101016,
  PPU_CTRL: 0x101018,     // u16: bit0 BG0 enable, bit1 BG1 enable
  PPU_SCANLINE: 0x10101a, // u16 current scanline (read)
  AFFINE_CTRL: 0x10101c,  // u16: bit0 enable, bit1 layer (0=BG0,1=BG1), bit2 page (reserved, single-buffered in v0.2)
  AFFINE_FIRST: 0x10101e, // u16 first affine scanline (affine-table row 0 maps to this line)
  AFFINE_LAST: 0x101020,  // u16 last affine scanline (inclusive; informational in v0.2)
}
const c5to8 = c => (c << 3) | (c >> 2)

class System {
  constructor(cartBytes) {
    this.ppu = new FantasyPPU()
    this.inputs = [0, 0]
    this.frame = 0
    this.scanline = 0
    this.vblank = false
    this.irqFlags = 0          // bit0 vblank, bit1 hblank
    this.irqEnable = 0
    this.va = 0; this.pi = 0; this.pl = 0; this.oi = 0
    this.scroll = [0, 0, 0, 0]
    this.affCtrl = 0; this.affFirst = 0; this.affLast = 0   // affine (Mode-7) layer state
    this.oam = new Uint8Array(1024)
    this.dma = { src: 0, dst: 0, len: 0, mode: 0, fill: 0 }
    this.dmaBytes = 0
    this.apu = new CastlePalmAPU()
    this.audioRate = AUDIO_RATE
    this.audio = null
    const mmio = { read: a => this.read(a), write: (a, b) => this.write(a, b) }
    const r = boot(cartBytes, { mmio })
    this.cpu = r.cpu; this.cart = r.cart
    this.framebuffer = null
  }

  read(a) {
    switch (a) {
      case REG.INPUT: return this.inputs[0] & 0xff
      case REG.INPUT + 1: return (this.inputs[0] >> 8) & 0xff
      case REG.INPUT1: return this.inputs[1] & 0xff
      case REG.INPUT1 + 1: return (this.inputs[1] >> 8) & 0xff
      case REG.IRQ_FLAGS: return this.irqFlags & 0xff
      case REG.IRQ_FLAGS + 1: return (this.irqFlags >> 8) & 0xff
      case REG.FRAME: return this.frame & 0xff
      case REG.FRAME + 1: return (this.frame >> 8) & 0xff
      case REG.PPU_SCANLINE: return this.scanline & 0xff
      case REG.PPU_SCANLINE + 1: return (this.scanline >> 8) & 0xff
      case REG.VRAM_DATA: case REG.VRAM_DATA + 1: { const v = this.ppu.vram[this.va & 0x1ffff]; this.va++; return v }
    }
    return 0
  }

  write(a, b) {
    switch (a) {
      case REG.VRAM_ADDR: this.va = (this.va & 0x1ff00) | b; return
      case REG.VRAM_ADDR + 1: this.va = (this.va & 0x100ff) | (b << 8); return
      case REG.VRAM_ADDR + 2: this.va = (this.va & 0x0ffff) | ((b & 1) << 16); return
      case REG.VRAM_DATA: case REG.VRAM_DATA + 1: this.ppu.vram[this.va & 0x1ffff] = b; this.va++; return
      case REG.PAL_INDEX: this.pi = b & 0xff; return
      case REG.PAL_DATA: this.pl = (this.pl & 0xff00) | b; return
      case REG.PAL_DATA + 1: { this.pl = (this.pl & 0x00ff) | (b << 8); const v = this.pl; this.ppu.setPalette(this.pi, c5to8(v & 31), c5to8((v >> 5) & 31), c5to8((v >> 10) & 31)); this.pi = (this.pi + 1) & 0xff; return }
      case REG.OAM_INDEX: this.oi = (this.oi & 0xff00) | b; return
      case REG.OAM_INDEX + 1: this.oi = (this.oi & 0x00ff) | (b << 8); return
      case REG.OAM_DATA: this.oam[this.oi & 0x3ff] = b; this.oi++; return
      case REG.IRQ_ENABLE: this.irqEnable = b & 3; return
      case REG.IRQ_FLAGS: this.irqFlags &= ~b; this.vblank = !!(this.irqFlags & 1); return
      case REG.PPU_CTRL: this.ppu.layers[0].enabled = !!(b & 1); this.ppu.layers[1].enabled = !!(b & 2); return
      case REG.AFFINE_CTRL: this.affCtrl = (this.affCtrl & 0xff00) | b; this.applyAffineCtrl(); return
      case REG.AFFINE_CTRL + 1: this.affCtrl = (this.affCtrl & 0x00ff) | (b << 8); this.applyAffineCtrl(); return
      case REG.AFFINE_FIRST: this.affFirst = (this.affFirst & 0xff00) | b; return
      case REG.AFFINE_FIRST + 1: this.affFirst = (this.affFirst & 0x00ff) | (b << 8); return
      case REG.AFFINE_LAST: this.affLast = (this.affLast & 0xff00) | b; return
      case REG.AFFINE_LAST + 1: this.affLast = (this.affLast & 0x00ff) | (b << 8); return
      case REG.DMA_SRC: this.dma.src = (this.dma.src & 0xffff00) | b; return
      case REG.DMA_SRC + 1: this.dma.src = (this.dma.src & 0xff00ff) | (b << 8); return
      case REG.DMA_SRC + 2: this.dma.src = (this.dma.src & 0x00ffff) | (b << 16); return
      case REG.DMA_DST: this.dma.dst = (this.dma.dst & 0xff00) | b; return
      case REG.DMA_DST + 1: this.dma.dst = (this.dma.dst & 0x00ff) | (b << 8); return
      case REG.DMA_LEN: this.dma.len = (this.dma.len & 0xff00) | b; return
      case REG.DMA_LEN + 1: this.dma.len = (this.dma.len & 0x00ff) | (b << 8); return
      case REG.DMA_MODE: this.dma.mode = b; return
      case REG.DMA_FILL: this.dma.fill = (this.dma.fill & 0xff00) | b; return
      case REG.DMA_FILL + 1: this.dma.fill = (this.dma.fill & 0x00ff) | (b << 8); return
      case REG.DMA_CTRL: if (b & 1) this.runDMA(); return
      // audio register block ($102000)
      case 0x102000: this.apu.setSquare(0, 'periodLo', b); return
      case 0x102001: this.apu.setSquare(0, 'periodHi', b); return
      case 0x102002: this.apu.setSquare(0, 'vol', b); return
      case 0x102003: this.apu.setSquare(0, 'ctrl', b); return
      case 0x102004: this.apu.setSquare(1, 'periodLo', b); return
      case 0x102005: this.apu.setSquare(1, 'periodHi', b); return
      case 0x102006: this.apu.setSquare(1, 'vol', b); return
      case 0x102007: this.apu.setSquare(1, 'ctrl', b); return
      case 0x102008: this.apu.setNoise('periodLo', b); return
      case 0x102009: this.apu.setNoise('periodHi', b); return
      case 0x10200a: this.apu.setNoise('vol', b); return
      case 0x10200b: this.apu.setNoise('ctrl', b); return
    }
    // BG scroll: each is a 2-byte signed latch
    for (let i = 0; i < 4; i++) {
      const base = REG.BG0_SX + i * 2
      if (a === base) { this.scroll[i] = (this.scroll[i] & 0xff00) | b; return }
      if (a === base + 1) { this.scroll[i] = (this.scroll[i] & 0x00ff) | (b << 8); return }
    }
  }

  // affine enable/layer select: only the chosen layer samples via affineLines.
  applyAffineCtrl() {
    const en = this.affCtrl & 1, layer = (this.affCtrl >> 1) & 1
    this.ppu.layers[0].affine = !!(en && layer === 0)
    this.ppu.layers[1].affine = !!(en && layer === 1)
  }

  // one DMA transfer: CPU memory -> VRAM / OAM / palette / affine table, or constant fill.
  runDMA() {
    const d = this.dma, space = d.mode & 3, fill = !!(d.mode & 0x10)
    const srcByte = i => fill ? ((i & 1) ? (d.fill >> 8) & 0xff : d.fill & 0xff) : this.cpu.read8((d.src + i) & 0xffffff)
    if (space === 2) {                       // palette: byte pairs -> RGB555 entries
      for (let i = 0; i + 1 < d.len; i += 2) {
        const w = srcByte(i) | (srcByte(i + 1) << 8), e = ((d.dst + i) >> 1) & 0xff
        this.ppu.setPalette(e, c5to8(w & 31), c5to8((w >> 5) & 31), c5to8((w >> 10) & 31))
      }
    } else if (space === 3) {                 // affine table: 16 bytes/line (startX,startY,dx,dy s32 LE)
      const al = this.ppu.affineLines, n = d.len >> 4
      al.fill(null)                            // band starts clean; lines outside it stay transparent
      const s32 = o => (srcByte(o) | (srcByte(o + 1) << 8) | (srcByte(o + 2) << 16) | (srcByte(o + 3) << 24)) | 0
      for (let i = 0; i < n; i++) {
        const y = this.affFirst + i, o = i << 4
        if (y >= 0 && y < al.length) al[y] = { startX: s32(o), startY: s32(o + 4), dx: s32(o + 8), dy: s32(o + 12) }
      }
    } else {
      const buf = space === 1 ? this.oam : this.ppu.vram
      const mask = space === 1 ? 0x3ff : 0x1ffff
      for (let i = 0; i < d.len; i++) buf[(d.dst + i) & mask] = srcByte(i)
    }
    this.dmaBytes = d.len
  }

  // decode the binary OAM (128 x 8 bytes, PPU v0.2 layout) into PPU sprites
  commitOAM() {
    const o = this.oam, s16 = v => (v << 16) >> 16
    for (let i = 0; i < 128; i++) {
      const p = i * 8
      const attr = o[p + 6] | (o[p + 7] << 8)
      this.ppu.setSprite(i, {
        x: s16(o[p] | (o[p + 1] << 8)), y: s16(o[p + 2] | (o[p + 3] << 8)),
        tile: (o[p + 4] | (o[p + 5] << 8)) & 0x7ff,
        palette: attr & 0xf, size: [8, 16, 32, 64][(attr >> 4) & 3],
        hflip: !!(attr & 0x40), vflip: !!(attr & 0x80),
        priority: (attr >> 8) & 7, enabled: !!(attr & 0x8000),
      })
    }
  }

  setInputs(pad, word) { this.inputs[pad & 1] = word & 0xffff }
  setInput(word) { this.inputs[0] = word & 0xffff }   // pad-0 alias (back-compat)

  // deliver an interrupt and run its handler to completion (back to WAIT/HALT)
  _irq(bit, name, budget) {
    if ((this.irqEnable & bit) && this.cpu.ie) { this.cpu.interrupt(name); this.cpu.run(budget) }
  }

  // run one timed frame: game logic burst, then a scanline timeline that renders
  // each visible line with the current (per-line latched) registers and fires the
  // vblank/hblank IRQs. hblank handlers can change scroll/palette mid-frame -> raster.
  runFrame(budget = 500000) {
    const cpu = this.cpu, ppu = this.ppu, L = ppu.layers
    const W = FantasyPPU.WIDTH, H = FantasyPPU.HEIGHT
    cpu.waiting = false
    cpu.run(budget)                               // game logic burst (until WAIT/HALT)
    this.commitOAM()                              // sprites latched for the frame
    const pixels = new Uint32Array(W * H), pri = new Int8Array(W * H)
    ppu.beginFrame()
    for (let line = 0; line < LINES; line++) {
      this.scanline = line
      if (line < VISIBLE_LINES) {
        // SCANLINE_START: latch scroll, then render this line
        L[0].scrollX = (this.scroll[0] << 16) >> 16; L[0].scrollY = (this.scroll[1] << 16) >> 16
        L[1].scrollX = (this.scroll[2] << 16) >> 16; L[1].scrollY = (this.scroll[3] << 16) >> 16
        ppu.renderLine(line, pixels, pri)
        if (this.irqEnable & 2) { this.irqFlags |= 2; this._irq(2, 'hblank', budget) }  // HBLANK
      } else if (line === VISIBLE_LINES) {          // VBLANK_START
        this.irqFlags |= 1; this.vblank = true
        this._irq(1, 'vblank', budget)
      }
    }
    this.frame = (this.frame + 1) & 0xffff
    this.framebuffer = pixels
    this.audio = this.apu.generate()
    return this.framebuffer
  }
}

module.exports = { System, REG }

};
var sys=__require("system"),cart=__require("cpu/cart");
function __b64(s){var b=atob(s),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++){a[i]=b.charCodeAt(i);}return a;}
window.CastlePalm={System:sys.System,REG:sys.REG,buildCart:cart.buildCart,parseCart:cart.parseCart,carts:{pong:__b64("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AAABEAAAARAAAAEQAAAAAAEQAAABEAAAARAAAAERAAABEQAAAAAAAAAAAAAAAAEQAAABEAAAARAAABEQAAAREAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAABAAAAAQAAAAEAAAAAAAAAAAAAAAAQAAAAEAAAABAAAAAQAAAAEAAAAAAAAAEAAAABAAAAAQAAAAEAAAABAAAAAAAAAAAAAAAAEAAAABAAAAAQAAAAEAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERAAABEQAAAAAAAAAAAAABEQAAAAAAAAAAAAAAABEQAAAREAAAARAAAAEQAAAREAAAAAABEQAAARAAAAEQAAABEQAAAREAAAAAAAAAAAAAAAAREAAAAAAAAAAAAAAREAAAERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAREAAAERAAAAAAAAAAAAAAERAAAAAAAAAAAAAAAAERAAABEQAAABEAAAARAAABEQAAAAAAERAAAAAAAAAAAAAAERAAABEQAAAAAAAAAAAAAAABEQAAABEAAAARAAABEQAAAREAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEAAAARAAAAEQAAABEAAAAREAAAAAAAAAAAAAAAABEAAAARAAAAEQAAABEAAAERAAAAAAAREAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERAAAAEQAAABEAAAARAAAAEQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERAAABEQAAARAAAAEQAAABEQAAAAAAAAAAAAAAABEQAAAREAAAAAAAAAAAAAAREAAAAAABEQAAAAAAAAAAAAABEQAAAREAAAAAAAAAAAAAAAAREAAAARAAAAEQAAAREAAAERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAREAAAERAAABEAAAARAAAAERAAAAAAAAAAAAAAAAERAAABEQAAAAAAAAAAAAABEQAAAAAAERAAABEAAAARAAAAERAAABEQAAAAAAAAAAAAAAABEQAAABEAAAARAAABEQAAAREAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEQAAAREAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAREAAAERAAAAEQAAABEAAAEAAAAAAAAAEAAAABAAAAAQAAAAEAAAABAAAAAAAAAAAAAAAAEAAAABAAAAAQAAAAEAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERAAABEQAAARAAAAEQAAABEQAAAAAAAAAAAAAAABEQAAAREAAAARAAAAEQAAAREAAAAAABEQAAARAAAAEQAAABEQAAAREAAAAAAAAAAAAAAAAREAAAARAAAAEQAAAREAAAERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAREAAAERAAABEAAAARAAAAERAAAAAAAAAAAAAAAAERAAABEQAAABEAAAARAAABEQAAAAAAERAAAAAAAAAAAAAAERAAABEQAAAAAAAAAAAAAAABEQAAABEAAAARAAABEQAAAREAAAAAAAAAAAAAAAAAAAAAAAAAAAABEAAAARAAAAEQAREQAAEREAABERAAAREREAAAAAEQAAABEAAAARAAAAABERAAAREQAAEREAERERAAAREREAERERABERAAAREQAAEREAABERAAAREQAAEREAERERABEREQAAEREAABERAAAREQAAEREAABERAAAREQAAAAAAABEREQAREREAERERABERAAAREQAAEREAABEREQAAAAARAAAAEQAAABEAAAAAEREAABERAAAREQARAAAAABEREQAREREAEREAABERAAAREQAAERERABEREQARERERAAAAEQAAAAAREQAAEREAABERABEAAAARAAAAEQAAAAAAAAAAAAARAAAAEQAAABEAEREAABERAAAREQAAEREAAAAAABEREQAREREAERERAAAAAAAAAAAAAAAAAAAAAAAAEREAABERAAAREQAAEREAABERAAAAABEAAAARAAAAEQAAAAAAAAAAAAAAAAAAAAAAAAAAERERABEREQAREREAAAAAAAAREREAERERABEREQAREQAAEREAABERAAAREQAAAAAAEQAAABEAAAARAAAAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABEREQAREREAERERABERAAAREQAAEREAABERAAAREQARAAAAEQAAABEAAAAAAAAAABEREQAREREAERERABERAAAREQAAEREAABEREQAAAAAREREAERERABEREQAAAAAAAAAAAAAAAAARAAAAABEREQAREREAEREAABERAAAREQAAERERABEREQARERERAAAAEQAAAAAAAAAAAAAAAAAAABEREQAREREAERERAAAAAAAAERERABEREQAREREAEREAABERAAAREQAAERERAAAAABEREQAREREAERERAAAAAAAAAAAAAAAAABEAAAAAERERABEREQAREQAAEREAABERAAAREQAAEREAABERABEAAAARAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEAAAARAAAAEQAREQAAEREAABERAAAREQAAAAAAERERABEREQAREREAAAAAAAAAAAAAAAAAABERAAAREQAAEREAABERAAAREQAAEREAAAAAEQAAABEAAAARABERAAAREQAAEREAABERAAAREQAREREAERERABEREQAAAAAAABERAAAREQAAEREAABERAAAREQAAEREAABEREQAAAAAAEREAABERAAAREQAAEREAABERAAAREQAREREAABEREQAREREAEREAABERAAAREQAAEREAABERAAAREQAREREAERERAAAREQAAEREAABERAAAREQAAEREAABERAAAAAAAAERERABEREQAREREAAAARAAAAEQAAABEAAAARAAAAABEREQAREREAERERABEAAAARAAAAEQAAABEAAAAAAAARAAAAEQAAABEAAAARAAAAEQAREREAERERABEREREAAAARAAAAEQAAABEAAAARAAAAERERABEREQAREREAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAAAAAAAAAAABERAAAREQAAEREAAAAAEQAAABEAAAARABERAAAREQAAEREAABERAAAREQARAAAAEQAAABEAAAAAAAAAABERAAAREQAAEREAABEREQAREREAERERABERAAAAAAAAEREAABERAAAREQARAAAAEQAAABEAAAAAAAAAABERAAAREQAAERERABEREQAREREAEREAABERAAAREQAAAAAAAAAAABEAAAARAAAAEQAAAAAREQAAEREAABERAAAAAAAAEREAABERAAAREQAAEREAABERAAAREQAAEREAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEREAABERAAAREQAAEREAABERAAAREREAERERABEREQAAAAAAAAAAAAAAAAAAAAAAAAAAERERABEREQAREREAAAAAAAAREQAAEREAABERAAAREREAERERABEREQAREREAAAAAABERAAAREQAAEREAERERABEREQAREREAERERAAAREREAERERABERAAAREQAAEREAABERAAAREQAAEREAERERABEREQAAEREAABERAAAREQAAEREAABERAAAREQAAAAAAABERAAAREQAAEREAABEREQAREREAERERABEREQAAAAAAEREAABERAAAREQAREREAERERABEREQAREREAABEREQAREREAERERABEREQAREREAEREAABERAAAREQAREREAERERABEREQAREREAERERAAAREQAAEREAABERAAAAAAAAAAARAAAAEQAAABEAEREAABERAAAREQAAEREAAAAAABEAAAARAAAAEQAAAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAAABEAAAARAAAAEQAREQAAEREAABERAAAREQAAEREAEQAAABEAAAARAAAAAAAAAAAREREAERERABEREQAREQAAEREAABERAAAREREAAAAAEQAAABEAAAARAAAAABERAAAREQAAEREAEQAAAAAREREAERERABERAAAREQAAEREAABERAAAREQAAEREAEQAAABEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEQAAABEAAAARABERAAAREQAAEREAABERAAAAAAARAAAAEQAAABEAAAAAEREAABERAAAREQAAEREAABERAAAREQAAERERABEREQAREREAAAARAAAAEQAAABEAEREAABERABEAAAARAAAAEQAAABEREQAREREAERERAAAAAAAAERERABEREQAREREAEREAABERAAAREQAAERERAAAAABEAAAARAAAAEQAAAAAREQAAEREAABERABEAAAAAERERABEREQAREQAAEREAABERAAAREQAAEREAABERABEAAAARAAAAABERAAAREQAAEREAABERAAAREQAAEREAAAAAAAAAABEAAAARAAAAEQAREQAAEREAABERAAAAABEAAAAAERERABEREQAREREAAAAAAAAAAAAAAAAAEQAAAAAAABEAAAARAAAAAAAAAAAAAAAAABEREQAREREAEREREQAAABEAAAAAEREAABERAAAREQARAAAAEQAAABEAAAAAAAAAABEREQAREREAERERAAAAEQAAABEAAAARAAAAEQAAAAAREREAERERABEREQARAAAAEQAAABEAAAARAAAAAAAAEQAAABEAAAARAAAAEQAAABEAAAARAAAAEQAAABERAAAAEQAAABEAAAARAAAAEQAAABEAAAARAAAAEQAAAAAAAAAAEREAABERAAAREQAAEREAABERAAAREQAAEREAAAAAAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREREAERERABEREQAREQAAEREAABERAAAREQAAEREAERERABEREQAREREAAAAAAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAAAAAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAAAAAEQAAABEAAAARABERAAAREQAAEREAABERAAAREQARAAAAEQAAABEAAAAAAAAAABERAAAREQAAEREAABERAAAREQAAEREAABEREQAAAAAAEREAABERAAAREQAAEREAABERAAAREQAREREAABEREQAREREAERERABEREQAREREAEREAABERAAAREQAREREAERERABEREQAREREAERERAAAREQAAEREAABERAAAAAAAAEREAABERAAAREQAAEREAABERAAAREQAAAAARAAAAAAAREQAAEREAABERAAAREQAAEREAABERABEAAAAAAAARAAAAEQAREQAAEREAABERAAAREQAAEREAABERABEAAAARAAAAABERAAAREQAAEREAABERAAAREQAAEREAAAAAAAAREQAAEREAABERAAAAABEAAAARAAAAEQAAABEAAAAAABERAAAREQAAEREAEQAAABEAAAARAAAAEQAAAAAAABEAAAARAAAAEQAAABEAAAARAAAAEQAAABEAAAAREQAAABEAAAARAAAAEQAAABEAAAARAAAAEQAAABEAAAAAAAAAABEREQAREREAERERAAAAAAAAAAAAAAAAAAAAEQAAAAAREREAERERABEREQAAEREAABERAAAREQARAAAAAAAAEQAAABEAEREAABERAAAREQAAERERABEREQARERERAAAAEQAAAAAAAAAAAAAAAAAAABEREQAREREAERERAA=="),snake:__b64("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AAAAAAAAAAAAABEQAAAQAAAAEQAAABAAAAAREAAAAAAAAAAAAAAAAAAAERAAABAAAAARAAAAEAAAABAAAAAAAAAAAAAAAAAAAAABEAAAEAAAABAQAAAQEAAAARAAAAAAAAAAAAAAAAAAABAQAAAQEAAAERAAABAQAAAQEAAAAAAAAAAAAAAAAAAAERAAAAEAAAABAAAAAQAAABEQAAAAAAAAAAAAAAAAAAAAEAAAABAAAAAQAAAQEAAAAQAAAAAAAAAAAAAAAAAAABAQAAARAAAAEAAAABEAAAAQEAAAAAAAAAAAAAAAAAAAEAAAABAAAAAQAAAAEAAAABEQAAAAAAAAAAAAAAAAAAAQEAAAERAAABEQAAAQEAAAEBAAAAAAAAAAAAAAAAAAABAQAAAREAAAERAAABEQAAAQEAAAAAAAAAAAAAAAAAAAAQAAABAQAAAQEAAAEBAAAAEAAAAAAAAAAAAAAAAAAAARAAAAEBAAABEAAAAQAAAAEAAAAAAAAAAAAAAAAAAAAAEAAAAQEAAAEBAAABEAAAABEAAAAAAAAAAAAAAAAAAAEQAAABAQAAARAAAAEBAAABAQAAAAAAAAAAAAAAAAAAABEAAAEAAAAAEAAAAAEAAAEQAAAAAAAAAAAAAAAAAAABEQAAABAAAAAQAAAAEAAAABAAAAAAAAAAAAAAAAAAAAEBAAABAQAAAQEAAAEBAAABEQAAAAAAAAAAAAAAAAAAAQEAAAEBAAABAQAAAQEAAAAQAAAAAAAAAAAAAAAAAAABAQAAAQEAAAERAAABEQAAAQEAAAAAAAAAAAAAAAAAAAEBAAABAQAAABAAAAEBAAABAQAAAAAAAAAAAAAAAAAAAQEAAAAQAAAAEAAAABAAAAAQAAAAAAAAAAAAAAAAAAABEQAAAAEAAAAQAAABAAAAAREAAAAAAAAAAAAAAAAAAAERERABEREQAREREAEREAABERAAAREQAAEREAAAAAABEREQAREREAERERAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREREAERERABEREQAREQAAEREAABERAAAREQAAEREAERERABEREQAREREAAAAAAAAAABEAAAARAAAAEQAREREAERERABEREQAAABEAAAAAEQAAABEAAAARAAAAEQAAABEAAAARAAAAEQAAAAAAABEAAAARAAAAEQAAABEAAAARABEREQAREREAEREREQAAABEAAAARAAAAEQAAABEAAAAREREAERERABEREQAAAAAAABEREQAREREAERERAAAAAAAAAAAAAAAAABEREQAAAAAREREAERERABEREQAAEREAABERAAAREQAREREAABEREQAREREAEREAABERAAAREQAAERERABEREQAREREREREAERERAAAAAAAAAAAAAAAAABEREQAREREAERERAAAAAAAAERERABEREQAREREAAAAAAAAAAAAAAAAAERERAAAAABEREQAREREAERERAAAREQAAEREAABERABEREQAAERERABEREQAAAAAAAAAAAAAAAAAREREAERERABEREREREQAREREAABERAAAREQAAEREAERERABEREQAREREAAAAAAAAREQAAEREAABERAAAREQAAEREAABERAAAREREAAAAAABERAAAREQAAEREAABERAAAREQAAEREAERERAAAREREAERERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERERABEREQAAEREAABERAAAREQAAEREAABERAAAREQAAAAAAABEREQAREREAERERABERAAAREQAAEREAABEREQAAAAAREREAERERABEREQAAAAAAAAAAAAAAAAAREREAABEREQAREREAAAAAAAAAAAAAAAAAERERABEREQAREREREREAERERAAAREQAAEREAABERABEREQAREREAERERAAAAAAAAERERABEREQAREREAEREAABERAAAREQAAERERAAAAABEREQAREREAERERAAAAAAAAAAAAAAAAABEREQAAERERABEREQAREQAAEREAABERAAAREREAERERABEREREREQAREREAABERAAAREQAAEREAERERABEREQAREREAAAAAAAAREREAERERABEREQAAAAAAAAAAAAAAAAAAABEAAAAAERERABEREQAREREAABERAAAREQAAEREAEQAAAAAAABEAAAARABERAAAREQAAEREAABERAAAREQAAEREAEQAAABEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEREQAREREAERERABERAAAREQAAEREAABEREQAAAAAREREAERERABEREQAAEREAABERAAAREQAREREAABEREQAREREAEREAABERAAAREQAAERERABEREQAREREREREAERERAAAREQAAEREAABERABEREQAREREAERERAAAAAAAAERERABEREQAREREAEREAABERAAAREQAAERERAAAAABEREQAREREAERERAAAREQAAEREAABERABEREQAAERERABEREQAAAAAAAAAAAAAAAAAREREAERERABEREREREQAREREAABERAAAREQAAEREAERERABEREQAREREAAAAAAAAAABEAAAARAAAAEQAREQAAEREAABERAAAREREAAAAAEQAAABEAAAARAAAAABERAAAREQAAEREAERERAAAREREAERERABERAAAREQAAEREAABERAAAREQAAEREAERERABEREQAAEREAABERAAAREQAAEREAABERAAAREQAAAAAAABEREQAREREAERERABERAAAREQAAEREAABEREQAAAAARAAAAEQAAABEAAAAAEREAABERAAAREQARAAAAABEREQAREREAEREAABERAAAREQAAERERABEREQARERERAAAAEQAAAAAREQAAEREAABERABEAAAARAAAAEQAAAAAAAAAAAAARAAAAEQAAABEAEREAABERAAAREQAAEREAAAAAABEREQAREREAERERAAAAAAAAAAAAAAAAAAAAAAAAEREAABERAAAREQAAEREAABERAAAAABEAAAARAAAAEQAAAAAAAAAAAAAAAAAAAAAAAAAAERERABEREQAREREAAAAAAAAREREAERERABEREQAREQAAEREAABERAAAREQAAAAAAEQAAABEAAAARAAAAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABEREQAREREAERERABERAAAREQAAEREAABERAAAREQARAAAAEQAAABEAAAAAAAAAABEREQAREREAERERABERAAAREQAAEREAABEREQAAAAAREREAERERABEREQAAAAAAAAAAAAAAAAARAAAAABEREQAREREAEREAABERAAAREQAAERERABEREQARERERAAAAEQAAAAAAAAAAAAAAAAAAABEREQAREREAERERAAAAAAAAERERABEREQAREREAEREAABERAAAREQAAERERAAAAABEREQAREREAERERAAAAAAAAAAAAAAAAABEAAAAAERERABEREQAREQAAEREAABERAAAREQAAEREAABERABEAAAARAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEAAAARAAAAEQAREQAAEREAABERAAAREQAAAAAAERERABEREQAREREAAAAAAAAAAAAAAAAAABERAAAREQAAEREAABERAAAREQAAEREAAAAAEQAAABEAAAARABERAAAREQAAEREAABERAAAREQAREREAERERABEREQAAAAAAABERAAAREQAAEREAABERAAAREQAAEREAABEREQAAAAAAEREAABERAAAREQAAEREAABERAAAREQAREREAABEREQAREREAEREAABERAAAREQAAEREAABERAAAREQAREREAERERAAAREQAAEREAABERAAAREQAAEREAABERAAAAAAAAERERABEREQAREREAAAARAAAAEQAAABEAAAARAAAAABEREQAREREAERERABEAAAARAAAAEQAAABEAAAAAAAARAAAAEQAAABEAAAARAAAAEQAREREAERERABEREREAAAARAAAAEQAAABEAAAARAAAAERERABEREQAREREAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAAAAAAAAAAABERAAAREQAAEREAAAAAEQAAABEAAAARABERAAAREQAAEREAABERAAAREQARAAAAEQAAABEAAAAAAAAAABERAAAREQAAEREAABEREQAREREAERERABERAAAAAAAAEREAABERAAAREQARAAAAEQAAABEAAAAAAAAAABERAAAREQAAERERABEREQAREREAEREAABERAAAREQAAAAAAAAAAABEAAAARAAAAEQAAAAAREQAAEREAABERAAAAAAAAEREAABERAAAREQAAEREAABERAAAREQAAEREAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEREAABERAAAREQAAEREAABERAAAREREAERERABEREQAAAAAAAAAAAAAAAAAAAAAAAAAAERERABEREQAREREAAAAAAAAREQAAEREAABERAAAREREAERERABEREQAREREAAAAAABERAAAREQAAEREAERERABEREQAREREAERERAAAREREAERERABERAAAREQAAEREAABERAAAREQAAEREAERERABEREQAAEREAABERAAAREQAAEREAABERAAAREQAAAAAAABERAAAREQAAEREAABEREQAREREAERERABEREQAAAAAAEREAABERAAAREQAREREAERERABEREQAREREAABEREQAREREAERERABEREQAREREAEREAABERAAAREQAREREAERERABEREQAREREAERERAAAREQAAEREAABERAAAAAAAAAAARAAAAEQAAABEAEREAABERAAAREQAAEREAAAAAABEAAAARAAAAEQAAAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAAABEAAAARAAAAEQAREQAAEREAABERAAAREQAAEREAEQAAABEAAAARAAAAAAAAAAAREREAERERABEREQAREQAAEREAABERAAAREREAAAAAEQAAABEAAAARAAAAABERAAAREQAAEREAEQAAAAAREREAERERABERAAAREQAAEREAABERAAAREQAAEREAEQAAABEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEQAAABEAAAARABERAAAREQAAEREAABERAAAAAAARAAAAEQAAABEAAAAAEREAABERAAAREQAAEREAABERAAAREQAAERERABEREQAREREAAAARAAAAEQAAABEAEREAABERABEAAAARAAAAEQAAABEREQAREREAERERAAAAAAAAERERABEREQAREREAEREAABERAAAREQAAERERAAAAABEAAAARAAAAEQAAAAAREQAAEREAABERABEAAAAAERERABEREQAREQAAEREAABERAAAREQAAEREAABERABEAAAARAAAAABERAAAREQAAEREAABERAAAREQAAEREAAAAAAAAAABEAAAARAAAAEQAREQAAEREAABERAAAAABEAAAAAERERABEREQAREREAAAAAAAAAAAAAAAAAEQAAAAAAABEAAAARAAAAAAAAAAAAAAAAABEREQAREREAEREREQAAABEAAAAAEREAABERAAAREQARAAAAEQAAABEAAAAAAAAAABEREQAREREAERERAAAAEQAAABEAAAARAAAAEQAAAAAREREAERERABEREQARAAAAEQAAABEAAAARAAAAAAAAEQAAABEAAAARAAAAEQAAABEAAAARAAAAEQAAABERAAAAEQAAABEAAAARAAAAEQAAABEAAAARAAAAEQAAAAAAAAAAEREAABERAAAREQAAEREAABERAAAREQAAEREAAAAAAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREREAERERABEREQAREQAAEREAABERAAAREQAAEREAERERABEREQAREREAAAAAAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAAAAAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAAAAAEQAAABEAAAARABERAAAREQAAEREAABERAAAREQARAAAAEQAAABEAAAAAAAAAABERAAAREQAAEREAABERAAAREQAAEREAABEREQAAAAAAEREAABERAAAREQAAEREAABERAAAREQAREREAABEREQAREREAERERABEREQAREREAEREAABERAAAREQAREREAERERABEREQAREREAERERAAAREQAAEREAABERAAAAAAAAEREAABERAAAREQAAEREAABERAAAREQAAAAARAAAAAAAREQAAEREAABERAAAREQAAEREAABERABEAAAAAAAARAAAAEQAREQAAEREAABERAAAREQAAEREAABERABEAAAARAAAAABERAAAREQAAEREAABERAAAREQAAEREAAAAAAAAREQAAEREAABERAAAAABEAAAARAAAAEQAAABEAAAAAABERAAAREQAAEREAEQAAABEAAAARAAAAEQAAAAAAABEAAAARAAAAEQAAABEAAAARAAAAEQAAABEAAAAREQAAABEAAAARAAAAEQAAABEAAAARAAAAEQAAABEAAAAAAAAAABEREQAREREAERERAAAAAAAAAAAAAAAAAAAAEQAAAAAREREAERERABEREQAAEREAABERAAAREQARAAAAAAAAEQAAABEAEREAABERAAAREQAAERERABEREQARERERAAAAEQAAAAAAAAAAAAAAAAAAABEREQAREREAERERAA=="),palmblast:__b64("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CwwBCwASE/8AGhwaDwsAGAQR/wEaHRoPCwAYBBH/DxQSBxoSEwARE/8GAAwEGg4VBBH/DxwaFggNEv8PHRoWCA0S/wMRABb/DwAUEgQD/wAaAQ4MARoaGhITABET/2JvDDBihBkwYuYZMGKkGjACAAEfAAACAB8ABwIAHwAIAgACAAAfAAoCAAIA/x8ADQIAAgBIGwACAgACACgbAAQCAAIAAR8AEAIAAgALHwAXAgACAAkfABgCAAIAAB8AGgIAAgD/HwAdAgACAOgbABICAAIAqBsAFAIAAgD/HwAgAgAfACECAB8AIgIAHwAjAgACAAIbAAgBAAIAABsABgEAAgABGwAAAQBkBACAAgACEEACIAAcIEoAMxABAFLzBAAAAwACEIACIAAcIEoAMxABAFLzBAAAIQACELACIAAcIEoAMxABAFLzBAAAIgACELACIAAcIEoAMxABAFLzAgAAHwAoAQAfACoBAGQCUAACQABiFRowAyVCIAQwJAQAACAASQIcYDFAAQA3QA0AWeIxUAEAN1ALAFnVZDdAAABRIjdADABRHDdQAABRFjdQCgBREANkOmABAFINA2U6YAEAUgUBYAIAZGJgGjA3YAAAUg9iYhswOgADAFEFAWABAGQBYAAAZDdAAQBSDDdQAQBRNDdQAgBRLjdAAgBSBjdQAQBRIjdACwBSDDdQCQBRFjdQCABREDdACgBSBjdQCQBRBAJgAGQCYAFkAlAAAkAAYsMaMDFAAQA3QA0AWfIxUAEAN1ALAFnlZAMlQiAEMCQEAAAgAEkCFCBCIAIxIAQAA2RCYAExYAcAA3VCcAExcAMAAwYDF2IpGzAxIAEAAwYxAAEAAxdiKRswMSABAAMGAxcxEAEAYikbMDEgAQADBjEAAQADFzEQAQBiKRswZAMxQjAGMDBCMAIfMAAQEAMDQwAIHwABEBACAAEfAAIQEB8gBBAQAgAAHwAEEBAfAAQQEB8ABBAQZBMABAEAAxBCEAc9AQMQQxAJPQEDEEIQCD0BGwAEAQBkIiIiIiEREREhERERIRERESEREREhERERIRERESEREREiIiIiERERERERERERERERERERERERERERERERERERESEREREhERERIRERESEREREhERERIRERESEREREhERERERERERERERERERERERERERERERERERERERERERERERFVVVVVVERERFQzMzNUMzMzVDMzM1QzMzNUMzMzVFVVVVVVVVVERERFMzMzVTMzM1UzMzNVMzMzVTMzM1VVVVVVVFVVVVQzMzNUMzMzVDMzM1QzMzNUMzMzVFVVVVVVVVVVVVVVMzMzVTMzM1UzMzNVMzMzVTMzM1VVVVVVVVVVVXd3d3d3ZmZmd2ZmZndmZmZ3ZmZmd2ZmZndmZmZ3ZmZmd3d3d2ZmZmhmZmZoZmZmaGZmZmhmZmZoZmZmaGZmZmh3ZmZmd2ZmZndmZmZ3ZmZmd2ZmZndmZmZ2ZmZmeIiIiGZmZmhmZmZoZmZmaGZmZmhmZmZoZmZmaGZmZmiIiIiIAAAAAAAAAAAAACIiAAIhEQAhERECIzMRAhMzEQITMxEAAAAAAAAAACIiAAAREiAAERESABEzMiARMzEgETMxIAITMxECERERAhEREQIRERECIRERACEREQACIREAACIiETMxIBERESAREREgERERIBEREiARERIAERIgACIiAAAAAAAAAAAAAAAAAAAAAAARAAAREQABIhEAASIRABERETMAAAAzAAAAMwAAABEAAAAREQAAEREQABEREAAREREAABEREQAREREAERERAAEREQABEREAABERAAAAEQAAAAAREREAERERABEREQARERAAEREQABERAAARAAAAAAAAAAAAAAAAAAARAAABEQABEREAAREiABESIgERIiMBESIzAAAAABEAAAAREAAAEREQACIREAAiIREAMiIREDMiERABESIzAREiIwAREiIAAREiAAEREQAAAREAAAARAAAAADMiERAyIhEQIiERACIREAARERAAERAAABEAAAAAAAAAAAAAAAAREREAERERABEREQAREQAAEREAABERAAAREQAAAAAAERERABEREQAREREAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABEREQAREREAERERABERAAAREQAAEREAABERAAAREQAREREAERERABEREQAAAAAAAAAAEQAAABEAAAARABEREQAREREAERERAAAAEQAAAAARAAAAEQAAABEAAAARAAAAEQAAABEAAAARAAAAAAAAEQAAABEAAAARAAAAEQAAABEAERERABEREQARERERAAAAEQAAABEAAAARAAAAEQAAABEREQAREREAERERAAAAAAAAERERABEREQAREREAAAAAAAAAAAAAAAAAERERAAAAABEREQAREREAERERAAAREQAAEREAABERABEREQAAERERABEREQAREQAAEREAABERAAAREREAERERABEREREREQAREREAAAAAAAAAAAAAAAAAERERABEREQAREREAAAAAAAAREREAERERABEREQAAAAAAAAAAAAAAAAAREREAAAAAERERABEREQAREREAABERAAAREQAAEREAERERAAAREREAERERAAAAAAAAAAAAAAAAABEREQAREREAERERERERABEREQAAEREAABERAAAREQAREREAERERABEREQAAAAAAABERAAAREQAAEREAABERAAAREQAAEREAABEREQAAAAAAEREAABERAAAREQAAEREAABERAAAREQAREREAABEREQAREREAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAREREAERERAAAREQAAEREAABERAAAREQAAEREAABERAAAAAAAAERERABEREQAREREAEREAABERAAAREQAAERERAAAAABEREQAREREAERERAAAAAAAAAAAAAAAAABEREQAAERERABEREQAAAAAAAAAAAAAAAAAREREAERERABEREREREQAREREAABERAAAREQAAEREAERERABEREQAREREAAAAAAAAREREAERERABEREQAREQAAEREAABERAAAREREAAAAAERERABEREQAREREAAAAAAAAAAAAAAAAAERERAAAREREAERERABERAAAREQAAEREAABEREQAREREAERERERERABEREQAAEREAABERAAAREQAREREAERERABEREQAAAAAAABEREQAREREAERERAAAAAAAAAAAAAAAAAAAAEQAAAAAREREAERERABEREQAAEREAABERAAAREQARAAAAAAAAEQAAABEAEREAABERAAAREQAAEREAABERAAAREQARAAAAEQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERERABEREQAREREAEREAABERAAAREQAAERERAAAAABEREQAREREAERERAAAREQAAEREAABERABEREQAAERERABEREQAREQAAEREAABERAAAREREAERERABEREREREQAREREAABERAAAREQAAEREAERERABEREQAREREAAAAAAAAREREAERERABEREQAREQAAEREAABERAAAREREAAAAAERERABEREQAREREAABERAAAREQAAEREAERERAAAREREAERERAAAAAAAAAAAAAAAAABEREQAREREAERERERERABEREQAAEREAABERAAAREQAREREAERERABEREQAAAAAAAAAAEQAAABEAAAARABERAAAREQAAEREAABEREQAAAAARAAAAEQAAABEAAAAAEREAABERAAAREQAREREAABEREQAREREAEREAABERAAAREQAAEREAABERAAAREQAREREAERERAAAREQAAEREAABERAAAREQAAEREAABERAAAAAAAAERERABEREQAREREAEREAABERAAAREQAAERERAAAAABEAAAARAAAAEQAAAAAREQAAEREAABERABEAAAAAERERABEREQAREQAAEREAABERAAAREREAERERABEREREAAAARAAAAABERAAAREQAAEREAEQAAABEAAAARAAAAAAAAAAAAABEAAAARAAAAEQAREQAAEREAABERAAAREQAAAAAAERERABEREQAREREAAAAAAAAAAAAAAAAAAAAAAAAREQAAEREAABERAAAREQAAEREAAAAAEQAAABEAAAARAAAAAAAAAAAAAAAAAAAAAAAAAAAREREAERERABEREQAAAAAAABEREQAREREAERERABERAAAREQAAEREAABERAAAAAAARAAAAEQAAABEAAAAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAERERABEREQAREREAEREAABERAAAREQAAEREAABERABEAAAARAAAAEQAAAAAAAAAAERERABEREQAREREAEREAABERAAAREQAAERERAAAAABEREQAREREAERERAAAAAAAAAAAAAAAAABEAAAAAERERABEREQAREQAAEREAABERAAAREREAERERABEREREAAAARAAAAAAAAAAAAAAAAAAAAERERABEREQAREREAAAAAAAAREREAERERABEREQAREQAAEREAABERAAAREREAAAAAERERABEREQAREREAAAAAAAAAAAAAAAAAEQAAAAAREREAERERABERAAAREQAAEREAABERAAAREQAAEREAEQAAABEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEQAAABEAAAARABERAAAREQAAEREAABERAAAAAAAREREAERERABEREQAAAAAAAAAAAAAAAAAAEREAABERAAAREQAAEREAABERAAAREQAAAAARAAAAEQAAABEAEREAABERAAAREQAAEREAABERABEREQAREREAERERAAAAAAAAEREAABERAAAREQAAEREAABERAAAREQAAERERAAAAAAAREQAAEREAABERAAAREQAAEREAABERABEREQAAERERABEREQAREQAAEREAABERAAAREQAAEREAABERABEREQAREREAABERAAAREQAAEREAABERAAAREQAAEREAAAAAAAAREREAERERABEREQAAABEAAAARAAAAEQAAABEAAAAAERERABEREQAREREAEQAAABEAAAARAAAAEQAAAAAAABEAAAARAAAAEQAAABEAAAARABEREQAREREAEREREQAAABEAAAARAAAAEQAAABEAAAAREREAERERABEREQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEREAABERAAAREQAAEREAABERAAAREQAAEREAAAAAAAAAAAAAEREAABERAAAREQAAAAARAAAAEQAAABEAEREAABERAAAREQAAEREAABERABEAAAARAAAAEQAAAAAAAAAAEREAABERAAAREQAAERERABEREQAREREAEREAAAAAAAAREQAAEREAABERABEAAAARAAAAEQAAAAAAAAAAEREAABERAAAREREAERERABEREQAREQAAEREAABERAAAAAAAAAAAAEQAAABEAAAARAAAAABERAAAREQAAEREAAAAAAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAREQAAEREAABERAAAREQAAEREAABEREQAREREAERERAAAAAAAAAAAAAAAAAAAAAAAAAAAREREAERERABEREQAAAAAAABERAAAREQAAEREAABEREQAREREAERERABEREQAAAAAAEREAABERAAAREQAREREAERERABEREQAREREAABEREQAREREAEREAABERAAAREQAAEREAABERAAAREQAREREAERERAAAREQAAEREAABERAAAREQAAEREAABERAAAAAAAAEREAABERAAAREQAAERERABEREQAREREAERERAAAAAAAREQAAEREAABERABEREQAREREAERERABEREQAAERERABEREQAREREAERERABEREQAREQAAEREAABERABEREQAREREAERERABEREQAREREAABERAAAREQAAEREAAAAAAAAAABEAAAARAAAAEQAREQAAEREAABERAAAREQAAAAAAEQAAABEAAAARAAAAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAAAAAEQAAABEAAAARABERAAAREQAAEREAABERAAAREQARAAAAEQAAABEAAAAAAAAAABEREQAREREAERERABERAAAREQAAEREAABEREQAAAAARAAAAEQAAABEAAAAAEREAABERAAAREQARAAAAABEREQAREREAEREAABERAAAREQAAEREAABERAAAREQARAAAAEQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARAAAAEQAAABEAEREAABERAAAREQAAEREAAAAAABEAAAARAAAAEQAAAAAREQAAEREAABERAAAREQAAEREAABERAAAREREAERERABEREQAAABEAAAARAAAAEQAREQAAEREAEQAAABEAAAARAAAAERERABEREQAREREAAAAAAAAREREAERERABEREQAREQAAEREAABERAAAREREAAAAAEQAAABEAAAARAAAAABERAAAREQAAEREAEQAAAAAREREAERERABERAAAREQAAEREAABERAAAREQAAEREAEQAAABEAAAAAEREAABERAAAREQAAEREAABERAAAREQAAAAAAAAAAEQAAABEAAAARABERAAAREQAAEREAAAAAEQAAAAAREREAERERABEREQAAAAAAAAAAAAAAAAARAAAAAAAAEQAAABEAAAAAAAAAAAAAAAAAERERABEREQARERERAAAAEQAAAAAREQAAEREAABERABEAAAARAAAAEQAAAAAAAAAAERERABEREQAREREAAAARAAAAEQAAABEAAAARAAAAABEREQAREREAERERABEAAAARAAAAEQAAABEAAAAAAAARAAAAEQAAABEAAAARAAAAEQAAABEAAAARAAAAEREAAAARAAAAEQAAABEAAAARAAAAEQAAABEAAAARAAAAAAAAAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAAAAAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABEREQAREREAERERABERAAAREQAAEREAABERAAAREQAREREAERERABEREQAAAAAAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAAAAAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAAAARAAAAEQAAABEAEREAABERAAAREQAAEREAABERABEAAAARAAAAEQAAAAAAAAAAEREAABERAAAREQAAEREAABERAAAREQAAERERAAAAAAAREQAAEREAABERAAAREQAAEREAABERABEREQAAERERABEREQAREREAERERABEREQAREQAAEREAABERABEREQAREREAERERABEREQAREREAABERAAAREQAAEREAAAAAAAAREQAAEREAABERAAAREQAAEREAABERAAAAABEAAAAAABERAAAREQAAEREAABERAAAREQAAEREAEQAAAAAAABEAAAARABERAAAREQAAEREAABERAAAREQAAEREAEQAAABEAAAAAEREAABERAAAREQAAEREAABERAAAREQAAAAAAABERAAAREQAAEREAAAAAEQAAABEAAAARAAAAEQAAAAAAEREAABERAAAREQARAAAAEQAAABEAAAARAAAAAAAAEQAAABEAAAARAAAAEQAAABEAAAARAAAAEQAAABERAAAAEQAAABEAAAARAAAAEQAAABEAAAARAAAAEQAAAAAAAAAAERERABEREQAREREAAAAAAAAAAAAAAAAAAAARAAAAABEREQAREREAERERAAAREQAAEREAABERABEAAAAAAAARAAAAEQAREQAAEREAABERAAAREREAERERABEREREAAAARAAAAAAAAAAAAAAAAAAAAERERABEREQAREREA"),gryphon:__b64("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AgAAAAAAAAAAAAAAAAAzAAADEQAAAxIAAAAxAEAAMQREAREERAERAEARETAAAAATAAAAEwAAADAAAAAwAFAAEQVVABEFVQAREFAAAAARUQAAERUAAxERAAMSEQAxEhEAMhERADIiIgACICIREAAAERAAABETAAASEwAAEhEwABESMAAiIjAAICIAAAAAAAADMAAAMxMAAAMREAAAIREQAAIREQAxFVUDEVURAAAARAAAREQABERAAEREAAREQABERAAAEUAAABEgAAAxFVERAhFREQAhEREAAhEiAAIgAAAiAAACIAAAAAAAABEgAAASAAAAEgAAABIAAAAiAAAAAiAAAAAAAAAAAAAAIBgBAYABAAAAAAoAAQAABiQZAgLAAQFGAAIyAAEC8AAoGgMDQAEDWsABUAACAQABLBsEAjABBG6AAXgAAQLgBDAcAwTgAQI8AAA8AAMAAAggHQEAQAEFUAAACgABAAAAFQMXBRgEGQIaAxsFAABaAKgA4QCAAeEAqABaAAAApv9Y/x//gP4f/1j/pv8BADgDHiQCtAABAEAEGBwClgABAUgCJDwDAngAAQAwBRgQAQFAAyAcAwQBAQI0AygWAngAAQM0AyQcAwQBAQQwAxweAwQCBQAEAQYuADMhEjMyEREjIREREhESERERESERIREREjIRESMzIRIzMiIiIjIiIiIyIiIiMiIiIjIiIiIyIiIiMiIiIjIiIiISIiIhEREREREhESETERMRMzMzMxERIRESERESETETEQAAAAAARAAAAERFAAAEQlAERyIlBEciIgB3JhEAdyYRAAAAAAAAAAAAAAAAAAAAAAAAAAAlAAAAIiJQACIiIiIAdyYRAHcmEQRHIiIERyIlAARCUABERQAARAAAAAAAACIiIiIiIlAAJQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMwAAADMAAAAzAAAAMwAAADMAAAAzAAAAMwAAADMAAAAAAAABERAAERERABEREQAREREAERERAAEREAAAAAAAAAAAAAAQAAABEAAAERERABEREQABEAAAABAAAAAAAAAAEQAAABEAAAEREAEREREREREREAEREAAAEQAAABEAAAAAAAABERAAEAABAQAAABEAAAAQEAABAAEREAAAAAAAABEAAAEREAAREREBERERERERERAREREAAREQAAARAAAAAAAAAAAAAAARAAABERAAAREQAAARAAAAAAAAAAAAAQARABAQEQEAAREQAREREREREREQAREQABARAQEAEQAQABEAAAEREAAREREBEREREBEREQABERAAABEAAAAAAAAAABAAAAEAAAERAAARERABERERAREREQARERAAAREABAQg8AoIYBABAnAADoAwAAZAAAAAoAAAABAAAAEgIOEQT/CwgVBBL/AQ4MARL/Ag4MAQ7/F/8GERgPBw4NGgASAgQNE/8AGgUIEQT/FxoBDgwB/xITABET/w8AFBIEA/8HCP8PFBIHGhITABET/wYADAQaDhUEEf8ABPwD/QL+AAMA/QAAAwD9AgL+/gAAAAAAERERABEREQAREREAEREAABERAAAREQAAEREAAAAAABEREQAREREAERERAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREREAERERABEREQAREQAAEREAABERAAAREQAAEREAERERABEREQAREREAAAAAAAAAABEAAAARAAAAEQAREREAERERABEREQAAABEAAAAAEQAAABEAAAARAAAAEQAAABEAAAARAAAAEQAAAAAAABEAAAARAAAAEQAAABEAAAARABEREQAREREAEREREQAAABEAAAARAAAAEQAAABEAAAAREREAERERABEREQAAAAAAABEREQAREREAERERAAAAAAAAAAAAAAAAABEREQAAAAAREREAERERABEREQAAEREAABERAAAREQAREREAABEREQAREREAEREAABERAAAREQAAERERABEREQAREREREREAERERAAAAAAAAAAAAAAAAABEREQAREREAERERAAAAAAAAERERABEREQAREREAAAAAAAAAAAAAAAAAERERAAAAABEREQAREREAERERAAAREQAAEREAABERABEREQAAERERABEREQAAAAAAAAAAAAAAAAAREREAERERABEREREREQAREREAABERAAAREQAAEREAERERABEREQAREREAAAAAAAAREQAAEREAABERAAAREQAAEREAABERAAAREREAAAAAABERAAAREQAAEREAABERAAAREQAAEREAERERAAAREREAERERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERERABEREQAAEREAABERAAAREQAAEREAABERAAAREQAAAAAAABEREQAREREAERERABERAAAREQAAEREAABEREQAAAAAREREAERERABEREQAAAAAAAAAAAAAAAAAREREAABEREQAREREAAAAAAAAAAAAAAAAAERERABEREQAREREREREAERERAAAREQAAEREAABERABEREQAREREAERERAAAAAAAAERERABEREQAREREAEREAABERAAAREQAAERERAAAAABEREQAREREAERERAAAAAAAAAAAAAAAAABEREQAAERERABEREQAREQAAEREAABERAAAREREAERERABEREREREQAREREAABERAAAREQAAEREAERERABEREQAREREAAAAAAAAREREAERERABEREQAAAAAAAAAAAAAAAAAAABEAAAAAERERABEREQAREREAABERAAAREQAAEREAEQAAAAAAABEAAAARABERAAAREQAAEREAABERAAAREQAAEREAEQAAABEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEREQAREREAERERABERAAAREQAAEREAABEREQAAAAAREREAERERABEREQAAEREAABERAAAREQAREREAABEREQAREREAEREAABERAAAREQAAERERABEREQAREREREREAERERAAAREQAAEREAABERABEREQAREREAERERAAAAAAAAERERABEREQAREREAEREAABERAAAREQAAERERAAAAABEREQAREREAERERAAAREQAAEREAABERABEREQAAERERABEREQAAAAAAAAAAAAAAAAAREREAERERABEREREREQAREREAABERAAAREQAAEREAERERABEREQAREREAAAAAAAAAABEAAAARAAAAEQAREQAAEREAABERAAAREREAAAAAEQAAABEAAAARAAAAABERAAAREQAAEREAERERAAAREREAERERABERAAAREQAAEREAABERAAAREQAAEREAERERABEREQAAEREAABERAAAREQAAEREAABERAAAREQAAAAAAABEREQAREREAERERABERAAAREQAAEREAABEREQAAAAARAAAAEQAAABEAAAAAEREAABERAAAREQARAAAAABEREQAREREAEREAABERAAAREQAAERERABEREQARERERAAAAEQAAAAAREQAAEREAABERABEAAAARAAAAEQAAAAAAAAAAAAARAAAAEQAAABEAEREAABERAAAREQAAEREAAAAAABEREQAREREAERERAAAAAAAAAAAAAAAAAAAAAAAAEREAABERAAAREQAAEREAABERAAAAABEAAAARAAAAEQAAAAAAAAAAAAAAAAAAAAAAAAAAERERABEREQAREREAAAAAAAAREREAERERABEREQAREQAAEREAABERAAAREQAAAAAAEQAAABEAAAARAAAAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABEREQAREREAERERABERAAAREQAAEREAABERAAAREQARAAAAEQAAABEAAAAAAAAAABEREQAREREAERERABERAAAREQAAEREAABEREQAAAAAREREAERERABEREQAAAAAAAAAAAAAAAAARAAAAABEREQAREREAEREAABERAAAREQAAERERABEREQARERERAAAAEQAAAAAAAAAAAAAAAAAAABEREQAREREAERERAAAAAAAAERERABEREQAREREAEREAABERAAAREQAAERERAAAAABEREQAREREAERERAAAAAAAAAAAAAAAAABEAAAAAERERABEREQAREQAAEREAABERAAAREQAAEREAABERABEAAAARAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEAAAARAAAAEQAREQAAEREAABERAAAREQAAAAAAERERABEREQAREREAAAAAAAAAAAAAAAAAABERAAAREQAAEREAABERAAAREQAAEREAAAAAEQAAABEAAAARABERAAAREQAAEREAABERAAAREQAREREAERERABEREQAAAAAAABERAAAREQAAEREAABERAAAREQAAEREAABEREQAAAAAAEREAABERAAAREQAAEREAABERAAAREQAREREAABEREQAREREAEREAABERAAAREQAAEREAABERAAAREQAREREAERERAAAREQAAEREAABERAAAREQAAEREAABERAAAAAAAAERERABEREQAREREAAAARAAAAEQAAABEAAAARAAAAABEREQAREREAERERABEAAAARAAAAEQAAABEAAAAAAAARAAAAEQAAABEAAAARAAAAEQAREREAERERABEREREAAAARAAAAEQAAABEAAAARAAAAERERABEREQAREREAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAAAAAAAAAAABERAAAREQAAEREAAAAAEQAAABEAAAARABERAAAREQAAEREAABERAAAREQARAAAAEQAAABEAAAAAAAAAABERAAAREQAAEREAABEREQAREREAERERABERAAAAAAAAEREAABERAAAREQARAAAAEQAAABEAAAAAAAAAABERAAAREQAAERERABEREQAREREAEREAABERAAAREQAAAAAAAAAAABEAAAARAAAAEQAAAAAREQAAEREAABERAAAAAAAAEREAABERAAAREQAAEREAABERAAAREQAAEREAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEREAABERAAAREQAAEREAABERAAAREREAERERABEREQAAAAAAAAAAAAAAAAAAAAAAAAAAERERABEREQAREREAAAAAAAAREQAAEREAABERAAAREREAERERABEREQAREREAAAAAABERAAAREQAAEREAERERABEREQAREREAERERAAAREREAERERABERAAAREQAAEREAABERAAAREQAAEREAERERABEREQAAEREAABERAAAREQAAEREAABERAAAREQAAAAAAABERAAAREQAAEREAABEREQAREREAERERABEREQAAAAAAEREAABERAAAREQAREREAERERABEREQAREREAABEREQAREREAERERABEREQAREREAEREAABERAAAREQAREREAERERABEREQAREREAERERAAAREQAAEREAABERAAAAAAAAAAARAAAAEQAAABEAEREAABERAAAREQAAEREAAAAAABEAAAARAAAAEQAAAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAAABEAAAARAAAAEQAREQAAEREAABERAAAREQAAEREAEQAAABEAAAARAAAAAAAAAAAREREAERERABEREQAREQAAEREAABERAAAREREAAAAAEQAAABEAAAARAAAAABERAAAREQAAEREAEQAAAAAREREAERERABERAAAREQAAEREAABERAAAREQAAEREAEQAAABEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEQAAABEAAAARABERAAAREQAAEREAABERAAAAAAARAAAAEQAAABEAAAAAEREAABERAAAREQAAEREAABERAAAREQAAERERABEREQAREREAAAARAAAAEQAAABEAEREAABERABEAAAARAAAAEQAAABEREQAREREAERERAAAAAAAAERERABEREQAREREAEREAABERAAAREQAAERERAAAAABEAAAARAAAAEQAAAAAREQAAEREAABERABEAAAAAERERABEREQAREQAAEREAABERAAAREQAAEREAABERABEAAAARAAAAABERAAAREQAAEREAABERAAAREQAAEREAAAAAAAAAABEAAAARAAAAEQAREQAAEREAABERAAAAABEAAAAAERERABEREQAREREAAAAAAAAAAAAAAAAAEQAAAAAAABEAAAARAAAAAAAAAAAAAAAAABEREQAREREAEREREQAAABEAAAAAEREAABERAAAREQARAAAAEQAAABEAAAAAAAAAABEREQAREREAERERAAAAEQAAABEAAAARAAAAEQAAAAAREREAERERABEREQARAAAAEQAAABEAAAARAAAAAAAAEQAAABEAAAARAAAAEQAAABEAAAARAAAAEQAAABERAAAAEQAAABEAAAARAAAAEQAAABEAAAARAAAAEQAAAAAAAAAAEREAABERAAAREQAAEREAABERAAAREQAAEREAAAAAAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREREAERERABEREQAREQAAEREAABERAAAREQAAEREAERERABEREQAREREAAAAAAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAAAAAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAABERAAAREQAAEREAAAAAEQAAABEAAAARABERAAAREQAAEREAABERAAAREQARAAAAEQAAABEAAAAAAAAAABERAAAREQAAEREAABERAAAREQAAEREAABEREQAAAAAAEREAABERAAAREQAAEREAABERAAAREQAREREAABEREQAREREAERERABEREQAREREAEREAABERAAAREQAREREAERERABEREQAREREAERERAAAREQAAEREAABERAAAAAAAAEREAABERAAAREQAAEREAABERAAAREQAAAAARAAAAAAAREQAAEREAABERAAAREQAAEREAABERABEAAAAAAAARAAAAEQAREQAAEREAABERAAAREQAAEREAABERABEAAAARAAAAABERAAAREQAAEREAABERAAAREQAAEREAAAAAAAAREQAAEREAABERAAAAABEAAAARAAAAEQAAABEAAAAAABERAAAREQAAEREAEQAAABEAAAARAAAAEQAAAAAAABEAAAARAAAAEQAAABEAAAARAAAAEQAAABEAAAAREQAAABEAAAARAAAAEQAAABEAAAARAAAAEQAAABEAAAAAAAAAABEREQAREREAERERAAAAAAAAAAAAAAAAAAAAEQAAAAAREREAERERABEREQAAEREAABERAAAREQARAAAAAAAAEQAAABEAEREAABERAAAREQAAERERABEREQARERERAAAAEQAAAAAAAAAAAAAAAAAAABEREQAREREAERERAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAABAQMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAQEDAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwEBAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMBAQAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAQEBAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAEBAQMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAEBAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAABAQMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAQEAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwEBAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMBAQEAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAQEBAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAQEDAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAEBAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMBAQAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAQEAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwEBAQAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAABAQEDAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAABAQMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAQEDAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwEBAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMBAQAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAQEBAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMAAAAAAAAAAAAAAAAAAAAAAAEBAQMDAwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAhEAAAAhAAAAIRAAACEQAAAhEAAAIRAAAAIQAAACEAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAQAAABEQABEQAAAAAAAAAAAAAAEQABEREAERERERERERERERERERERAAAAAAEREREREREREREREREREREREREREREREREREREAAAAAEREREBEREREREREREREREREREREREREREREREQAAAAAAAAAAEQAAABEREAAREREAERERERERERERERERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEAAAAREQABEBEgAAASAAABEgAAARIAAAESAAABEgAAASAAAAEgAAAAAAACEAAAAhAAAAIQAAAAIAAAACAAAAAgAAAAEAAAABEQAREREBERERERERERERERERERERERERIRERESERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERABERERARERERERERERERERERERERERERERIRERESEgAAABIAAAASAAAAIAAAACAAAAAgAAAAEAAAABAAAAAAAAARAAAAEQAAAREAAAIiAAACIgAAEREAABERAAARESEREREhERERIRERESIiIiIiIiIiEhERERIRERESERERERERERERERERERERIiIiIiIiIiIREREREREhERIiIiIREREREREREREREREiIiIiIiIiIhERERERERERERERERERERERERERERERESIiIiIiIiIiERERERERERERERERERERERERERERERERIiIiIiIiIiIRERERERIRESIiIiERERESEREREhERERIiIiIiIiIiIhERESEREREhERERIREAAAARAAAAERAAACIgAAAiIAAAEREAABERAAAREQAAAAAREQABEREAARERAAEREQABEREAARERAAEREQABERERIRERESEREhEhERIREhEiERIREhESERIRERERERERESIiMiIiMzMyIjMzMiMzMzMiMzMyIjMzMiIiMiISIiIiIREREiIRERIiERESIiEREiIRERIiERESIREREhERERIhERESIRERIiERESIhERIiIRERIiERESIhERESIRERESIjIiIjMzMiIzMzIjMzMzIjMzMiIzMzIiIjIiIiIiIhERESESEREhEhERIRIhEhESERIREhESEREREREREREREREQAAEREQABEREAARERAAEREQABEREAARERAAEREQAAABEREAARERAAEREQABEREAABERAAAREQAAEREAABERERERERERERERIRERERIRERERIRERERIRERERIRERERIRESERERERERERERERERERERERERERERERERERERERERERERIRERESERERERERERERERERERERERERERERERERIRERESEREREREREREREREREREREREREREREREREREREREhERERERERERERERERERERERERERERERERERERERERERERERERERERESERERIREREhERESERERIREREhEREREREQABEREAARERAAEREQABERAAAREQAAEREAABERAAAAAAERAAABEQAAAREAAAARAAAAAAAAAAAAAAAAAAAAABEREREREREREREREREREREAABERAAABEQAAABEAAAARIRERERIRERERIREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREiIiIiIhIiEhERERERERERERERERERERERERERERERESIiIiIiEiISEREREhERESERERIREREREREREREREREREREREREREREREREREREREREREREREREREREAABEQAAARAAAAEQAAABEQAAAREAAAERAAABEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABERERERERERAREREQAREREAERERAAEREQAAEREAAAERIhIiEiISIhIiIiIiIiIiIiIhIiEiISIhIiIiIhEREREiEiISIhIiEiIiIiIiIiIiIiEiISIhIiEiIiIiEREREREREREREREREREREBEREQAREREAEREQABERAAAREAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERAAAAEQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAABERERERESIiEREREQEREREAAAAAAAAAAAAAAAAAAAAAERERESIiEREREREREREREAAAAAAAAAAAAAAAAAAAAAAREAAAEQAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACIiIgAAABEAAAERAAAREQAAAAAAAAAAAAAREgIRERISERESEhEREhIRERISERESAAAAAAAAAAARERAAERESEREREhERERIRERESEREREhEAAAAAAAAAAAAAAAAAAAAAEQAAABEQAAAREgAAERIQAAACEREAEhERACIiIgESEREBEhERARIREQESEREBEhEREhEREhIRERISERESEhEREhIRERISERESEhEREhIRERIRERIRERESEREREhERERIRERESERExEhEzMzIRMzMyERESEQAREhEQERIREBESEREREhERERIRERESEREREhERASIiIgESEREBEhERARIREQESEREAEhERACIiIgACERESERETEhEREhIRERISERESEhEREhIRERISERESEhEREjMzMxEzMzIRMzMyERExEhERERIRERESEREREhERERIRERIRERESEREREhERERIRERESEREREhEQERIREBESEQAAABERAAABEQAAABEAAAABACIiIgAAAAAAAAAAAAAAABIRERISERESEhEREhIRERICERESAAAREgAAAAAAAAAAERESEREREhERERIRERESEREREhERERAAAAAAAAAAAAAREhAAERIAABEQAAARAAAAAAAAAAAAAAAAAAAAAAAAAA=="),oathbound:__b64("Q1BMTQEAAABPQVRIQk9VTkQAAAAAAAAAAAAwABBnAAAMADAAAAAAAAAAAAACAAAfAAgQEAEAAHwbAAoQEAEAEEIbAAoQEAEA4AIbAAoQEAEATx0bAAoQEAEAVAkbAAoQEAEAlFIbAAoQEAEAhzEbAAoQEAEAOWcbAAoQEAIAHxsAChAQAQD/AxsAChAQAQAHJRsAChAQAQDWYhsAChAQAQBGERsAChAQAQBPGRsAChAQAQDrDBsAChAQAQD2JRsAChAQAgAQHwAIEBACAAAbAAoQEAEAen8bAAoQEAEAL1obAAoQEAEABzEbAAoQEAEAuRQbAAoQEAEAbwwbAAoQEAEAHScbAAoQEAEA3EYbAAoQEAEArCYbAAoQEAEAZRUbAAoQEAEAUjsbAAoQEAEA3nsbAAoQEAEALxUbAAoQEAIAIR8ACBAQAQD2YhsAChAQAQDvRRsAChAQAQAoKRsAChAQAQD+FBsAChAQAQBQFRsAChAQAQCbdxsAChAQAgAxHwAIEBABAPhpGwAKEBABABBJGwAKEBABAIkoGwAKEBABAHlqGwAKEBABAJ4vGwAKEBABAN57GwAKEBACAEEfAAgQEAEA1WIbAAoQEAEAjD0bAAoQEAEAxiAbAAoQEAEA2yYbAAoQEAEA2RgbAAoQEAEAj0UbAAoQEAIAUR8ACBAQAQC/KhsAChAQAQB7ERsAChAQAQCxCBsAChAQAQCLCBsAChAQAQC/PxsAChAQAQDeexsAChAQAgBhHwAIEBABAFQJGwAKEBACAHEfAAgQEAEAMUYbAAoQEAIAgR8ACBAQAQD/fxsAChAQAgCRHwAIEBABAF8BGwAKEBACAKEfAAgQEAEATx0bAAoQEAIAsR8ACBAQAQBSVhsAChAQAQBrORsAChAQAQClIBsAChAQAQBfJxsAChAQAQDWYhsAChAQAQD+GBsAChAQAQBPSRsAChAQAgDBHwAIEBABAN9XGwAKEBABAD8fGwAKEBABADoKGwAKEBABAP9/GwAKEBACANEfAAgQEAEAMlkbAAoQEAEArEAbAAoQEAEARiQbAAoQEAEAPicbAAoQEAEAFRIbAAoQEAEA3EYbAAoQEAEA3nsbAAoQEAEAuBQbAAoQEAIA4R8ACBAQAQD/fxsAChAQAQBBEBsAChAQAgDwHwAIEBACEBABAP9/GwAKEBAzEAEAUvECACAfAAAQEAIAAB8AARAQHwACEBAEACE9MAIQIGJXCjACAEAfAAAQEAIAAB8AARAQHwACEBAEAEE9MAIQIGJXCjACAGAfAAAQEAIAAB8AARAQHwACEBAEAGE9MAIQIGJXCjACAIAfAAAQEAIAAB8AARAQHwACEBAEAIE9MAIQIGJXCjACAKAfAAAQEAIAAB8AARAQHwACEBAEAKE9MAIQIGJXCjACAMAfAAAQEAIAAB8AARAQHwACEBAEAME9MAIQIGJXCjACAOAfAAAQEAIAAB8AARAQHwACEBAEAOE9MAIQIGJXCjACAAAfAAAQEAIAAR8AARAQAgAAHwACEBAEAAE+MAIQIGJXCjACAAAfAAAQEAIAAh8AARAQAgAAHwACEBAEACE+MAIQgGJXCjACAAAfAAAQEAIACB8AARAQAgAAHwACEBAEAAlTMAIQgGJXCjACAIAfAAAQEAIACB8AARAQAgAAHwACEBAEAIlTMAIQgGJXCjACAAAfAAAQEAIACR8AARAQAgAAHwACEBAEAAlUMAIQgGJXCjACAIAfAAAQEAIACR8AARAQAgAAHwACEBAEAIlUMAIQgGJXCjACAAAfAAAQEAIACh8AARAQAgAAHwACEBAEAAlVMAIQgGJXCjACAIAfAAAQEAIAAh8AARAQAgAAHwACEBAEAIlVMAIQgGJXCjACACAfAAAQEAIACx8AARAQAgAAHwACEBAEAGlaMAIQIGJXCjACAIAfAAAQEAIACh8AARAQAgAAHwACEBAEAOlaMAIQgGJXCjACAAAfAAAQEAIACx8AARAQAgAAHwACEBAEAGlbMAIQIGJXCjACAIAfAAAQEAIACx8AARAQAgAAHwACEBAEAAlWMAIQgGJXCjACACAfAAAQEAIAAR8AARAQAgAAHwACEBAEAKlbMAIQIGJXCjACAAAfAAAQEAIADB8AARAQAgAAHwACEBAEAMlbMAIQQGJXCjACAEAfAAAQEAIADB8AARAQAgAAHwACEBAEAAlcMAEQQAFiVwowAgCAHwAAEBACAA0fAAEQEAIAAB8AAhAQBABJXTACEOBiZwowAgBgHwAAEBACAA4fAAEQEAIAAB8AAhAQBAApXjACEGBiVwowAgDAHwAAEBACAA4fAAEQEAIAAB8AAhAQBADJUDACEIBiVwowAgBAHwAAEBACAA8fAAEQEAIAAB8A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AAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAkCAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACQIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAkCAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAECAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAQIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEBAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAQECAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAQEBAQIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEBAQEBAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAEBAQEBAQEBAQEBAQEBAAAAAQEBAAAAAAAAAAAAAAAAAQEBAQEBAQEBAQEBAQEAAAABAQEAAAAAAAAAAAAAAAABAQEBAQEBAQEBAQEBAQAAAAEBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AFESAABRAgAAAAAhZgAAAhEAAAAjAAAAMAAAAAAAAAAAAAAAAAAAAABmEgAAESAAADIAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAABVUAADVVAAAyIgAAMRIAAzIiADRCMwNEZiMDRmYiAAAAADAAAAAwAAAAMAAAADMAAAAyMAAAIjMAACEjAAADRmYiA0RmIgNEZiIANGIiADMiIgADIiAAAzADAAAAACEjAAAiIwAAIgMAACAwAAAjMAAAIwAAADAAAAAAAAAAAAAAAAAEAAAABDADAAMhEgAyFRUAMhUFADIWZgATIiIAAAAAQAAAAEAAAAAwAAAAIwAAABIwAAAgMAAAIxAAAAEyEiIDISIiADISIgAyEiIAAyIiAAMgAgAzIAIAAAAAMDEAACMDAAAgMEAAIwNAADA0MAAwQAAAMwAAAAAAAAAAAAAAAAAAAAAAAzMAADIiAAMiIgAyIhEAMiERADIhFAAAAAAwAAAAIzMAACIiMAASIiMAERIiMEERIjBEESIwAyIRRAAyIRQAMiERADIiEQADIiIAADIiAAADMwAAAABEQRIjRBEiMEERIjAREiIwEiIjACIiMAAjMwAAMAAAABEREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAREhAAAAAAAAAAAAAAERAAABIgAAATMAABJmAAABMxEAASIAAAAAEAAAACERAAAiIwAAMzMAADZiEAAzMwAAIiMAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAARIREAABIiIgASIiIBIiUiABIiIgASIiIAEiIjABIiMAASUiEiEBIiIiEiIiIiIiIiIiIiIiIiIiIiIncSIiJ0IiInRCIiEBIiIiEiIiIiIiIiIiJyIiIiR3IiIkRyIiJERyIiIiIiECIiIjAiJSIhIiIiMCIiIjAjIiIwMBIiMCEiUjAAEiIwABIiMAASIjAAEiIwADNTMAAzMzAAMzMwADMzMBIiInQSIiJ3EiJSIhIiIiISIiIiEiIiIhIiIiMBIiIwRHIiIkdyIiJyIlIiIiIiIiIiIiIiIiIiIyIiIhASIiMwEiIwMBIiMDASIjAwEiIwMDNTMDAzMzAwMzMwADMzMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASIiMAEiIjABIiIwASIiMAEiIjADMzMwAzMzMAMzMzAAEiIjABIiIwASIiMAEiIjABIiIwAzMzMAMzMzADMzMwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAABURAAARYUAAEREAAAAZgAABmYAAAaGAABmZkAEAABERFAAhYVAAEREQABmYAAAZmYAAGaGAAA2ZmAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAABHQAAEREQAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAABAAAAAQAABmYAAAd3AABERAABR3cREid3IiIndyIiInciIiIiZmYAAHd3AABEREAAd3dBAHd3IhF3dyIiR3IiIkIiIiIERAAAAEAAAABAAAAAQAAAEUAAACNAAAAjQAAAI0AAAAAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiJCIiIiQiIiIkIiIiJCIiIiQiIiIkIiIiJCIiIiQiIiIiNAAAAjQAAAI0AAACNAAAAjQAAAI0AAACNAAAAjQAAAAAAAEgAAASIAAAEiAAASIgABIiIAEiIiATMzMwAAAAAiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIzMzMzMzMzM0IiIiJCIiIiQiIiIkIiIiJCIiIiIiIiIjMzMzMzMzMzIkAAACIhAAAiIwAAIiIQACIiIQAiIiIQMzMzMTAAAAAAAgAAAAEAAAACAAAAZmAAAAYAAAAGAAAAAwAAAAAAAAAAAAAAABAAAAAQAAAAEAAAEBAAAAEAAAAAAAAAAAAAAAAAAAEAAQABAAEAAQEBAAEQEQAAEBAAAAAAAAAAAAAAAAAAABAQAAABAAAAAQAAAAEAAAAQEAAAAAAAAAAAAAAAABEAAAARAAAAEQAAABEAAAARAAAAEQAAABEAAAAREQAAABEAAAARAAAAEQAAABEAAAARAAAAEQAAABEAAAAAAAARAAAAEQAAABEAAAARAAAAEQAAABEAAAARAAAAEREAAAARAAAAEQAAABEAAAARAAAAEQAAABEAAAARAAAAAAAAAAAAAAAAEREQEREREREREREAEREQAAAAAAAAAAAREREREREREREREREREREREREREREREREREREREREREQCZmQAJmZmQmZmZmZmZmZmZmZmZmZmZmQmZmZAAmZkAAzADMDMzMzMzMzMzMzMzMwMzMzAAMzMAAAMwAAAAAAACIAIgIiIiIiIiIiIiIiIiAiIiIAAiIgAAAiAAAAAAAAAAAAAAERAAABAQAAAQEAAAEBAAABEQAAAAAAAAAAAAAAAAAAABAAAAEQAAAAEAAAABAAAAERAAAAAAAAAAAAAAAAAAABEQAAAAEAAAERAAABAAAAAREAAAAAAAAAAAAAAAAAAAERAAAAAQAAAREAAAABAAABEQAAAAAAAAAAAAAAAAAAAQEAAAEBAAABEQAAAAEAAAABAAAAAAAAAAAAAAAAAAABEQAAAQAAAAERAAAAAQAAAREAAAAAAAAAAAAAAAAAAAERAAABAAAAAREAAAEBAAABEQAAAAAAAAAAAAAAAAAAAREAAAABAAAAEAAAABAAAAAQAAAAAAAAAAAAAAAAAAABEQAAAQEAAAERAAABAQAAAREAAAAAAAAAAAAAAAAAAAERAAABAQAAAREAAAABAAABEQAAAAAAAAAAAAAAAAAAAREAAAEAAAABAQAAAQEAAAERAAAAAAAAAAAAAAAAAAABEQAAAQEAAAERAAABAQAAAQEAAAAAAAAAAAAAAAAAAAEBAAABEQAAAREAAAEBAAABAQAAAAAAAAAAAAAAAAAAAREAAAEAAAABEQAAAQAAAAERAAAAAAAAAAAAAAAAAAABEQAAAQEAAAEBAAABAQAAAREAAAAAAAAAAAAAAAAAAAEBAAABAQAAAQEAAAEBAAAAEAAAAAAAAAAAAAAAAAAAAREAAAEBAAABEQAAARAAAAEBAAAAAAAAAAAAAAEREAAREREBERERERERERABERAAERERABEAEQARABEBEREQAQAAEAEBEBABAAAQAREREAEAAAABAAAAAQAAAAABERAAEQARARAAAREQAAEREAABERAAARARABEAAREQBsbW5v/nBxb3L/AgAAGwDABQAbAMIFABsAxAUAGwDGBQAbAMgFABsA0gUAGwDcBQAbAOYFABsA6AUAGwDqBQAbAOwFAB8AAyAQHwAHIBAfAAsgEGRiBl8wYjdgMGLCYDBiHGEwYnZhMBMAxgUANwAAAFEJMwABABsAxgUAZBcAABAANwAAAFEYAgAAGwDmBQAbAOgFABsA6gUAGwDsBQBkYqxfMBMAwAUANwAAAFEKMwABABsAwAUAZGLeXzAVAAA3AP8AUgwCAAAbAMIFAGLeXzAVEABiKGAwGyDmBQACAAs3EAAAUgMCAAAbAOgFABUQAWIoYDAbIOoFAAIACDcQAABSAwIAABsA7AUAFQACGwDABQATAMIFADEAAwAbAMIFAGQXAEAFADcAAABRBgIQBFAFABcQUBAAEwDEBQA2AVESGxDEBQACAAAbAMIFABsAwAUAZBMAxAUANwAAAFEaNwABAFEcNwACAFEeNwADAFEgBACAZTBQHQAEAM5kMFAVAAQA/2QwUA0ABAAqZTBQBQAEAFVlMBMAwgUASQBkAyFCIAEEEK5kMEkSECFkEwDIBQA3AAAAUkcTEOYFADcQAABRNBMg6AUAEwDGBQA3AAAAUQ8zIAQAAwI6AACAUQMCIAAbEAAgEB8gAiAQAgABHwADIBBQCAACAAAfAAMgEBMA0gUANwAAAFItExDqBQA3EAAAURoTIOwFABsQBCAQHyAGIBACAAEfAAcgEFAIAAIAAB8AByAQZBMAyAUANwAAAFIBZBMQzAUAEyDOBQAyEgMBOgAAgFEDAhAAGxDMBQATMMoFABMg0AUAMDIbMMoFABswACAQHxACIBACAAEfAAMgEBMAyAUAMwABABsAyAUAZBMA0gUANwAAAFIBZBMQ1gUAEyDYBQAyEgMBOgAAgFEDAhAAGxDWBQATMNQFABMg2gUAMDIbMNQFABswBCAQHxAGIBACAAEfAAcgEBMA0gUAMwABABsA0gUAZBMA3AUANwAAAFIJAgAAHwALIBBkExDgBQATIOIFADISAwE6AACAUQMCEAAbEOAFABMw3gUAEyDkBQAwMhsw3gUAGzAIIBAfEAogEAIAAR8ACyAQEwDcBQAzAAEAGwDcBQBkcAACAFobANQFAAEA+P8bANoFAAIACxsA1gUAAgACGwDYBQACAAYbANIFAHEAZHAAAgA8GwDeBQACAAQbAOQFAAIACRsA4AUAAgAEGwDiBQACAAMbANwFAHEAZHAAAgAQGwDeBQACAAYbAOQFAAIAChsA4AUAAgADGwDiBQACAAQbANwFAHEAZHAAAgAoGwDeBQACAAAbAOQFAAIABxsA4AUAAgADGwDiBQACAAIbANwFAHEAZHAAAgA8GwDUBQABAPr/GwDaBQACAAwbANYFAAIAAhsA2AUAAgAGGwDSBQBxAGRwAAIAUBsA1AUAAQD8/xsA2gUAAgANGwDWBQACAAEbANgFAAIAEBsA0gUAcQBkcAACABwbAN4FAAIABRsA5AUAAgAMGwDgBQACAAIbAOIFAAIACBsA3AUAAQAEARsA1AUAAgAKGwDaBQACAA0bANYFAAIAARsA2AUAAgAOGwDSBQACAA4bAMYFAHEAZHAAAgAUGwDeBQACAAgbAOQFAAIADhsA4AUAAgABGwDiBQACAB4bANwFAAIAyBsAygUAAgAYGwDQBQACAA4bAMwFAAIAARsAzgUAAgAeGwDIBQACAHgbANQFAAIAGBsA2gUAAgAOGwDWBQACAAEbANgFAAIAHhsA0gUAAgAeGwDGBQBxAGRwAAIAeBsA1AUAAQD9/xsA2gUAAgANGwDWBQACAAAbANgFAAIAHBsA0gUAAgAeGwDeBQACAAIbAOQFAAIACBsA4AUAAgACGwDiBQACAAgbANwFAHEAZHAAAQAsARsA1AUAAQD+/xsA2gUAAgAOGwDWBQACAAEbANgFAAIAGBsA0gUAAgAYGwDeBQACAAMbAOQFAAIADBsA4AUAAgABGwDiBQACABgbANwFAAIAGBsAxgUAcQBkcAACAB4bAN4FAAIAABsA5AUAAgAJGwDgBQACAAQbAOIFAAIAAhsA3AUAcQBkAAC4AJIAegBtAFwAUgBJAD0ANwAuACkAJAAfABsAFwAKBQ4MBw4NCA4MBw4LBg4NCA4KBQ4AAAoNCA4OCQ4PCg4OCQ4MBw4NCA4KBRIAAAr/CAUKCgUKDAYKDQgMDAYKCgUKCwYMAAAIDAcKDQgKDwoKDQgMCwYOAAAI/wUBEgYBEggCEgYBEgkCFAgCEgYBEgUBFgAADAgCEgkDEgcCFAUBGAAADP8LBAgNBAgMBQgOBggNBAgLBAgMBQoAAAYOBggPCAgNBggMBQgLBAoAAAb/CAEJCQEJCwMJCAEJDAQJCwMJCQIJCAEJDQMJDAQJCwMJCAELAAAH/wAAAQD+/wEA//8AAAEAAAALAB8AXwEfAP8DvwLfAb8CHSffK/8z3ysAAAAAAAAAAAALsAALERsAsRERsAsRGwAAu7AAAAAAAAAHcAAAB3AAAAuwAHe7u3d3u7t3AAuwAAAHcAAAB3AAAAAAAAAAAAAAAAAAAAAAAAADIiMAMhEiADIndwADInMAAAAAAAAAAAAAAAAAAAAAAAYAADBgAAAwYAAABmZgAAADREMAMhRUADJEVAADJmIAAyACAAMgAgADMAMAAAAAAGAAABMAAAAjAAAAMAAAADAAAAAwAAAAMAAAAAAAAAAAAAMjAAAyEgAAMicAADJ3AAADIwAAA0MAADJEAAAyRAAAAAA2AAAANgAAADYAAAAGYAAABgAAACYAAAAQAAAAAAAyRAAAMlQAAANiAAADAgAAAwIAAAMBAAADAwAAAAAgAAAAIAAAADAAAAAwAAAAMAAAADAAAAAwAAAAAAAAAA=="),streetbrawl:__b64("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AAAzAAAFUAAAAAAAIkAAACJAAAAkQAAANAAAADQAAAAzAAAABVAAAAAAAAAAAAAAAAAERAAAQREAAEFRAABBEQAABEQAAEIiAAQiIgAAAABAAAAAFAAAABUEAAAUAAAAQAAAACQAAAAiQAAAAAQiIgAEIiIABEIiAAQwAwBDAAMAMwAABVAAAAAAAAAiQAAAIkAAACRAAABAAAAAQAAAADMAAAAFUAAAAAAAAAAAAAAAAAREAABBEQAAQVEAAEERAAAERAAAQiIABCIiAAAAAEAAAAAUAAAAFQQAABQAAABAAAAAJAAAACJBERQABCIiAAQiIgAEQiIAAEMAAABDAAAAMwAABVAAAAAAACJEREQiQAAAJEAAADQAAAA0AAAAMwAAAAVQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIiIgAjMzMAJDM0ACMzMwACIiIAIRERAhEREQAAAAAgAAAAMgAAADIAAAAyAAAAIAAAABIAAAARIAAAAhEREQIhEREAIQAAACEAAAAiAAAAEQAAAiAAAAAAAAARIAAAEiAAABIAAAASAAAAIgAAABEAAAACIAAAAAAAAAAAAAAAAiIiACMzMwAkMzQAIzMzAAIiIgAhERECERERAAAAACAAAAAyAAAAMgAAADIAAAAgAAAAEgAAABEgAAACERERAiEREQAhAAAAAhABAAIgAgARAAAAIgAAAAAAABEgAAASIAAAEgAAACAAAAAgAAAAEQAAACIAAAAAAAAAAAAAAAAAAAAAAAAAAAABEQAAEREAABIiAAAREQAAAREAAAAAAAAAAAAAAAAREREAERERECIiIhAREREQERERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAADMAAAMzAAADMwAAAzMAAAAzAAAAAwAAAAAzMAAAMzMAADMzMAAzMzAAMzMwADMzAAAzMAAAAAAAAAAAAAAAAAAAAAAABAAAAAQAAAAAAAAAAAAAAAAzAAAARAAAAEQAAABEQAAAREAAAAAAAAAAAAAAAAAAAAAgAAAAIgAAAAIiIgAjMzMAI0MzACMzMwAiMzMAAiIiAAIAAAAiAAAiIAAAMzIAADQyAAAzMgAAMyIAACIgAAAAIRERAhEREQIRERECERERAiEREQAhEAAAIgAAAiAAABESAAARESAAEREgABERIAAREiAAARIAAAAiAAAAAiAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAEQAAARIAABEAAAERAAARIQABEhAAESEAABIQAAAhAAAAEAAAAAAAESEAARIQABEhAAAREAAAEQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEQAAEAAQABAAEAARERAAEAAQABAAEAAQABAAAAAAABERAAAQABAAEAAQABERAAAQABAAEAAQABERAAAAAAAAAREQABAAAAAQAAAAEAAAABAAAAAQAAAAAREQAAAAAAAREQAAEAAQABAAEAAQABAAEAAQABAAEAAREQAAAAAAABEREAAQAAAAEAAAABERAAAQAAAAEAAAABEREAAAAAAAEREQABAAAAAQAAAAEREAABAAAAAQAAAAEAAAAAAAAAABERAAEAAAABAAAAAQARAAEAAQABAAEAABEQAAAAAAABAAEAAQABAAEAAQABEREAAQABAAEAAQABAAEAAAAAAAEREQAAAQAAAAEAAAABAAAAAQAAAAEAAAEREQAAAAAAAAERAAAAEAAAABAAAAAQAAEAEAABABAAABEAAAAAAAABAAEAAQAQAAEBAAABEAAAAQEAAAEAEAABAAEAAAAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEREQAAAAAAAQABAAEQEQABAQEAAQABAAEAAQABAAEAAQABAAAAAAABAAEAARABAAEBAQABABEAAQABAAEAAQABAAEAAAAAAAAREAABAAEAAQABAAEAAQABAAEAAQABAAAREAAAAAAAAREQAAEAAQABAAEAAREQAAEAAAABAAAAAQAAAAAAAAAAERAAAQABAAEAAQABAAEAAQEBAAEAEAAAEQEAAAAAAAEREAABAAEAAQABAAEREAABAQAAAQAQAAEAAQAAAAAAABERAAEAAAABAAAAABEQAAAAAQAAAAEAAREQAAAAAAABEREAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAAAAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAAREAAAAAAAAQABAAEAAQABAAEAAQABAAEAAQAAEBAAAAEAAAAAAAABAAEAAQABAAEAAQABAQEAAQEBAAEQEQABAAEAAAAAAAEAAQABAAEAABAQAAABAAAAEBAAAQABAAEAAQAAAAAAAQABAAEAAQAAEBAAAAEAAAABAAAAAQAAAAEAAAAAAAABEREAAAABAAAAEAAAAQAAABAAAAEAAAABEREAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAREAABAAEAAQARAAEBAQABEAEAAQABAAAREAAAAAAAAAEAAAARAAAAAQAAAAEAAAABAAAAAQAAABEQAAAAAAAAERAAAQABAAAAAQAAABAAAAEAAAAQAAABEREAAAAAAAEREQAAABAAAAEAAAAAEAAAAAEAAQABAAAREAAAAAAAAAAQAAABEAAAEBAAAQAQAAEREQAAABAAAAAQAAAAAAABEREAAQAAAAEREAAAAAEAAAABAAEAAQAAERAAAAAAAAABEAAAEAAAAQAAAAEREAABAAEAAQABAAAREAAAAAAAARERAAAAAQAAABAAAAEAAAAQAAAAEAAAABAAAAAAAAAAERAAAQABAAEAAQAAERAAAQABAAEAAQAAERAAAAAAAAAREAABAAEAAQABAAAREQAAAAEAAAAQAAARAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"),galechase:__b64("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")}};
})();
