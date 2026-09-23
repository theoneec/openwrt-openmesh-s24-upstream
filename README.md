# OpenWrt support for Open Mesh S24 / Datto S24-L

Upstream-ready OpenWrt device support for the **Open Mesh S24** (a.k.a. **Datto Networking S24-L / DNS-L24**) — a 24-port GbE PoE+ managed switch with 2× SFP, on the Realtek **RTL8382M** (`realtek/rtl838x` target).

This repo holds the **exact patch OpenWrt expects** for a new-device contribution, ready to `git am` onto a clone of `openwrt/openwrt` and open a Pull Request.

## What this is (and is not)
- **Upstream device support**: one clean commit adding a DTS + image recipe. PoE reuses the **in-tree** Realtek PSE-MCU driver (`realtek,pse-mcu-gen1-smbus`) — **no out-of-tree driver** (writing one would be rejected; the driver is already in OpenWrt master).
- **NOT the release firmware.** The flashable build (PoE CLI + LuCI GUI, DHCP-default, 30 W-per-port) is a downstream customisation kept separate — see `release/`.

## The commit
`realtek: add support for Open Mesh S24` — exactly 2 files:
- `target/linux/realtek/dts/rtl8382_openmesh_s24.dts`
- `target/linux/realtek/image/rtl838x.mk` (adds `Device/openmesh_s24`)

Base: `openwrt/openwrt` master @ `14651b96832a9f9cef3b7bdcfb3dfecf9161ac58`.

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

## Hardware (verified on real silicon)
RTL8382M rev C, 256 MB; 24× GbE (3× RTL8218B); 2× SFP (SerDes, fixed-link 1000base-x); 24-port PoE+ via an I2C PoE MCU (ST32F100 fronting BCM59111) @0x21 driven by the in-tree Realtek PSE-MCU I2C driver. Boots via stock U-Boot `boota` (uImage magic 0x00702400, like `datto_l8`); MAC from u-boot-env. Booted mainline OpenWrt (SNAPSHOT r36407); 24 GbE + PoE (per-port control + power telemetry via ethtool) confirmed.
