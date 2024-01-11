# Uponor Plugin for Homebridge

Uponor Smatrix Pulse heating/cooling integration for Homebridge.

Inspired by https://github.com/asev/homeassistant-uponor.

## Supported devices

This integration communicates with Uponor Smatrix Pulse communication module R-208. It should work with all controllers that support this module.

## Accessories

- THERMOSTAT: One Thermostat accessory will be created for each Uponor thermostat.
- COOLING MODE: One Switch to switching between heating and cooling.
- AWAY MODE: One Switch to switching between normal and away.

## Catches and limitations

- Uponor API doesn't support heat/cool switch for single thermostat. switch.uponor_cooling_mode change mode for entire system.
- Uponor API does not support turn off action. When climate entity is turned off on Homebridge, the temperature is set to the minimum (default 5℃) when heating mode is active and to the maximum (default 35℃) when cooling mode is active.

## Feedback

Your feedback, pull requests or any other contribution are very much welcome.