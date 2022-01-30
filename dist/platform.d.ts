import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from "homebridge";
import EchonetLite from "node-echonet-lite";
import { EchonetLiteHeaterCoolerConfig } from "./settings";
export declare class EchonetLiteHeaterCoolerPlatform implements DynamicPlatformPlugin {
    readonly log: Logger;
    readonly api: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    readonly el: EchonetLite;
    readonly config: EchonetLiteHeaterCoolerConfig;
    readonly accessories: Array<PlatformAccessory>;
    constructor(log: Logger, config: PlatformConfig, api: API);
    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory: PlatformAccessory): void;
    private verifyConfig;
    private discoverDevices;
    private addAccessory;
}
//# sourceMappingURL=platform.d.ts.map