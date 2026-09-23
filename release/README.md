# Release firmware (downstream — deliberately NOT upstream)

On top of the upstream device support, the flashable release adds:
- `/usr/bin/poe` — CLI: per-port PoE control + power table (ethtool/PSE-MCU)
- LuCI **Network → PoE** page — per-port on/off, power, total draw vs budget
- `/etc/config/poe` + `/etc/init.d/poe` — persistence (re-apply saved state at boot)
- `/etc/uci-defaults` — LAN defaults to a DHCP client
- default_state=on (all ports armed), default per-port limit 30000 mW (30 W PoE+), budget_w 250 (configurable to your PSU)

These are downstream customisations (an OpenWrt image `files/` overlay) and are intentionally excluded from the upstream commit. Full source + build config: the private build repo / release artifacts.
