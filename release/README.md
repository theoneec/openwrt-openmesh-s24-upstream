# Release firmware (downstream — deliberately NOT upstream)

On top of the upstream device support, the flashable release adds:
- `/usr/bin/poe` — CLI: per-port PoE control + power table (ethtool/PSE-MCU)
- LuCI **Network → PoE** page — per-port on/off, power, total draw vs budget
- `/etc/config/poe` + `/etc/init.d/poe` — persistence (re-apply saved state at boot)
- `/etc/uci-defaults` — LAN defaults to a DHCP client
- default_state=on (all ports armed), default per-port limit 30000 mW (30 W PoE+), budget_w 250 (configurable to your PSU)

These are downstream customisations (an OpenWrt image `files/` overlay) and are intentionally excluded from the upstream commit. Full source + build config: the private build repo / release artifacts.

## Source (included here under `files/`)

The overlay that produces the release image (all no-secret):
- `files/usr/bin/poe` — PoE control CLI (ethtool/PSE-MCU): show/on/off/limit/reset/apply
- `files/usr/libexec/rpcd/luci.poe` — rpcd backend for the LuCI page (allowlist-validated)
- `files/usr/share/rpcd/acl.d/luci-app-poe.json`, `files/usr/share/luci/menu.d/luci-app-poe.json`
- `files/www/luci-static/resources/view/poe/status.js` — the LuCI "Network -> PoE" view (table, per-port on/off + Reset, total/budget)
- `files/etc/config/poe` — default_state on, default_limit 30000 (30 W), budget_w 250
- `files/etc/init.d/poe` — re-applies saved PoE state at boot (after the PSE MCU probes)
- `files/etc/uci-defaults/99-openmesh-s24` — LAN defaults to DHCP client
Build: place these in `files/` at the OpenWrt buildroot top level; they bake into the image rootfs.
