import { PlatformAccessory, CharacteristicValue } from "homebridge";
import { EchonetLiteHeaterCoolerPlatform } from "./platform";
import { ELProp } from "./types";
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export declare class EchonetLiteHeaterCoolerAccessory {
    private readonly platform;
    private readonly accessory;
    private service;
    private address;
    private eoj;
    private isActive;
    private currentState;
    private targetState;
    private currentTemp;
    private targetTemp;
    private updateInProgress;
    private doStateUpdate;
    constructor(platform: EchonetLiteHeaterCoolerPlatform, accessory: PlatformAccessory);
    refreshStatus(): Promise<void>;
    /**
     * Handle requests to get the current value of the "Active" characteristic
     */
    handleActiveGet(): CharacteristicValue;
    /**
     * Handle requests to set the "Active" characteristic
     */
    handleActiveSet(value: CharacteristicValue): Promise<void>;
    /**
     * Handle requests to get the current value of the "Current Heater-Cooler State" characteristic
     */
    handleCurrentHeaterCoolerStateGet(): number;
    /**
     * Handle requests to get the current value of the "Target Heater-Cooler State" characteristic
     */
    handleTargetHeaterCoolerStateGet(): number;
    /**
     * Handle requests to set the "Target Heater-Cooler State" characteristic
     */
    handleTargetHeaterCoolerStateSet(value: CharacteristicValue): Promise<void>;
    /**
     * Handle requests to get the current value of the "Current Temperature" characteristic
     */
    handleCurrentTemperatureGet(): number;
    /**
     * Handle requests to get the current value of the "Cooling Threshold Temperature" characteristic
     */
    handleCoolingThresholdTemperatureGet(): number;
    /**
     * Handle requests to set the "Cooling Threshold Temperature" characteristic
     */
    handleCoolingThresholdTemperatureSet(value: CharacteristicValue): Promise<void>;
    /**
     * Handle requests to get the current value of the "Heating Threshold Temperature" characteristic
     */
    handleHeatingThresholdTemperatureGet(): number;
    /**
     * Handle requests to set the "Heating Threshold Temperature" characteristic
     */
    handleHeatingThresholdTemperatureSet(value: CharacteristicValue): Promise<void>;
    /**
     * Handle status change event
     */
    handleDeviceNotifyEvent(event: {
        message: {
            prop: ELProp[];
        };
        device: any;
    }): Promise<void>;
    private setHBModeByEchonetMode;
    private applyStatusUpdate;
    /**
     * Promisified Echonet.send
     */
    private send;
    private propToString;
}
//# sourceMappingURL=accessory.d.ts.map