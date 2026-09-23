# Add support for Open Mesh S24 / Datto S24-L (RTL8382M, realtek/rtl838x)

<!-- OpenWrt forum post. Fill in the two <HANDLE> GitHub links, confirm the
     Signed-off-by name, then paste into a "For Developers" thread. -->

Hi all — I've written and hardware-validated full OpenWrt support for the
**Open Mesh S24** (also sold as the **Datto Networking S24-L / DNS-L24**), a
24-port GbE PoE+ + 2x SFP managed switch on the Realtek **RTL8382M**. It boots
current OpenWrt SNAPSHOT from a persistent sysupgrade, with working PoE and all
ports up. I'd welcome a maintainer reviewing it for import.

**Code (patch + submission notes + a ready-to-PR openwrt fork):**
- Patch + full notes: https://github.com/<HANDLE>/openwrt-openmesh-s24-upstream
- openwrt/openwrt fork, commit on `main`: https://github.com/<HANDLE>/openwrt

## Device
- SoC: Realtek RTL8382M rev C; 256 MB RAM; 32 MB SPI-NOR
- 24x GbE copper: 2x external RTL8218B on QSGMII + the RTL8382M internal octal PHY
- 2x 1G SFP on the SoC SerDes
- 24x 802.3at PoE+: 6x Broadcom BCM59111 quad-PSE behind an I2C PoE MCU
  (ST Micro ST32F100) at address 0x21
- The 24-port RTL8382M sibling of the already-supported rtl8380 **datto_l8**
  (Open Mesh S8-L); same Senao ODM platform.

## The change
A single device commit, `realtek: add support for Open Mesh S24` — 2 files:
- `target/linux/realtek/dts/rtl8382_openmesh_s24.dts`
- `target/linux/realtek/image/rtl838x.mk` (adds `Device/openmesh_s24`)

Userspace (a PoE control CLI + a LuCI PoE page) is kept out of the device
commit per OpenWrt policy — it lives in a separate downstream image.

## Design notes for reviewers
- **PoE:** reuses the in-tree Realtek PSE-MCU I2C driver
  (`realtek,pse-mcu-gen1-smbus`), the same transport/dialect as
  `zyxel,gs1920-24hp-v2` — no new driver. Per-port control + power/class
  telemetry work via ethtool; each copper PHY is tied to its PSE PI.
- **SFP:** the two cages have no host-accessible I2C (the stock firmware reads
  the module EEPROM over the Realtek SMI-indirect path), and the kernel sfp
  driver requires an `i2c-bus`, so a managed `sff,sfp` node cannot bind on 6.x.
  The cages are declared **fixed-link 1000base-x** on the PCS, the same idiom as
  the in-tree `tplink_sg2xxx` / `netgear_gs310tp-v1` boards.
- **board.d:** none required. `01_leds` is empty for all realtek boards (LEDs
  are in the DTS, as here); the base MAC is read from the `u-boot-env` `ethaddr`
  via DTS nvmem; and the generic DSA default generates a correct network config
  (verified). Happy to add a `02_network` MAC-assignment entry (per-port/label
  MACs) if preferred.
- **Boot / flash:** stock Senao U-Boot `boota` boots a magic-stamped OpenWrt
  uImage (`UIMAGE_MAGIC=0x00702400`), exactly like `datto_l8`; no U-Boot
  replacement. Stock partition names/offsets kept; the two 0xd30000 runtime
  slots are mtd-concat'd into one firmware region.

## Hardware validation (on a real unit)
- Boots SNAPSHOT r36407 (kernel 6.18.52) from a persistent sysupgrade; DHCP
  lease kept; no panic/boot-loop.
- All 24 GbE + 2 SFP enumerate; both SFP cages configure the PCS/SerDes to
  1000base-x and reach forwarding with zero serdes/pcs/sfp errors.
- PoE: per-port enable/disable and actual-power/class read-out via ethtool; a
  class-3 PD delivers ~5 W on a copper port; per-port available-power-limit
  settable to 30000 mW (802.3at).
- Base MAC read from the u-boot-env.
- Not tested (out of scope, not required for the fixed-link form): a negotiated
  optical link with a physical SFP module.

## Install
1. Attach to the serial console (115200 8n1) and interrupt stock U-Boot.
2. TFTP an OpenWrt `initramfs-kernel` image into RAM and `bootm` it.
3. From the running initramfs, `sysupgrade` the `squashfs-sysupgrade.bin`.

## DCO / licensing
The commit is `Signed-off-by` me (DCO), DTS is SPDX `GPL-2.0-or-later`. Happy to
rebase onto current master, drop/keep the second `compatible`, or address any
review feedback so it can be merged.

Thanks!
