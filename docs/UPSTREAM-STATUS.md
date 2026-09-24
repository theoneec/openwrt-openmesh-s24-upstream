# Upstream status — there is already an effort for this device family

This repository was written before we found the existing upstream work on the
Datto/Open Mesh switch family. It is not a competing port. This file records
what already exists, who is doing it, and what we got wrong by working in
isolation.

## The existing effort

OpenWrt forum, *For Developers*:
**[Add support for Datto L8, E24v3, E48 switches](https://forum.openwrt.org/t/add-support-for-datto-l8-e24v3-e48-switches/241657)**
— running Oct 2025 to Apr 2026 and still active.

| Who | Role |
|---|---|
| **hmartin** (Hal Martin) | Bring-up across L8 / E8 / E24 / E48; source of the GPL archive below |
| **svanheule** | Realtek target maintainer; review and image-recipe guidance |
| **stevewaffler** | Hardware testing on a real E24v3 |
| andyboeh, janh, plappermaul, NRoach44, RaylynnKnight | U-Boot analysis, flashing, discussion |

What is already done there:

- **The Datto L8 is supported in mainline OpenWrt** (`rtl8380_datto_l8.dts`,
  Open Mesh S8-L as the alt-branding). hmartin's latest L8 change,
  [openwrt/openwrt#22764](https://github.com/openwrt/openwrt/pull/22764)
  (*"realtek: fixup Datto L8 device tree"*), merged 3 Apr 2026. Note that
  #22764 is a later fixup, not the commit that first added the L8.
- hmartin has a WIP branch covering the family —
  <https://github.com/halmartin/openwrt/tree/rtl83xx-datto> — with
  `rtl8380_datto_l8.dts`, `rtl8380_datto_e8.dts`, `rtl8396_datto_e24.dts` and
  `rtl8393_datto_e48.dts`. As of 26 Mar 2026: copper, PoE, fans and LEDs
  working on the E24; SFP/SFP+ still WIP.
- hmartin demonstrated installing OpenWrt on the **L8 straight from the stock
  web UI** — no UART, no TFTP.

## The GPL source archive we did not know about

**<https://github.com/halmartin/avalon-l2switch-realtek-rtk8382>** —
*"GPL source code for the Datto E8, E24v3, and E48 switches"*. Also linked from
the OpenWrt wiki's GPL source archive page.

Our reverse engineering was done by **disassembling the vendor binaries**, with
no idea this existed. Anyone picking this work up should start from the
archive. (Its own caveat: the drop is incomplete and does not build as
shipped, so disassembly-derived facts still have corroborating value.)

## Naming convention

Upstream uses `datto,<model>` as the primary compatible with Open Mesh as the
alt-brand — e.g. the merged L8:

```
compatible = "datto,l8", "realtek,rtl838x-soc";
DEVICE_VENDOR      := Datto
DEVICE_MODEL       := L8
DEVICE_ALT0_VENDOR := Open Mesh
DEVICE_ALT0_MODEL  := S8-L
```

This repo uses `"openmesh,s24", "datto,s24-l"` with Open Mesh as the primary
vendor — **inverted relative to upstream convention**. It predates our
discovery of that convention. Realignment is pending and deliberately not done
here, because the compatible is what `board_name()` returns and any per-board
runtime keying has to be re-validated on hardware first. Documented as a known
delta rather than silently changed.

## Sibling repository

The RTL8396M E24v3 work, which carries the substantive findings we are offering
into the thread — the LM63 fan-control root cause, the PSE `port ^ 3` channel
mapping, and the single-I2C-bus correction — is in
**[`openwrt-openmesh-e24-upstream`](https://github.com/theoneec/openwrt-openmesh-e24-upstream)**;
see its `docs/UPSTREAM-STATUS.md`.

## Corrections to our own documentation, from the thread

- **U-Boot autoboot interrupt is `pac`** — the letters **a**, **p**, **c** in
  any order. janh traced it to `abortboot` in the U-Boot source. Our docs said
  "apc"; same letters, now with a source and a mechanism.
- **Root shell on the stock firmware.** Interrupt U-Boot, then:
  ```
  sf read $(freemem) $(flashoffset_linux) $(ssize_linux)
  setenv bootargs console=ttyS0,115200 mem=256M rdinit=/bin/sh
  bootm $(freemem)
  ```
  **Do not quote the `bootargs` value.** At the early shell, `rm /bin/cli` then
  run `/etc/rc` — the box boots on into a root shell instead of the vendor CLI.
  This supersedes anything we wrote about the console being owned by a login
  prompt.
- **Stock default credentials after a factory reset:** `admin` / `0p3nm3$h!`
  (published in the thread).
- **Hidden vendor CLI commands** live in `libcustom.so.0`, including
  `mphiddenpoe poe power-budget <1-999>` — the vendor treats the chassis PoE
  budget as a settable value with no per-unit storage.
- **`.bix` board magic family:**

  | Device | `UIMAGE_MAGIC` |
  |---|---|
  | E24v3 | `0x00702202` |
  | E48 | `0x00702201` |
  | **S24-L / L24** | **`0x00702400`** |

  The container is a standard U-Boot legacy uImage with the magic word
  replaced. There is **no cryptographic signature** — only the magic, the
  header CRC and the payload CRC.
- **svanheule's guidance on images**, answering hmartin: the **Zyxel GS1900
  recipes** are the pattern — the initramfs/factory image must stay within the
  original `0xd30000` partition, while the sysupgrade image may span the merged
  firmware partitions. That is the route to a factory image flashable from the
  stock web UI. Not implemented here.

## Credit

The family bring-up branch, the fan symptom characterisation and the GPL source
archive are **hmartin's**. The image-recipe guidance is **svanheule's**. The
E24v3 field reports are **stevewaffler's**. The `abortboot` finding is
**janh's**.
