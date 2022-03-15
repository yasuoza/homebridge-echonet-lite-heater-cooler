import {
  API,
  APIEvent,
  DynamicPlatformPlugin,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from "homebridge";
import { Logger } from "homebridge/lib/logger";
import EchonetLite from "node-echonet-lite";
import { promisify } from "util";

import { EchonetLiteHeaterCoolerAccessory } from "./accessory";
import { MakerList } from "./makerCode";
import {
  PLUGIN_NAME,
  PLATFORM_NAME,
  EchonetLiteHeaterCoolerConfig,
} from "./settings";

export class EchonetLiteHeaterCoolerPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic =
    this.api.hap.Characteristic;

  public readonly el: EchonetLite;

  public readonly config: EchonetLiteHeaterCoolerConfig;
  public readonly accessories: Array<PlatformAccessory> = [];

  constructor(
    public readonly log: Logger,
    config: PlatformConfig,
    public readonly api: API,
  ) {
    if (!this.verifyConfig(config)) {
      log.error("Invalid configuration. Please check your configuration.");

      // Dummy data to pass Strict Property Initialization
      this.config = {
        ...config,
        refreshInterval: Number.POSITIVE_INFINITY,
        requestTimeout: Number.POSITIVE_INFINITY,
      };
      this.el = new EchonetLite({});
      return;
    }

    this.config = config;

    Logger.forceColor();
    Logger.setDebugEnabled(this.config.debug);
    this.log = new Logger(log.prefix);

    this.log.debug("Finished initializing platform:", config.name);

    const timeout = (config.requestTimeout ?? 20) * 1000;
    this.el = new EchonetLite({ type: "lan", timeout: timeout });

    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      this.log.debug("Executed didFinishLaunching callback");

      this.el.init((err) => {
        if (err) {
          this.log.error("Failed to initialize echonet-lite");
          this.log.debug(`${err}`);
        } else {
          try {
            this.discoverDevices();
          } catch (e) {
            this.log.error("Failed to initialize echonet-lite");
            this.log.debug(`${e}`);
          }
        }
      });
    });

    this.api.on(APIEvent.SHUTDOWN, () => {
      this.el.close();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info("Loading accessory from cache:", accessory.displayName);

    this.accessories.push(accessory);
  }

  private verifyConfig(
    config: PlatformConfig | EchonetLiteHeaterCoolerConfig,
  ): config is EchonetLiteHeaterCoolerConfig {
    if (config.refreshInterval < 1) {
      return false;
    }
    if (
      config.requestTimeout != null &&
      Number.isNaN(parseInt(config.requestTimeout))
    ) {
      return false;
    }
    return true;
  }

  private async discoverDevices() {
    const sleep = (msec: number) =>
      new Promise((resolve) => setTimeout(resolve, msec));

    const manualDevices = this.config.devices ?? [];

    for (const host of manualDevices) {
      await this.addDeviceToAccessory(host);
    }

    const sleepSec = this.config.requestTimeout ?? 20;
    this.log.info(
      `Waiting for ${sleepSec} seconds to start discovering ECHONET Lite devices...`,
    );
    await sleep(sleepSec * 1000);

    this.el.startDiscovery(async (err, res) => {
      if (err) {
        this.log.error(
          `Failed to discovering ECHONET Lite(${err.name}: ${err.message})`,
        );
        this.el.stopDiscovery();
        return;
      }

      const device = res["device"];
      const address = device["address"];

      if (manualDevices.some((manualHost) => manualHost === address)) {
        return;
      }

      for (const eoj of device["eoj"]) {
        const group_code = eoj[0];
        const class_code = eoj[1];

        this.log.debug(
          `Device found: ${JSON.stringify({
            group_code: "0x" + Number(group_code).toString(16),
            class_code: "0x" + Number(class_code).toString(16),
            address: address,
          })}`,
        );

        if (group_code === 0x01 && class_code === 0x30) {
          await this.addDeviceToAccessory(address, eoj);
        }
      }
    });

    setTimeout(() => {
      this.log.info("Finished discovering ECHONET Lite devices");
      this.el.stopDiscovery();
    }, 30 * 1000);
  }

  private async addDeviceToAccessory(
    address: string,
    eoj: number[] = [1, 48, 1],
  ) {
    try {
      const maps = await promisify(this.el.getPropertyMaps).bind(this.el)(
        address,
        eoj,
      );
      const getEPCs: number[] = maps["message"]["data"]["get"];

      const uid = (
        await promisify(this.el.getPropertyValue).bind(this.el)(
          address,
          eoj,
          0x83,
        )
      ).message.data.uid;
      const uuid = uid
        ? this.api.hap.uuid.generate(uid)
        : this.api.hap.uuid.generate(address);

      const name = getEPCs.includes(0x8c)
        ? (
            await promisify(this.el.getPropertyValue).bind(this.el)(
              address,
              eoj,
              0x8c,
            )
          ).message.data.code
        : address;

      const makerCode = (
        await promisify(this.el.getPropertyValue).bind(this.el)(
          address,
          eoj,
          0x8a,
        )
      ).message.data.code;
      const maker =
        MakerList[makerCode.toString(16).padStart(6, "0").toUpperCase()] ??
        "Manufacturer";

      this.addAccessory({ uuid, name, address, maker, eoj });
    } catch (err) {
      this.log.error(`Failed to addDeviceToAccessory - address: ${address}`);
      this.log.debug(`${err}`);
    }
  }

  private addAccessory(opts: {
    uuid: string;
    name: string;
    address: string;
    maker: string;
    eoj: number[];
  }) {
    const existingAccessory = this.accessories.find(
      (accessory) => accessory.UUID === opts.uuid,
    );

    if (existingAccessory) {
      this.log.info(
        `Restoring existing accessory from cache: ${existingAccessory.displayName}(${opts.address})`,
      );
      new EchonetLiteHeaterCoolerAccessory(this, existingAccessory);
    } else {
      this.log.info(`Adding new accessory: ${opts.name}(${opts.address})`);

      // Let displayName to be unique
      const displayName = `${opts.name}-${opts.uuid.slice(0, 5)}`;
      const accessory = new this.api.platformAccessory(displayName, opts.uuid);

      // store a copy of the device object in the `accessory.context`
      // the `context` property can be used to store any data about the accessory you may need
      accessory.context.address = opts.address;
      accessory.context.eoj = opts.eoj;
      accessory.context.model = opts.name;
      accessory.context.uuid = opts.uuid;
      accessory.context.maker = opts.maker;

      // create the accessory handler for the newly create accessory
      // this is imported from `platformAccessory.ts`
      new EchonetLiteHeaterCoolerAccessory(this, accessory);

      // link the accessory to your platform
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
        accessory,
      ]);
    }
  }
}
