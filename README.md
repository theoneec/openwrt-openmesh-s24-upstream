# OpenWrt support for Open Mesh S24 / Datto S24-L

Upstream-ready OpenWrt device support for the **Open Mesh S24** (a.k.a. **Datto Networking S24-L / DNS-L24**) — a 24-port GbE PoE+ managed switch with 2× SFP, on the Realtek **RTL8382M** (`realtek/rtl838x` target).

This repo holds the **exact patch OpenWrt expects** for a new-device contribution, ready to `git am` onto a clone of `openwrt/openwrt` and open a Pull Request.

> ## Upstream context — read this first
>
> There is an active, year-old OpenWrt effort covering this device family,
> which we were unaware of while doing this work:
> **[Add support for Datto L8, E24v3, E48 switches](https://forum.openwrt.org/t/add-support-for-datto-l8-e24v3-e48-switches/241657)**
> (*For Developers*, Oct 2025 – Apr 2026), driven by **hmartin**, with review
> from **svanheule** (Realtek target maintainer) and hardware testing from
> **stevewaffler**.
>
> - The **Datto L8 is already in mainline**; hmartin's latest L8 change,
>   [openwrt/openwrt#22764](https://github.com/openwrt/openwrt/pull/22764),
>   merged 3 Apr 2026.
> - hmartin has a WIP branch covering L8 / E8 / E24 / E48:
>   <https://github.com/halmartin/openwrt/tree/rtl83xx-datto>.
> - **A GPL source archive for these devices already exists**:
>   <https://github.com/halmartin/avalon-l2switch-realtek-rtk8382> — *"GPL
>   source code for the Datto E8, E24v3, and E48 switches"*, also linked from
>   the OpenWrt wiki GPL archive page. **We did our reverse engineering by
>   disassembling vendor binaries without knowing it existed** — though the
>   archive turns out to be incomplete (U-Boot and a near-vanilla kernel only;
>   no PoE stack, no board configuration). See
>   [`docs/UPSTREAM-STATUS.md`](docs/UPSTREAM-STATUS.md).
>
> This work is offered **into** that effort, not against it. Detail, credits
> and our known naming delta: **[`docs/UPSTREAM-STATUS.md`](docs/UPSTREAM-STATUS.md)**.

## What this is (and is not)
- **Upstream device support**: one clean commit adding a DTS + image recipe. PoE reuses the **in-tree** Realtek PSE-MCU driver (`realtek,pse-mcu-gen1-smbus`) — **no out-of-tree driver** (writing one would be rejected; the driver is already in OpenWrt master).
- **NOT the release firmware.** The flashable build (PoE CLI + LuCI GUI, DHCP-default, 30 W-per-port) is a downstream customisation kept separate — see `release/`.

## The commit
`realtek: add support for Open Mesh S24` — exactly 2 files:
- `target/linux/realtek/dts/rtl8382_openmesh_s24.dts`
- `target/linux/realtek/image/rtl838x.mk` (adds `Device/openmesh_s24`)

Base: `openwrt/openwrt` master @ `14651b96832a9f9cef3b7bdcfb3dfecf9161ac58`.

## Known delta — naming
Upstream convention, set by the merged L8, is `datto,<model>` as the primary
compatible with Open Mesh as the alt-brand (`"datto,l8"`, `DEVICE_VENDOR := Datto`,
`DEVICE_ALT0_VENDOR := Open Mesh` / `DEVICE_ALT0_MODEL := S8-L`). This repo uses
`"openmesh,s24", "datto,s24-l"` with Open Mesh primary — **inverted**. Ours
predates our discovery of that convention; realignment is pending and is not
done here because the compatible is what `board_name()` returns and any
per-board runtime keying must be re-validated on hardware first. See
`docs/UPSTREAM-STATUS.md`.

## Apply + build
```sh
git clone https://github.com/openwrt/openwrt.git && cd openwrt
git am /path/to/patches/0001-realtek-add-support-for-Open-Mesh-S24.patch
./scripts/feeds update -a && ./scripts/feeds install -a
make menuconfig   # Target System: Realtek MIPS (rtl838x); select device "Open Mesh S24"
make -j$(nproc)
```

## Submit upstream (the OpenWrt way)
1. Fork `openwrt/openwrt` on GitHub.
2. `git am` this patch onto your fork.
3. **Confirm the DCO Signed-off-by is your real name+email** (see `SUBMISSION.md`).
4. Push and open a PR against `openwrt/openwrt`; use the description in `SUBMISSION.md`.
   Consider replying in the forum thread above first — this device family
   already has an owner doing the work.

## Hardware (verified on real silicon)
RTL8382M rev C, 256 MB; 24× GbE (3× RTL8218B); 2× SFP (SerDes, fixed-link 1000base-x); 24-port PoE+ via an I2C PoE MCU (ST32F100 fronting BCM59111) @0x21 driven by the in-tree Realtek PSE-MCU I2C driver. Boots via stock U-Boot `boota` (uImage magic 0x00702400, like `datto_l8`); MAC from u-boot-env. Booted mainline OpenWrt (SNAPSHOT r36407); 24 GbE + PoE (per-port control + power telemetry via ethtool) confirmed.

## `.bix` board magic family
The `.bix` container is a standard U-Boot legacy uImage with the magic word
replaced by a per-board identifier. There is **no cryptographic signature** in
either the boot path or the TFTP upgrade path — **the header CRC and the
payload CRC are what is definitely validated** (confirmed in the vendor GPL
source). Whether the shipped loader also enforces the magic is **unverified**:
that source compiles `image_check_magic()` out by default, and we have never
deliberately flashed a wrong one. We stamp the matching value regardless.

| Device | `UIMAGE_MAGIC` |
|---|---|
| E24v3 | `0x00702202` |
| E48 | `0x00702201` |
\1
> **Warning:** `boota` **erases 4 KB — the image header — from a partition that
> fails to boot**, and flips the active-partition selector
> (`common/cmd_bootm.c:1660-1663` in the vendor source). One failed attempt
> destroys that slot's image.

## Stock firmware: console access
- **Interrupt autoboot with `pac`** — the letters `a`, `p`, `c` in any order.
  janh traced it to `abortboot` in the U-Boot source. (Earlier notes said
  "apc": same letters, but this is the actual rule and the source for it.)
- **Root shell**, bypassing the vendor CLI. Interrupt U-Boot, then:
  ```
  sf read $(freemem) $(flashoffset_linux) $(ssize_linux)
  setenv bootargs console=ttyS0,115200 mem=256M rdinit=/bin/sh
  bootm $(freemem)
  ```
  **Do not quote the `bootargs` value.** At the early shell, `rm /bin/cli`,
  then run `/etc/rc` — the box boots on into a root shell instead of the vendor
  CLI. This supersedes anything previously written here about the console being
  owned by a login prompt.
- **Stock defaults after a factory reset:** `admin` / `0p3nm3$h!` (published in
  the forum thread).
- Hidden vendor CLI commands live in `libcustom.so.0`, including
  `mphiddenpoe poe power-budget <1-999>`.
