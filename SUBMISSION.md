# PR: realtek: add support for Open Mesh S24

## Title
`realtek: add support for Open Mesh S24`

## Description
Adds support for the Open Mesh S24 (Datto Networking S24-L), a 24-port GbE + 2× SFP PoE+ managed switch based on the Realtek RTL8382M.

- Datapath: 24× GbE via 3× RTL8218B; 2× SFP on the SoC SerDes (fixed-link 1000base-x); RTL8231 GPIO expander for LEDs/reset.
- PoE: 24-port PoE+ via an I2C PoE MCU (BCM59111 behind an ST32F100 MCU) @0x21, using the in-tree Realtek PSE-MCU I2C driver (`realtek,pse-mcu-gen1-smbus`). Per-port control + power telemetry via ethtool.
- Boot: stock U-Boot `boota` accepts a magic-stamped uImage (UIMAGE_MAGIC 0x00702400), same mechanism as the in-tree `datto_l8`. No U-Boot replacement.
- MAC read from the u-boot-env via nvmem.

Tested on hardware: boots SNAPSHOT r36407 from a persistent sysupgrade; 24 GbE + 2 SFP enumerate; PoE per-port enable/disable + actual-power readout confirmed via ethtool.

## DCO
`Signed-off-by: James Perez-Clifton <jamesperezclifton2016@gmail.com>`
>> CONFIRM this is your exact legal name + email before submitting; it must match the commit author.

## Reviewer discussion points (anticipated)
1. SFP as fixed-link: the SFP cages have no host-accessible I2C (EEPROM is SMI-indirect), so declared fixed-link 1000base-x on the SerDes (idiom of tplink_sg2xxx / netgear_gs310tp), not sff,sfp — a sff,sfp node without an i2c-bus is non-functional on 6.x (sfp_probe -ENODEV).
2. Dual compatible "openmesh,s24","datto,s24-l": a reviewer may prefer dropping datto,s24-l and expressing the alt-brand only via DEVICE_ALT0_*.
3. dtc: clean; only pre-existing base rtl838x.dtsi warnings shared by all realtek boards.

## Base
Generated against openwrt/openwrt master @ 14651b96832a9f9cef3b7bdcfb3dfecf9161ac58.
