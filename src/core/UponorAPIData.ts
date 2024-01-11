import BigNumber from 'bignumber.js';

type UponorJNAPVar = { waspVarName: string; waspVarValue: string };

export type UponorJNAPGetResponse = {
  result: string;
  output: {
    vars: UponorJNAPVar[];
  };
};

export type UponorJNAPSetPayload = {
  vars: UponorJNAPVar[];
};

export type UponorJNAPSetResponse = {
  result: string;
};

export class UponorAPIData {
  static empty = (): UponorAPIData => new UponorAPIData({});
  static fromUponor = (data: UponorJNAPGetResponse): UponorAPIData => {
    return new UponorAPIData(
      data.output.vars.reduce(
        (acc: Record<string, string>, item: UponorJNAPVar): Record<string, string> => {
          return { ...acc, [item.waspVarName]: item.waspVarValue };
        },
        {},
      ),
    );
  };

  private readonly controllers: string[] = ['1', '2', '3', '4', '5'];
  private readonly thermostats: string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'];

  private constructor(
    private readonly data: Record<string, string>,
  ) {}

  getDeviceCodes = async (): Promise<string[]> => {
    const codes: string[] = [];

    for (const controller of this.controllers) {
      if (this.data['sys_controller_' + controller + '_presence'] !== '1') {
        continue;
      }

      for (const thermostat of this.thermostats) {
        if (this.data['C' + controller + '_thermostat_' + thermostat + '_presence'] === '1') {
          codes.push('C' + controller + '_T' + thermostat);
        }
      }
    }

    return codes;
  };

  isActive = (thermostat: string): boolean => {
    return this.data[thermostat + '_stat_cb_actuator'] === '1';
  };

  isCoolingEnabled = (): boolean => {
    return this.data['sys_heat_cool_mode'] === '1';
  };

  setCoolingMode = (newCoolingMode: boolean): boolean => {
    this.data['sys_heat_cool_mode'] = newCoolingMode ? '1' : '0';
    return newCoolingMode;
  };

  isOn = (thermostat: string): boolean => {
    return !((this.isCoolingEnabled() && this.getCurrentTemperature(thermostat).gte(this.getMaxLimit(thermostat)))
      || (!this.isCoolingEnabled() && this.getCurrentTemperature(thermostat).lte(this.getMinLimit(thermostat))));
  };

  getId = (thermostat: string): string => {
    return this.data[thermostat.replace('T', 'thermostat') + '_id'];
  };

  getName = (thermostat: string): string => {
    return this.data['cust_' + thermostat + '_name'];
  };

  getModel = (): string => {
    return this.data['cust_SW_version_update'];
  };

  getVersion = (thermostat: string): string => {
    return this.data[thermostat + '_sw_version'];
  };

  getCurrentTemperature = (thermostat: string): BigNumber => {
    return BigNumber(this.data[thermostat + '_room_temperature'])
      .minus(320)
      .div(18);
  };

  getTargetTemperature = (thermostat: string): BigNumber => {
    const temperature: BigNumber = BigNumber(this.data[thermostat + '_setpoint'])
      .minus(320)
      .div(1.8)
      .dp(0, BigNumber.ROUND_FLOOR)
      .div(10);
    const setback: BigNumber = this.getActiveSetbackTemperature(thermostat, temperature);
    return BigNumber(this.data[thermostat + '_setpoint'])
      .minus(setback)
      .minus(320)
      .div(1.8)
      .dp(0, BigNumber.ROUND_FLOOR)
      .div(10);
  };

  setTargetTemperature = (thermostat: string, temperature: BigNumber): BigNumber => {
    const setback: BigNumber = this.getActiveSetbackTemperature(thermostat, temperature);
    const targetTemperature: BigNumber = temperature
      .times(18)
      .plus(setback)
      .plus(320);
    this.data[thermostat + '_setpoint'] = targetTemperature.toFixed();
    return targetTemperature;
  };

  getMinLimit = (thermostat: string): BigNumber => {
    return BigNumber(this.data[thermostat + '_minimum_setpoint'])
      .minus(320)
      .div(18);
  };

  getMaxLimit = (thermostat: string): BigNumber => {
    return BigNumber(this.data[thermostat + '_maximum_setpoint'])
      .minus(320)
      .div(18);
  };

  getActiveSetbackTemperature = (thermostat: string, targetTemperature: BigNumber): BigNumber => {
    if (targetTemperature === this.getMinLimit(thermostat) || targetTemperature === this.getMaxLimit(thermostat)) {
      return BigNumber(0);
    }

    const cool_setback: BigNumber = this.isCoolingEnabled()
      ? BigNumber(this.data['sys_heat_cool_offset']).negated()
      : BigNumber(0);

    let eco_setback: BigNumber = BigNumber(0);
    if (this.isEcoEnabled(thermostat) || this.isAwayEnabled()) {
      eco_setback = BigNumber(this.data[thermostat + '_eco_offset']);
      if (this.isCoolingEnabled()) {
        eco_setback = eco_setback.negated();
      }
    }

    return cool_setback.plus(eco_setback);
  };

  toSetTargetTemperaturePayload = (thermostat: string): UponorJNAPSetPayload => {
    return {
      vars: [
        {
          waspVarName: thermostat + '_setpoint',
          waspVarValue: this.data[thermostat + '_setpoint'],
        },
      ],
    };
  };

  toSetCoolingModePayload = (): UponorJNAPSetPayload => {
    return {
      vars: [
        {
          waspVarName: 'sys_heat_cool_mode',
          waspVarValue: this.data['sys_heat_cool_mode'],
        },
      ],
    };
  };

  toSetAwayModePayload = (): UponorJNAPSetPayload => {
    return {
      vars: [
        {
          waspVarName: 'sys_forced_eco_mode',
          waspVarValue: this.data['sys_forced_eco_mode'],
        },
      ],
    };
  };

  isAwayEnabled = (): boolean => {
    return this.data['sys_forced_eco_mode'] === '1';
  };

  setAwayMode = (newAwayMode: boolean): boolean => {
    this.data['sys_forced_eco_mode'] = newAwayMode ? '1' : '0';
    return newAwayMode;
  };

  isEcoEnabled = (thermostat: string): boolean => {
    if (this.data[thermostat + '_eco_offset'] === '0') {
      return false;
    }
    return (this.data[thermostat + '_stat_cb_comfort_eco_mode'] === '1')
      || (this.data['cust_Temporary_ECO_Activation'] === '1');
  };
}