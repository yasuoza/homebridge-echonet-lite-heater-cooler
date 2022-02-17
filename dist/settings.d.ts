import { PlatformConfig } from "homebridge";
/**
 * This is the name of the platform that users will use to register the plugin in the Homebridge config.json
 */
export declare const PLATFORM_NAME = "EchonetLiteHeaterCooler";
/**
 * This must match the name of your plugin as defined the package.json
 */
export declare const PLUGIN_NAME = "homebridge-echonet-lite-heater-cooler";
export interface EchonetLiteHeaterCoolerConfig extends PlatformConfig {
    devices?: {
        host: string;
    }[];
    refreshInterval: number;
    requestTimeout: number;
}
//# sourceMappingURL=settings.d.ts.map