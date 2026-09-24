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
no idea this existed.

**But it is incomplete, so do not clone 553 MB expecting the whole system.** It
ships only `u-boot-2011.12/` and a near-vanilla `kernel/uClinux/`. Its own
top-level Makefile shows the real build had four components — `KERNEL_DIR`,
`LOADER_DIR`, `SDK_DIR`, `TURNKEY_DIR` — and the last three are absent.
`kernel/uClinux/user/switch/` holds only a Makefile, `arch/mips/` has
`Kconfig.realtek` but no `realtek/` board directory, and twelve symlinks dangle
into a build machine's home directory. **The PoE stack, the fan init and the
board configuration are not in it**, so for those the disassembly is still the
only source. It does confirm **Senao** as the ODM and names the OEM model list
(`oms8 oms24 oms48 s24-l s8-l`, plus `p-` and `ps-` variants).

What it does give, from `u-boot-2011.12/`, is independent confirmation of a few
things and a correction to one of our claims:

- **No cryptographic signature anywhere** — the boot path checks
  magic / header-CRC / data-CRC / arch, and the TFTP upgrade path
  (`cmd_upgrade.c:339-350`) checks header CRC then data CRC.
- **The boot-partition selector lives in SYSINFO, not the U-Boot environment**
  (`include/turnkey/sysinfo.h:39-46`: `bootpartition`, `dualfname0`, `boardid`,
  `flsheras`, `pwdrecov`, `factdflt`, `resetdflt`).
- **Dual-image geometry matches ours** — a leftover Senao `.config.old` has
  `CONFIG_DUAL_IMAGE=y`, `CONFIG_DUAL_IMAGE_PARTITION_SIZE=0xD30000`,
  `CONFIG_ENV_OFFSET=0x80000`, `CONFIG_BOOTCOMMAND="boota"`,
  `CONFIG_FLASH_LAYOUT_TYPE4=y`.
- **`boota` erases 4 KB — the image header — from a partition that fails to
  boot**, and flips the active-partition selector
  (`common/cmd_bootm.c:1660-1663`). One failed attempt destroys that slot's
  image. This was an inference; it is now fact, and it is the single most
  useful operational warning in the archive.
- **Correction — we should not have implied the loader validates the magic.**
  `image.h:192-196` and `:485-492` compile `image_check_magic()` out unless
  `CONFIG_ENABLE_IH_MAGIC_NUMBER_CHK` is defined, and that symbol appears
  nowhere in the archive. The header CRC and data CRC are definitely checked;
  magic enforcement on the shipped loader is **unverified**.
- **We cannot explain the magic encoding either.** `image.h:178-190` documents
  it as [b31..b12] Chip ID / [b11..b04] Vendor ID / [b03..b00] Product ID, set
  from `CONFIG_IH_MAGIC_NUMBER` (the archive's one real example is `83800000`,
  the RTL8380 chip ID). Our values do not fit — `0x00702400` would give a chip
  ID of `0x00702`, which is not a Realtek chip ID. The **values** are read from
  real flash dumps; the scheme is Senao's and we are not going to guess at it.
- **The sibling 1G-fibre board file**
  `rtl8382m_8218b_intphy_8218b_2fib_1g_demo_board.c` places its two fibre ports
  at mac_id **24 and 26**, matching this board — which is what makes the
  E24v3's **24 and 36** a genuine per-board difference rather than a typo.

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
  replaced by a per-board identifier. There is **no cryptographic signature**;
  the **header CRC and payload CRC** are what is definitely validated, and
  magic enforcement on the shipped loader is unverified — see the archive
  section above.
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
