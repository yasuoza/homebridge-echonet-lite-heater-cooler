import { Service, PlatformAccessory, CharacteristicValue } from "homebridge";
import { interval, Subject } from "rxjs";
import { debounceTime, skipWhile, tap } from "rxjs/operators";
import { promisify } from "util";

import { EchonetLiteHeaterCoolerPlatform } from "./platform";

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class EchonetLiteHeaterCoolerAccessory {
  private service: Service;

  private address: string;
  private eoj: number[];

  private isActive: CharacteristicValue = 0; // INACTIVE;
  private currentState = 0;
  private targetState = 0;
  private currentTemp = -127;
  private targetTemp: { [key: number]: CharacteristicValue } = {};

  private updateInProgress = false;
  private doStateUpdate: Subject<void> = new Subject();

  constructor(
    private readonly platform: EchonetLiteHeaterCoolerPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.address = accessory.context.address;
    this.eoj = accessory.context.eoj;

    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        accessory.context.maker,
      )
      .setCharacteristic(
        this.platform.Characteristic.Model,
        accessory.context.model,
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        accessory.context.uuid,
      );

    // get the HeaterCooler service if it exists, otherwise create a new HeaterCooler service
    this.service =
      this.accessory.getService(this.platform.Service.HeaterCooler) ||
      this.accessory.addService(this.platform.Service.HeaterCooler);

    // set the service name, this is what is displayed as the default name on the Home app
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      this.accessory.displayName,
    );

    // create handlers for required characteristics
    this.service
      .getCharacteristic(this.platform.Characteristic.Active)
      .onGet(this.handleActiveGet.bind(this))
      .onSet(this.handleActiveSet.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .onGet(this.handleCurrentHeaterCoolerStateGet.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .onGet(this.handleTargetHeaterCoolerStateGet.bind(this))
      .onSet(this.handleTargetHeaterCoolerStateSet.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .setProps({ minValue: -127, maxValue: 125, minStep: 1 })
      .onGet(this.handleCurrentTemperatureGet.bind(this));

    this.service
      .getCharacteristic(
        this.platform.Characteristic.CoolingThresholdTemperature,
      )
      .setProps({ minValue: 16, maxValue: 30, minStep: 1 })
      .onGet(this.handleCoolingThresholdTemperatureGet.bind(this))
      .onSet(this.handleCoolingThresholdTemperatureSet.bind(this));

    this.service
      .getCharacteristic(
        this.platform.Characteristic.HeatingThresholdTemperature,
      )
      .setProps({ minValue: 16, maxValue: 30, minStep: 1 })
      .onGet(this.handleHeatingThresholdTemperatureGet.bind(this))
      .onSet(this.handleHeatingThresholdTemperatureSet.bind(this));

    this.platform.el.on("notify", this.handleDeviceNotifyEvent.bind(this));

    this.refreshStatus();

    interval(this.platform.config.refreshInterval * 60 * 1000)
      .pipe(skipWhile(() => this.updateInProgress))
      .subscribe(async () => {
        await this.refreshStatus();
      });

    this.doStateUpdate
      .pipe(
        tap(() => {
          this.updateInProgress = true;
        }),
        debounceTime(1 * 100),
      )
      .subscribe(async () => {
        try {
          await this.applyStatusUpdate();
        } catch (err) {
          this.platform.log.error(
            `Failed to applyStatusUpdate: ${(err as Error).message}`,
          );
        }
        this.updateInProgress = false;
      });
  }

  async refreshStatus() {
    this.platform.log.debug(
      `${this.accessory.displayName}(${this.address}) - Refresing status...`,
    );

    // power
    try {
      const power = await this.getPropertyValue(this.address, this.eoj, 0x80);
      this.isActive = power.message.data.status;
    } catch (err) {
      this.platform.log.error(
        `Failed to fetch power: ${(err as Error).message}`,
      );
    }

    // target state
    try {
      const res = await this.getPropertyValue(this.address, this.eoj, 0xb0);
      const mode = res.message.data.mode;
      this.setHBModeByEchonetMode(mode);
    } catch (err) {
      this.platform.log.error(
        `Failed to fetch target state: ${(err as Error).message}`,
      );
    }

    // current temp
    try {
      const res = await this.getPropertyValue(this.address, this.eoj, 0xbb);
      this.currentTemp = res.message.data.temperature ?? -127;
    } catch (err) {
      this.platform.log.error(
        `Failed to fetch current temperature: ${(err as Error).message}`,
      );
    }

    // target temp
    try {
      const res = await this.getPropertyValue(this.address, this.eoj, 0xb3);
      const targetTemp: number | undefined = res.message.data.temperature;

      const { COOL, HEAT } =
        this.platform.Characteristic.TargetHeaterCoolerState;

      this.targetTemp[COOL] ??= targetTemp ?? 16;
      this.targetTemp[HEAT] ??= targetTemp ?? 16;
      if (targetTemp != null && this.targetTemp[this.targetState] != null) {
        this.targetTemp[this.targetState] = targetTemp;
      }
    } catch (err) {
      this.platform.log.error(
        `Failed to fetch target temperature: ${(err as Error).message}`,
      );
    }

    this.platform.log.debug(
      `${this.accessory.displayName}(${this.address})` +
        " - " +
        JSON.stringify({
          Active: this.isActive,
          CurrentTemperature: this.currentTemp,
          TargetHeaterCoolerState: this.targetState,
          CurrentHeaterCoolerState: this.currentState,
          CoolingThresholdTemperature:
            this.targetTemp[
              this.platform.Characteristic.TargetHeaterCoolerState.COOL
            ],
          HeatingThresholdTemperature:
            this.targetTemp[
              this.platform.Characteristic.TargetHeaterCoolerState.HEAT
            ],
        }),
    );

    this.service.updateCharacteristic(
      this.platform.Characteristic.Active,
      this.handleActiveGet(),
    );
    this.service.updateCharacteristic(
      this.platform.Characteristic.CurrentTemperature,
      this.handleCurrentTemperatureGet(),
    );
    this.service.updateCharacteristic(
      this.platform.Characteristic.CoolingThresholdTemperature,
      this.targetTemp[
        this.platform.Characteristic.TargetHeaterCoolerState.COOL
      ],
    );
    this.service.updateCharacteristic(
      this.platform.Characteristic.HeatingThresholdTemperature,
      this.targetTemp[
        this.platform.Characteristic.TargetHeaterCoolerState.HEAT
      ],
    );
  }

  /**
   * Handle requests to get the current value of the "Active" characteristic
   */
  handleActiveGet() {
    return this.isActive;
  }

  /**
   * Handle requests to set the "Active" characteristic
   */
  async handleActiveSet(value: CharacteristicValue) {
    this.platform.log.info(
      `${this.accessory.displayName} - SET Active: ${value}`,
    );

    this.isActive = value;

    this.doStateUpdate.next();
  }

  /**
   * Handle requests to get the current value of the "Current Heater-Cooler State" characteristic
   */
  handleCurrentHeaterCoolerStateGet() {
    return this.currentState;
  }

  /**
   * Handle requests to get the current value of the "Target Heater-Cooler State" characteristic
   */
  handleTargetHeaterCoolerStateGet() {
    return this.targetState;
  }

  /**
   * Handle requests to set the "Target Heater-Cooler State" characteristic
   */
  async handleTargetHeaterCoolerStateSet(value: CharacteristicValue) {
    this.platform.log.info(
      `${this.accessory.displayName} - SET TargetHeaterCoolerState: ${value}`,
    );

    this.targetState = value as number;
    this.currentState = this.targetState + 1;

    this.service.updateCharacteristic(
      this.platform.Characteristic.TargetHeaterCoolerState,
      this.handleTargetHeaterCoolerStateGet(),
    );
    this.service.updateCharacteristic(
      this.platform.Characteristic.CurrentHeaterCoolerState,
      this.handleCurrentHeaterCoolerStateGet(),
    );

    this.doStateUpdate.next();
  }

  /**
   * Handle requests to get the current value of the "Current Temperature" characteristic
   */
  handleCurrentTemperatureGet() {
    return this.currentTemp;
  }

  /**
   * Handle requests to get the current value of the "Cooling Threshold Temperature" characteristic
   */
  handleCoolingThresholdTemperatureGet() {
    return (
      this.targetTemp[
        this.platform.Characteristic.TargetHeaterCoolerState.COOL
      ] ?? 27
    );
  }

  /**
   * Handle requests to set the "Cooling Threshold Temperature" characteristic
   */
  async handleCoolingThresholdTemperatureSet(value: CharacteristicValue) {
    this.platform.log.info(
      `${this.accessory.displayName} - SET CoolingThresholdTemperature: ${value}`,
    );

    this.targetTemp[this.platform.Characteristic.TargetHeaterCoolerState.COOL] =
      value;

    this.doStateUpdate.next();
  }

  /**
   * Handle requests to get the current value of the "Heating Threshold Temperature" characteristic
   */
  handleHeatingThresholdTemperatureGet() {
    return (
      this.targetTemp[
        this.platform.Characteristic.TargetHeaterCoolerState.HEAT
      ] ?? 23
    );
  }

  /**
   * Handle requests to set the "Heating Threshold Temperature" characteristic
   */
  async handleHeatingThresholdTemperatureSet(value: CharacteristicValue) {
    this.platform.log.info(
      `${this.accessory.displayName} - SET HeatingThresholdTemperature: ${value}`,
    );

    this.targetTemp[this.platform.Characteristic.TargetHeaterCoolerState.HEAT] =
      value;

    this.doStateUpdate.next();
  }

  /**
   * Handle status change event
   */

  async handleDeviceNotifyEvent(event: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    message: { prop: any };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    device: any;
  }) {
    const { prop } = event.message;
    if (event.device.address !== this.address) {
      return;
    }

    for (const p of prop) {
      if (!p.edt) {
        continue;
      }

      switch (p.epc) {
        case 0x80: // status
          this.platform.log.info(
            `${this.accessory.displayName} - Received Active: ${p.edt.status}`,
          );

          this.isActive = p.edt.status
            ? this.platform.Characteristic.Active.ACTIVE
            : this.platform.Characteristic.Active.INACTIVE;

          this.service.updateCharacteristic(
            this.platform.Characteristic.Active,
            this.isActive,
          );
          break;

        case 0xb0: // mode
          this.platform.log.info(
            `${this.accessory.displayName} - Received mode: ${p.edt.mode}`,
          );
          this.setHBModeByEchonetMode(p.edt.mode);
          break;

        case 0xb3: // target temperature
          // Auto mode triggers null temperature
          if (p.edt.temperature == null) {
            break;
          }

          this.platform.log.info(
            `${this.accessory.displayName} - Received TargetTemperature: ${p.edt.temperature}`,
          );

          switch (this.targetState) {
            case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
              this.targetTemp[this.targetState] = p.edt.temperature;
              this.service.updateCharacteristic(
                this.platform.Characteristic.CoolingThresholdTemperature,
                p.edt.temperature,
              );
              break;
            case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
              this.targetTemp[this.targetState] = p.edt.temperature;
              this.service.updateCharacteristic(
                this.platform.Characteristic.HeatingThresholdTemperature,
                p.edt.temperature,
              );
              break;
          }
          break;
      }
    }
  }

  private setHBModeByEchonetMode(mode: number) {
    switch (mode) {
      case 2: // Cool
        this.targetState =
          this.platform.Characteristic.TargetHeaterCoolerState.COOL;
        this.currentState =
          this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
        break;
      case 3: // Heat
        this.targetState =
          this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
        this.currentState =
          this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
        break;
      default:
        // Auto
        this.targetState =
          this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
        this.currentState =
          this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
        break;
    }

    this.service.updateCharacteristic(
      this.platform.Characteristic.TargetHeaterCoolerState,
      this.handleTargetHeaterCoolerStateGet(),
    );
    this.service.updateCharacteristic(
      this.platform.Characteristic.CurrentHeaterCoolerState,
      this.handleCurrentHeaterCoolerStateGet(),
    );
  }

  private async applyStatusUpdate() {
    const status = this.isActive === this.platform.Characteristic.Active.ACTIVE;
    await this.setPropertyValue(this.address, this.eoj, 0x80, { status });

    if (this.isActive) {
      const mode =
        {
          [this.platform.Characteristic.TargetHeaterCoolerState.COOL]: 2,
          [this.platform.Characteristic.TargetHeaterCoolerState.HEAT]: 3,
        }[this.targetState] ?? 1;

      await this.setPropertyValue(this.address, this.eoj, 0xb0, {
        mode,
      });

      // Set temperature when targetState is HEAT or COOL
      const temperature = this.targetTemp[this.targetState];
      if (temperature != null) {
        await this.setPropertyValue(this.address, this.eoj, 0xb3, {
          temperature,
        });
      }
    }
  }

  /**
   * Promisified Echonet.getPropertyValue
   */
  private async getPropertyValue(address: string, eoj: number[], epc: number) {
    return await promisify(this.platform.el.getPropertyValue).bind(
      this.platform.el,
    )(address, eoj, epc);
  }

  /**
   * Promisified Echonet.setPropertyValue
   */
  private async setPropertyValue(
    address: string,
    eoj: number[],
    epc: number,
    value: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    maxRetry = 5,
  ) {
    const setPropertyValueFunc = async (
      address: string,
      eoj: number[],
      epc: number,
      value: any, // eslint-disable-line @typescript-eslint/no-explicit-any
      retries: number,
    ) => {
      this.platform.log.debug(
        `${this.accessory.displayName}(${
          this.address
        }) - set value: ${JSON.stringify(value)}`,
      );

      try {
        await promisify(this.platform.el.setPropertyValue).bind(
          this.platform.el,
        )(address, eoj, epc, value);
      } catch (err) {
        if (retries === 0) {
          this.platform.log.error(
            `${
              this.accessory.displayName
            } - Failed to set value: ${JSON.stringify(value)}`,
          );
          this.platform.log.debug(`${err}`);
          return;
        }
        this.platform.log.debug(
          `${
            this.accessory.displayName
          } - Failed to set value: ${JSON.stringify(value)}. Retrying...`,
        );
        this.platform.log.debug(`${err}`);

        // sleep 1 ~ maxRetry second
        const sleep = (maxRetry - retries + 1) * 1000;
        await new Promise((_) => setTimeout(_, sleep));

        await setPropertyValueFunc(address, eoj, epc, value, retries - 1);
      }
    };

    return await setPropertyValueFunc(address, eoj, epc, value, maxRetry);
  }
}
