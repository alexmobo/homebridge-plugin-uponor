import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { UponorPlatform } from '../platform';
import { UponorCoolingMode } from '../devices/UponorCoolingMode';
import { MANUFACTURER } from '../devices/const';
import { UponorDevice } from '../devices/UponorDevice';
import BigNumber from 'bignumber.js';

export class UponorCoolingSwitchAccessory {
  private service: Service;

  constructor(
    private readonly platform: UponorPlatform,
    private readonly accessory: PlatformAccessory<UponorCoolingMode>,
    private readonly thermostatAccessories: PlatformAccessory<UponorDevice>[],
  ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, MANUFACTURER)
      .setCharacteristic(this.platform.Characteristic.Model, this.accessory.context.model);

    this.service = this.accessory.getService(this.platform.Service.Switch)
      || this.accessory.addService(this.platform.Service.Switch);

    this.service.setCharacteristic(
      this.platform.Characteristic.On,
      this.accessory.context.isCoolingEnabled,
    );
    this.service.setCharacteristic(this.platform.Characteristic.Name, 'Modo Frío');

    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onGet((): Promise<boolean> => this.platform.uponorProxy.isCoolingEnabled())
      .onSet(async (value: CharacteristicValue): Promise<void> => {
        const isCoolingEnabled: boolean = value as boolean;

        for (const thermostatAccessory of this.thermostatAccessories) {
          if (isCoolingEnabled) {
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

        await this.platform.uponorProxy.setCoolingMode(isCoolingEnabled);
        this.accessory.context.isCoolingEnabled = isCoolingEnabled;
      });
  }
}
