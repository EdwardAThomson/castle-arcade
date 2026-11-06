# Security notes

A review of how Castle Arcade loads and runs cartridges, done on 2026-10-29
(site v67) and rechecked against v74. The conclusion is that loading your own
`.cpc` carts is low risk and the feature stays.

## Why loading carts from disk is low risk

- **It's local only.** **Load…** and drag-and-drop read the file with
  `FileReader` in the browser. Nothing is uploaded to a server. No URL parameter
  loads a remote cart; `#name` only selects a cart already in the bundle. A
  hostile cart can affect only the person who chose to open it.
- **The emulator is a sandbox by construction.** Cart code is interpreted
  bytecode. All guest memory (RAM, save RAM, VRAM, OAM, palette) is a JS typed
  array behind masked 24-bit addresses, and MMIO is a fixed `switch` over known
  registers. Guest code has no route to the DOM, the network, or JavaScript.
- **No dynamic code or HTML.** There is no `eval`, `new Function`, `innerHTML`, or
  `fetch` in `dist/castlepalm.js` or the shells. File names, cart titles and error
  messages are shown with `textContent`. No third-party scripts are loaded.

## Known minor issues (not fixed)

1. **A cart can freeze the tab.** Each interrupt handler gets its own 500k-cycle
   budget. A cart that re-enables interrupts in its hblank handler and spins
   costs about 1.5 s per emulated frame, against about 4 ms for Galechase.
   *Fix:* use one total cycle budget per frame in `System.runFrame` (workshop
   `system.js`).
2. **A cart can read or overwrite another game's save.** Saves are stored in
   `localStorage` as `cp:<profile>:<title>`, and the cart chooses its own
   title. A cart titled `OATHBOUND` gets Oathbound's save and high scores. It
   can't send them anywhere. *Fix:* store saves from carts loaded off disk
   under a separate prefix, or key them by a hash of the cart.
3. **Errors at runtime stop the game.** An unknown opcode, or an affine map
   size large enough to read past VRAM (DataView `RangeError`), throws inside
   the frame loop and nothing catches it. The game stops, and the cart can't
   escape. *Fix:* catch the error in `frame()` and show it.
4. **Robustness and defence in depth.** Opening the page with `#constructor`
   or `#__proto__` in the URL throws at startup, because the cart lookup is a
   plain object lookup. The site also sends no `Content-Security-Policy`
   header. A CSP set through the static host (for example `default-src 'self'`,
   `connect-src 'none'`, with a hash for each shell's inline script) would be
   cheap defence in depth.

Fixes for 1 to 3 belong in the workshop (`fantasy-16-console`). After that they
reach this site through the normal bundle deploy.
