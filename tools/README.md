# Tools

Standard-library Python 3 scripts used while building this (macOS).

- **`tvremote.py`**: Samsung's local remote-control API (WebSocket on port
  8002). `TV_IP=192.168.1.50 ./tvremote.py pair` shows an **Allow** prompt on
  the TV once and saves a token in `tools/state/` (git-ignored). Then:
  `key HOME LEFT RIGHT*3`, `hold ENTER 1.5`, `text "..."`, `status <app id>`,
  `info`. Every command is logged to `tools/state/remote-log.jsonl`. On Tizen 8
  the `apps` command gets no answer (Samsung dropped that call).
- **`phonecam.py`**: Samsung TVs can't take screenshots over the network. Run
  `./phonecam.py serve`, open the printed `https://` address in Safari on an
  iPhone on the same Wi-Fi (accept the self-signed certificate warning), tap
  **Start camera** and point it at the TV. The newest frame is kept in
  `photos/live/latest.jpg`; `./phonecam.py snap out.jpg` waits for a fresh
  one. Frames show whatever the phone sees, so keep them private. It's a dev tool:
  anyone on the network can reach the page while it runs, so stop it
  (Ctrl-C) when you're done.
- **`wake.py`**: Wake-on-LAN. Needs **Power On with Mobile** on
  (Settings > Connection > Network > Expert Settings).
  `TV_MAC=AA:BB:CC:DD:EE:FF TV_IP=192.168.1.50 ./wake.py`
