# Castle Arcade

A small browser arcade for the **CastlePalm** fantasy 16-bit console (the 16-bit
successor to [Dragon Palm](https://github.com/0xe25f/dragon-palm)) —
pick a cartridge and play. Two front-ends share one machine:

- **`index.html`** — the **CastlePalm** handheld (portrait casing, on-screen D-pad
  and buttons; keyboard works too).
- **`console.html`** — the **CastleStation** TV console: a big integer-scaled
  screen with **two-player** controls (keyboard split + Gamepad API). The same
  cartridges run on both.

It's a fully static site: the two HTML shells, the engine bundle
`dist/castlepalm.js` (the real CPU + PPU + APU, with the cartridges embedded so it
runs even from `file://`), the handheld casing image, and a `carts/` folder of
`.cpc` cartridges. No build step here.

## Cartridges

| File | Title | Players |
| --- | --- | --- |
| `palmblast.cpc` | **PALMBLAST** (Bomberman-style arena) | 2 |
| `pong.cpc` | Pong | 1 |
| `snake.cpc` | Snake | 1 |

Each shell has a cartridge bar at the top (click a title), plus **Load cartridge…**
to run any `.cpc` from disk, and drag-and-drop onto the screen.

## Controls

**PALMBLAST** (best on CastleStation, `console.html`): press **Start** to begin a
round, last knight standing wins.

- 🟢 **P1** — `W A S D` move · `F` drop bomb · `Q` start
- 🔴 **P2** — arrow keys move · `.` drop bomb · `Enter` start
- USB/Bluetooth **gamepads** auto-map to P1 / P2.

On the handheld (`index.html`), the on-screen D-pad / A·B·X·Y / Start map to one
player (arrow keys / `Z X C V` / `Enter` on the keyboard).

## Run locally

It's self-contained (carts are embedded in the engine), so **just open
`index.html`** — `file://` works. A static server also works if you prefer:

```sh
python3 -m http.server   # then open http://localhost:8000
```

## Host it yourself

This is a fully static, self-contained site — **no build step, no server code, no
secrets or accounts required.** Everything needed to run is in this repo. Serve the
files on any static host (GitHub Pages, Netlify, Cloudflare Pages, your own web
server…), or just open `index.html` locally.

## License

[PolyForm Noncommercial 1.0.0](LICENSE.md) — free to use, modify, and share for
**noncommercial** purposes (hobby, learning, personal play); commercial use
requires permission. © 2026 Edward Thomson.
