import BigNumber from 'bignumber.js';

export type UponorDevice = {
  id: string;
  code: string;
  name: string;
  model: string;
  version: string;
  isOn: boolean;
  isEcoEnabled: boolean;
  currentHvacMode: UponorDeviceState;
  currentTemperature: BigNumber;
  targetTemperature: BigNumber;
  minLimitTemperature: BigNumber;
  maxLimitTemperature: BigNumber;
};

export enum UponorDeviceState {
  OFF = 'OFF',
  HEATING = 'HEATING',
  COOLING = 'COOLING',
}
