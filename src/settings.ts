import { PlatformConfig } from "homebridge";

/**
 * This is the name of the platform that users will use to register the plugin in the Homebridge config.json
 */
export const PLATFORM_NAME = "EchonetLiteHeaterCooler";

/**
 * This must match the name of your plugin as defined the package.json
 */
export const PLUGIN_NAME = "homebridge-echonet-lite-heater-cooler";

//Config
export interface EchonetLiteHeaterCoolerConfig extends PlatformConfig {
  devices?: [string];
  refreshInterval: number;
  requestTimeout: number;
}
