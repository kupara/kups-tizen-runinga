# Cutting Samsung's ads and tracking (Tizen 8)

These are the changes made on a 2023 Samsung QLED (Q70C) on Tizen 8. Menu
names and positions can differ on other models and years. Every change can be
undone except the advertising-ID reset, which is harmless. Before changing
anything, photograph or write down what each setting is now, so you can put it
back exactly.

"Settings" below means: on the Home screen press Left, go down to
**Settings**, press OK. That opens a row of quick settings; **All Settings** is
the first item. (The remote's Menu key on some remotes, and `KEY_MENU` over the
network, opens All Settings directly.)

## Privacy and promotions

| Change | Where | Undo |
|---|---|---|
| Stop content recognition ("Viewing Information Services": identifies what's on screen, HDMI inputs included, for ads) | Left menu > **Privacy Choices** > Terms & Conditions, Privacy Policy > untick **Viewing Information Services** > move down to **OK** (leave "I agree to all" unticked) | Same screen, tick it, OK |
| Stop personalised ads | Same screen: untick **Interest-Based Advertisements** | Tick it again |
| Reset the advertising ID | Settings > All Settings > General & Privacy > Terms & Privacy > **Reset PSID** > Reset | Not possible by design (nothing depends on the old ID) |
| Stop promotional pop-ups | Settings > **Notification** (just above All Settings) > gear icon > untick **Samsung Promotion** > OK | Tick it again |
| Don't open Smart Hub at power-on | Settings > All Settings > General & Privacy > **Start Screen Options** > **Start with Smart Hub Home** off | Switch it on |
| Mute Home-screen previews | Home > For You tab > scroll to the very bottom > Media Options > **Autoplay Sound** | Press OK again |
| Tidy the Home row | Highlight a tile, hold OK > **Remove** (the app stays installed). Hold OK and use Left/Right to move tiles. | Apps tab > App Settings > the app > **Add to Home** |

Careful in these menus:

- **Factory data reset** is the item just below Start Screen Options.
- In App Settings, **Delete** uninstalls an app; use Add to Home or the Home
  row's Remove instead.
- **Reset Smart Hub** (Support > Device Care) signs you out of everything and
  removes downloaded apps.
- Samsung's OS upgrades (for example to Tizen 9 / One UI Tizen) can't be undone.

## Ad and tracker blocking with DNS (this TV only)

Settings > All Settings > Connection > Network > **Network Status** > **IP
Settings** > **DNS Setting**: **Enter manually**, then **DNS Server**
`76.76.2.37` > **Done** > **OK**. Leave the IP setting on automatic.

- On the tested TV, number keys from the remote didn't fill the DNS boxes; the
  on-screen keypad did (digits replace a box's contents, `>` moves to the next
  box, then **Done**).
- `76.76.2.37` is Control D's free, no-log "HaGeZi Light" filter (backup:
  `76.76.10.37`). Checked before use: it blocks Samsung's ad servers, content
  recognition hosts and crash/log uploads, and none of about 46 hosts needed
  for firmware updates, the app store, your Samsung account, Samsung TV Plus or
  the main streaming apps. After the change, YouTube, Netflix, Prime Video,
  Disney+ and Samsung TV Plus all worked.
- It won't remove YouTube ads or ads built into a video stream, and it also
  blocks some broadcasters' analytics.
- The TV takes only one DNS server: if the filter service is down, the TV has
  no internet. **If the TV loses internet but other devices don't, set DNS
  Setting back to "Get automatically" first.**
- Undo: the same screen > DNS Setting > **Get automatically** > OK.

## What you can't change

- The **New & Trending**, **Live** and similar rows, and the big banner at the
  top of Smart Hub: there is no setting for them (DNS filtering can blank some
  ad tiles).
- The fixed left-hand menu (Daily+, Game and so on).
- What the **Home** button opens. [Glass Home](../README.md) gets close by
  starting at power-on.

## Doing it from a computer

Samsung TVs have a local remote-control API (WebSocket, port 8002) that
[`tools/tvremote.py`](../tools/tvremote.py) uses. The first connection shows an
**Allow** prompt on the TV. Useful keys: `KEY_HOME`, `KEY_MENU` (All
Settings), `KEY_EXIT` (closes every menu), arrows, `KEY_ENTER`, `KEY_RETURN`.
Samsung TVs can't take screenshots over the network, so check each step by
eye, or with an iPhone pointed at the TV using
[`tools/phonecam.py`](../tools/phonecam.py).
