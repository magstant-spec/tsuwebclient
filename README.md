# Browser MUD GMCP Client (MVP)

A minimal browser-based MUD terminal using:

- `xterm.js` in the browser
- Node.js TCP <-> WebSocket proxy
- Telnet GMCP negotiation/parsing server-side

## Run

```powershell
cd C:\Users\magst\MUDClientApp\browser-mud-gmcp
npm install
npm start
```

`npm install` now copies local `xterm` assets into `public/vendor/xterm`, so no CDN is required.

Then open:

- `http://localhost:8080`

## Configure target MUD

- Enter host/port in the UI and click Connect.
- Or set defaults with env vars before start:

```powershell
$env:MUD_HOST='your.mud.host'
$env:MUD_PORT='4000'
$env:WS_PORT='8080'
npm start
```

## Notes

- This is a baseline client, not a full Telnet stack.
- GMCP messages are emitted to the side panel, with `Char.Vitals` and `Room.Info` mapped to dedicated panels.
- Add more handlers in `public/client.js` as needed.
