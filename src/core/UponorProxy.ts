import UponorAPI from './UponorAPI';
import { UponorDevice, UponorDeviceState } from '../devices/UponorDevice';
import { Mutex } from 'async-mutex';
import { Logger } from 'homebridge';
import { UponorAPIData } from './UponorAPIData';
import BigNumber from 'bignumber.js';
import { TemperatureDisplayUnit } from '../settings';
import { UponorCoolingMode } from '../devices/UponorCoolingMode';
import { UponorAwayMode } from '../devices/UponorAwayMode';

const EXPIRATION_TIME = 1000;

export class UponorProxy {
  private lastUpdatedAt: Date | null = null;
  private uponorData: UponorAPIData | null = null;
  private mutex: Mutex = new Mutex();

  private readonly uponorApi: UponorAPI;

  constructor(
    private readonly log: Logger,
    host: string,
    private readonly displayUnit: TemperatureDisplayUnit,
  ) {
    this.uponorApi = new UponorAPI(log, host);
  }

  getDevices = async (): Promise<UponorDevice[]> => {
    await this.updateData();
    const deviceCodes: string[] = await this.uponorData!.getDeviceCodes();
    return deviceCodes.map((code: string): UponorDevice => {
      return {
        id: this.uponorData!.getId(code),
        code,
        name: this.uponorData!.getName(code),
        model: this.uponorData!.getModel(),
        version: this.uponorData!.getVersion(code),
        isOn: this.uponorData!.isOn(code),
        isEcoEnabled: this.uponorData!.isEcoEnabled(code),
        currentHvacMode: this.toUponorCurrentHvacMode(
          this.uponorData!.isOn(code),
          this.uponorData!.isCoolingEnabled(),
        ),
        currentTemperature: this.calculateCurrentTemperature(code),
        targetTemperature: this.calculateTargetTemperature(code),
        minLimitTemperature: this.getMinLimitTemperature(code),
        maxLimitTemperature: this.getMaxLimitTemperature(code),
      };
    });
  };

  getCoolingMode = async (): Promise<UponorCoolingMode> => ({
    model: this.uponorData!.getModel(),
    isCoolingEnabled: await this.isCoolingEnabled(),
  });

  getAwayMode = async (): Promise<UponorAwayMode> => ({
    model: this.uponorData!.getModel(),
    isAwayEnabled: await this.isAwayEnabled(),
  });

  getCurrentHeatingCoolingState = async (thermostat: string): Promise<UponorDeviceState> => {
    await this.updateData();
    return this.toUponorCurrentHvacMode(
      this.uponorData!.isOn(thermostat),
      this.uponorData!.isCoolingEnabled(),
    );
  };

  getCurrentTemperature = async (thermostat: string): Promise<BigNumber> => {
    await this.updateData();
    return this.calculateCurrentTemperature(thermostat);
  };

  getTargetTemperature = async (thermostat: string): Promise<BigNumber> => {
    await this.updateData();
    return this.calculateTargetTemperature(thermostat);
  };

  setTargetTemperature = async (thermostat: string, targetTemperature: BigNumber): Promise<void> => {
    this.uponorData!.setTargetTemperature(thermostat, targetTemperature);
    await this.uponorApi.setData(this.uponorData!.toSetTargetTemperaturePayload(thermostat));
    await this.updateData();
  };

  getMinLimitTemperature = (thermostat: string): BigNumber => {
    const isDisplayUnitCelsius: boolean = this.displayUnit === TemperatureDisplayUnit.CELSIUS;
    const minLimit: BigNumber = this.uponorData!.getMinLimit(thermostat);
    if (isDisplayUnitCelsius) {
      return minLimit;
    }
    return BigNumber(minLimit).times(9).div(5).plus(32);
  };

  getMaxLimitTemperature = (thermostat: string): BigNumber => {
    const isDisplayUnitCelsius: boolean = this.displayUnit === TemperatureDisplayUnit.CELSIUS;
    const maxLimit: BigNumber = this.uponorData!.getMaxLimit(thermostat);
    if (isDisplayUnitCelsius) {
      return maxLimit;
    }
    return BigNumber(maxLimit).times(9).div(5).plus(32);
  };

  getName = async (thermostat: string): Promise<string> => {
    await this.updateData();
    return this.uponorData!.getName(thermostat);
  };

  isOn = async (thermostat: string): Promise<boolean> => {
    return this.uponorData!.isOn(thermostat);
  };

  isCoolingEnabled = async (): Promise<boolean> => {
    await this.updateData();
    return this.uponorData!.isCoolingEnabled();
  };

  isAwayEnabled = async (): Promise<boolean> => {
    await this.updateData();
    return this.uponorData!.isAwayEnabled();
  };

  isEcoEnabled = async (thermostat: string): Promise<boolean> => {
    await this.updateData();
    return this.uponorData!.isEcoEnabled(thermostat);
  };

  setCoolingMode = async (newCoolingMode: boolean): Promise<void> => {
    this.uponorData!.setCoolingMode(newCoolingMode);
    await this.uponorApi.setData(this.uponorData!.toSetCoolingModePayload());
    await this.updateData();
  };

  setAwayMode = async (newAwayMode: boolean): Promise<void> => {
    this.uponorData!.setAwayMode(newAwayMode);
    await this.uponorApi.setData(this.uponorData!.toSetAwayModePayload());
    await this.updateData();
  };

  private updateData = (): Promise<void> => this.mutex.runExclusive(async (): Promise<void> => {
    if (this.lastUpdatedAt && (new Date().getTime() - this.lastUpdatedAt.getTime()) < EXPIRATION_TIME) {
      return;
    }

    this.uponorData = await this.uponorApi.getData();
    this.lastUpdatedAt = new Date();
  });

  private toUponorCurrentHvacMode = (isOn: boolean, isCoolingEnabled: boolean): UponorDeviceState => {
    if (!isOn) {
      return UponorDeviceState.OFF;
    }
    if (isCoolingEnabled) {
      return UponorDeviceState.COOLING;
    }
    return UponorDeviceState.HEATING;
  };

  private calculateCurrentTemperature = (thermostat: string): BigNumber => {
    const isDisplayUnitCelsius: boolean = this.displayUnit === TemperatureDisplayUnit.CELSIUS;
    const currentTemperature: BigNumber = this.uponorData!.getCurrentTemperature(thermostat);
    if (isDisplayUnitCelsius) {
      return currentTemperature;
    }
    return BigNumber(currentTemperature).times(9).div(5).plus(32);
  };

  private calculateTargetTemperature = (thermostat: string): BigNumber => {
    const isDisplayUnitCelsius: boolean = this.displayUnit === TemperatureDisplayUnit.CELSIUS;
    const targetTemperature: BigNumber = this.uponorData!.getTargetTemperature(thermostat);
    if (isDisplayUnitCelsius) {
      return targetTemperature;
    }
    return BigNumber(targetTemperature).times(9).div(5).plus(32);
  };
}