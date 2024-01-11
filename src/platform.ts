import {
  API,
  Categories,
  Characteristic,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME, TemperatureDisplayUnit } from './settings';
import {
  UponorThermostatAccessory,
} from './accessories/UponorThermostatAccessory';
import { UponorProxy } from './core/UponorProxy';
import { UponorDevice } from './devices/UponorDevice';
import { UponorCoolingMode } from './devices/UponorCoolingMode';
import {
  UponorCoolingSwitchAccessory,
} from './accessories/UponorCoolingSwitchAccessory';
import { UponorAwayMode } from './devices/UponorAwayMode';
import {
  UponorAwaySwitchAccessory,
} from './accessories/UponorAwaySwitchAccessory';

export class UponorPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public readonly uponorProxy: UponorProxy;

  public readonly cachedAccessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:');
    this.log.debug('  - IP or Host:', this.config.host);
    this.log.debug('  - Display Unit:', this.config.displayUnit);

    this.uponorProxy = new UponorProxy(
      this.log,
      this.config.host,
      TemperatureDisplayUnit[this.config.displayUnit],
    );

    this.api.on('didFinishLaunching', async (): Promise<void> => {
      log.debug('Executed didFinishLaunching callback');
      await this.discoverDevices();
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.cachedAccessories.push(accessory);
  }

  async discoverDevices(): Promise<void> {
    const devices: UponorDevice[] = await this.uponorProxy.getDevices();
    this.log.info('Discovered devices:', devices.length);

    const thermostatAccessories: PlatformAccessory[] = [];

    for (const device of devices) {
      const uuid: string = this.api.hap.uuid.generate(device.id);
      const existingAccessory: PlatformAccessory | undefined = this.cachedAccessories.find(
        (accessory: PlatformAccessory): boolean => accessory.UUID === uuid,
      );

      if (existingAccessory) {
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

        existingAccessory.context = device;
        this.api.updatePlatformAccessories([existingAccessory]);

        thermostatAccessories.push(existingAccessory);
        new UponorThermostatAccessory(this, existingAccessory as PlatformAccessory<UponorDevice>);
      } else {
        this.log.info('Adding new accessory:', device.name);

        const accessory: PlatformAccessory<UponorDevice> = new this.api.platformAccessory(
          device.name,
          uuid,
          Categories.THERMOSTAT,
        );

        accessory.context = device;

        thermostatAccessories.push(accessory);
        new UponorThermostatAccessory(this, accessory);

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }

    const coolingMode: UponorCoolingMode = await this.uponorProxy.getCoolingMode();
    const coolingUuid: string = this.api.hap.uuid.generate('cooling-mode-switch');
    const existingCoolingAccessory: PlatformAccessory | undefined = this.cachedAccessories.find(
      (accessory: PlatformAccessory): boolean => accessory.UUID === coolingUuid,
    );
    if (existingCoolingAccessory) {
      this.log.info('Restoring existing accessory from cache:', existingCoolingAccessory.displayName);

      existingCoolingAccessory.context = coolingMode;
      this.api.updatePlatformAccessories([existingCoolingAccessory]);

      new UponorCoolingSwitchAccessory(
        this,
        existingCoolingAccessory as PlatformAccessory<UponorCoolingMode>,
        thermostatAccessories as PlatformAccessory<UponorDevice>[],
      );
    } else {
      this.log.info('Adding new accessory:', 'Modo frío');

      const accessory: PlatformAccessory<UponorCoolingMode> = new this.api.platformAccessory(
        'Modo frío',
        coolingUuid,
        Categories.SWITCH,
      );

      accessory.context = coolingMode;

      new UponorCoolingSwitchAccessory(
        this,
        accessory,
        thermostatAccessories as PlatformAccessory<UponorDevice>[],
      );

      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }

    const awayMode: UponorAwayMode = await this.uponorProxy.getAwayMode();
    const awayUuid: string = this.api.hap.uuid.generate('away-mode-switch');
    const existingAwayAccessory: PlatformAccessory | undefined = this.cachedAccessories.find(
      (accessory: PlatformAccessory): boolean => accessory.UUID === awayUuid,
    );
    if (existingAwayAccessory) {
      this.log.info('Restoring existing accessory from cache:', existingAwayAccessory.displayName);

      existingAwayAccessory.context = awayMode;
      this.api.updatePlatformAccessories([existingAwayAccessory]);

      new UponorAwaySwitchAccessory(
        this,
        existingAwayAccessory as PlatformAccessory<UponorAwayMode>,
        thermostatAccessories as PlatformAccessory<UponorDevice>[],
      );
    } else {
      this.log.info('Adding new accessory:', 'Modo vacaciones');

      const accessory: PlatformAccessory<UponorAwayMode> = new this.api.platformAccessory(
        'Modo vacaciones',
        awayUuid,
        Categories.SWITCH,
      );

      accessory.context = awayMode;

      new UponorAwaySwitchAccessory(
        this,
        accessory,
        thermostatAccessories as PlatformAccessory<UponorDevice>[],
      );

      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
  }
}
