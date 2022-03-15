"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EchonetLiteHeaterCoolerPlatform = void 0;
const logger_1 = require("homebridge/lib/logger");
const node_echonet_lite_1 = __importDefault(require("node-echonet-lite"));
const util_1 = require("util");
const accessory_1 = require("./accessory");
const makerCode_1 = require("./makerCode");
const settings_1 = require("./settings");
class EchonetLiteHeaterCoolerPlatform {
    constructor(log, config, api) {
        var _a;
        this.log = log;
        this.api = api;
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        this.accessories = [];
        if (!this.verifyConfig(config)) {
            log.error("Invalid configuration. Please check your configuration.");
            // Dummy data to pass Strict Property Initialization
            this.config = {
                ...config,
                refreshInterval: Number.POSITIVE_INFINITY,
                requestTimeout: Number.POSITIVE_INFINITY,
            };
            this.el = new node_echonet_lite_1.default({});
            return;
        }
        this.config = config;
        logger_1.Logger.forceColor();
        logger_1.Logger.setDebugEnabled(this.config.debug);
        this.log = new logger_1.Logger(log.prefix);
        this.log.debug("Finished initializing platform:", config.name);
        const timeout = ((_a = config.requestTimeout) !== null && _a !== void 0 ? _a : 20) * 1000;
        this.el = new node_echonet_lite_1.default({ type: "lan", timeout: timeout });
        this.api.on("didFinishLaunching" /* DID_FINISH_LAUNCHING */, () => {
            this.log.debug("Executed didFinishLaunching callback");
            this.el.init((err) => {
                if (err) {
                    this.log.error("Failed to initialize echonet-lite");
                    this.log.debug(`${err}`);
                }
                else {
                    try {
                        this.discoverDevices();
                    }
                    catch (e) {
                        this.log.error("Failed to initialize echonet-lite");
                        this.log.debug(`${e}`);
                    }
                }
            });
        });
        this.api.on("shutdown" /* SHUTDOWN */, () => {
            this.el.close();
        });
    }
    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory) {
        this.log.info("Loading accessory from cache:", accessory.displayName);
        this.accessories.push(accessory);
    }
    verifyConfig(config) {
        if (config.refreshInterval < 1) {
            return false;
        }
        if (config.requestTimeout != null &&
            Number.isNaN(parseInt(config.requestTimeout))) {
            return false;
        }
        return true;
    }
    async discoverDevices() {
        var _a, _b;
        const sleep = (msec) => new Promise((resolve) => setTimeout(resolve, msec));
        const manualDevices = (_a = this.config.devices) !== null && _a !== void 0 ? _a : [];
        for (const host of manualDevices) {
            await this.addDeviceToAccessory(host);
        }
        const sleepSec = (_b = this.config.requestTimeout) !== null && _b !== void 0 ? _b : 20;
        this.log.info(`Waiting for ${sleepSec} seconds to start discovering ECHONET Lite devices...`);
        await sleep(sleepSec * 1000);
        this.el.startDiscovery(async (err, res) => {
            if (err) {
                this.log.error(`Failed to discovering ECHONET Lite(${err.name}: ${err.message})`);
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
                this.log.debug(`Device found: ${JSON.stringify({
                    group_code: "0x" + Number(group_code).toString(16),
                    class_code: "0x" + Number(class_code).toString(16),
                    address: address,
                })}`);
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
    async addDeviceToAccessory(address, eoj = [1, 48, 1]) {
        var _a;
        try {
            const maps = await (0, util_1.promisify)(this.el.getPropertyMaps).bind(this.el)(address, eoj);
            const getEPCs = maps["message"]["data"]["get"];
            const uid = (await (0, util_1.promisify)(this.el.getPropertyValue).bind(this.el)(address, eoj, 0x83)).message.data.uid;
            const uuid = uid
                ? this.api.hap.uuid.generate(uid)
                : this.api.hap.uuid.generate(address);
            const name = getEPCs.includes(0x8c)
                ? (await (0, util_1.promisify)(this.el.getPropertyValue).bind(this.el)(address, eoj, 0x8c)).message.data.code
                : address;
            const makerCode = (await (0, util_1.promisify)(this.el.getPropertyValue).bind(this.el)(address, eoj, 0x8a)).message.data.code;
            const maker = (_a = makerCode_1.MakerList[makerCode.toString(16).padStart(6, "0").toUpperCase()]) !== null && _a !== void 0 ? _a : "Manufacturer";
            this.addAccessory({ uuid, name, address, maker, eoj });
        }
        catch (err) {
            this.log.error(`Failed to addDeviceToAccessory - address: ${address}`);
            this.log.debug(`${err}`);
        }
    }
    addAccessory(opts) {
        const existingAccessory = this.accessories.find((accessory) => accessory.UUID === opts.uuid);
        if (existingAccessory) {
            this.log.info(`Restoring existing accessory from cache: ${existingAccessory.displayName}(${opts.address})`);
            new accessory_1.EchonetLiteHeaterCoolerAccessory(this, existingAccessory);
        }
        else {
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
            new accessory_1.EchonetLiteHeaterCoolerAccessory(this, accessory);
            // link the accessory to your platform
            this.api.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [
                accessory,
            ]);
        }
    }
}
exports.EchonetLiteHeaterCoolerPlatform = EchonetLiteHeaterCoolerPlatform;
//# sourceMappingURL=platform.js.map