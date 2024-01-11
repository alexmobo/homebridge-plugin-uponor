import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { UponorPlatform } from '../platform';
import { MANUFACTURER } from '../devices/const';
import { UponorDevice, UponorDeviceState } from '../devices/UponorDevice';
import BigNumber from 'bignumber.js';

export class UponorThermostatAccessory {
  private service: Service;

  constructor(
    private readonly platform: UponorPlatform,
    private readonly accessory: PlatformAccessory<UponorDevice>,
  ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, MANUFACTURER)
      .setCharacteristic(this.platform.Characteristic.Model, this.accessory.context.model)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.context.code);

    this.service = this.accessory.getService(this.platform.Service.Thermostat)
      || this.accessory.addService(this.platform.Service.Thermostat);

    this.service.setCharacteristic(
      this.platform.Characteristic.CurrentHeatingCoolingState,
      this.toCurrentHeatingCoolingState(this.accessory.context.currentHvacMode),
    );
    this.service.setCharacteristic(
      this.platform.Characteristic.TargetHeatingCoolingState,
      this.platform.Characteristic.TargetHeatingCoolingState.AUTO,
    );
    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .setProps({
        minValue: this.accessory.context.minLimitTemperature.toNumber(),
        maxValue: this.accessory.context.maxLimitTemperature.toNumber(),
      });
    this.service.setCharacteristic(
      this.platform.Characteristic.CurrentTemperature,
      this.accessory.context.currentTemperature.toNumber(),
    );
    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .setProps({
        minValue: this.accessory.context.minLimitTemperature.toNumber(),
        maxValue: this.accessory.context.maxLimitTemperature.toNumber(),
        minStep: 0.5,
      });
    this.service.setCharacteristic(
      this.platform.Characteristic.TargetTemperature,
      this.accessory.context.targetTemperature.toNumber(),
    );
    this.service.setCharacteristic(
      this.platform.Characteristic.TemperatureDisplayUnits,
      this.platform.config.displayUnit === 'CELSIUS'
        ? this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS
        : this.platform.Characteristic.TemperatureDisplayUnits.FAHRENHEIT,
    );

    this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.context.name);

    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .onGet(async (): Promise<CharacteristicValue> => {
        const state: UponorDeviceState = await this.platform.uponorProxy.getCurrentHeatingCoolingState(
          this.accessory.context.code,
        );
        this.accessory.context.currentHvacMode = state;
        return this.toCurrentHeatingCoolingState(state);
      });
    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(async (): Promise<CharacteristicValue> => {
        const currentTemperature: BigNumber = await this.platform.uponorProxy.getCurrentTemperature(
          this.accessory.context.code,
        );
        this.accessory.context.currentTemperature = currentTemperature;
        this.accessory.context.isOn = await this.platform.uponorProxy.isOn(this.accessory.context.code);
        return currentTemperature.toNumber();
      });
    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .onGet(async (): Promise<CharacteristicValue> => {
        const targetTemperature: BigNumber = await this.platform.uponorProxy.getTargetTemperature(
          this.accessory.context.code,
        );
        this.accessory.context.targetTemperature = targetTemperature;
        return targetTemperature.toNumber();
      })
      .onSet(async (value: CharacteristicValue): Promise<void> => {
        const targetTemperature: BigNumber = BigNumber(value as number);
        await this.platform.uponorProxy.setTargetTemperature(
          this.accessory.context.code,
          targetTemperature,
        );
        this.accessory.context.targetTemperature = targetTemperature;
      });
    this.service.getCharacteristic(this.platform.Characteristic.Name)
      .onGet(async (): Promise<CharacteristicValue> => {
        const name: string = await this.platform.uponorProxy.getName(this.accessory.context.code);
        this.accessory.context.name = name;
        return name;
      });
  }

  private toCurrentHeatingCoolingState = (state: UponorDeviceState): number => {
    switch (state) {
      case UponorDeviceState.HEATING:
        return this.platform.Characteristic.CurrentHeatingCoolingState.HEAT;
      case UponorDeviceState.COOLING:
        return this.platform.Characteristic.CurrentHeatingCoolingState.COOL;
      default:
        return this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
    }
  };
}
