import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { UponorPlatform } from '../platform';
import { MANUFACTURER } from '../devices/const';
import { UponorDevice } from '../devices/UponorDevice';
import BigNumber from 'bignumber.js';
import { UponorAwayMode } from '../devices/UponorAwayMode';

export class UponorAwaySwitchAccessory {
  private service: Service;

  constructor(
    private readonly platform: UponorPlatform,
    private readonly accessory: PlatformAccessory<UponorAwayMode>,
    private readonly thermostatAccessories: PlatformAccessory<UponorDevice>[],
  ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, MANUFACTURER)
      .setCharacteristic(this.platform.Characteristic.Model, this.accessory.context.model);

    this.service = this.accessory.getService(this.platform.Service.Switch)
      || this.accessory.addService(this.platform.Service.Switch);

    this.service.setCharacteristic(
      this.platform.Characteristic.On,
      this.accessory.context.isAwayEnabled,
    );
    this.service.setCharacteristic(this.platform.Characteristic.Name, 'Modo Vacaciones');

    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onGet((): Promise<boolean> => this.platform.uponorProxy.isAwayEnabled())
      .onSet(async (value: CharacteristicValue): Promise<void> => {
        const isAwayEnabled: boolean = value as boolean;

        for (const thermostatAccessory of this.thermostatAccessories) {
          if (isAwayEnabled) {
            const targetTemperature: BigNumber = await this.platform.uponorProxy.getTargetTemperature(thermostatAccessory.context.code);
            const minLimitTemperature: BigNumber = this.platform.uponorProxy.getMinLimitTemperature(thermostatAccessory.context.code);
            if (targetTemperature === minLimitTemperature) {
              await this.platform.uponorProxy.setTargetTemperature(
                thermostatAccessory.context.code,
                this.platform.uponorProxy.getMaxLimitTemperature(thermostatAccessory.context.code),
              );
            }
          } else {
            const targetTemperature: BigNumber = await this.platform.uponorProxy.getTargetTemperature(thermostatAccessory.context.code);
            const maxLimitTemperature: BigNumber = this.platform.uponorProxy.getMaxLimitTemperature(thermostatAccessory.context.code);
            if (targetTemperature === maxLimitTemperature) {
              await this.platform.uponorProxy.setTargetTemperature(
                thermostatAccessory.context.code,
                this.platform.uponorProxy.getMinLimitTemperature(thermostatAccessory.context.code),
              );
            }
          }
        }

        await this.platform.uponorProxy.setAwayMode(isAwayEnabled);
        this.accessory.context.isAwayEnabled = isAwayEnabled;
      });
  }
}
