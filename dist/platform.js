"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EchonetLiteHeaterCoolerPlatform = void 0;
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
        this.log.debug("Finished initializing platform:", config.name);
        if (!this.verifyConfig(config)) {
            this.log.error("Invalid configuration. Please check your configuration.");
            // Dummy data to pass Strict Property Initialization
            this.config = {
                ...config,
                ip: "0.0.0.0",
                refreshInterval: Number.POSITIVE_INFINITY,
                requestTimeout: Number.POSITIVE_INFINITY,
            };
            this.el = new node_echonet_lite_1.default({});
            return;
        }
        this.config = config;
        const timeout = ((_a = config.requestTimeout) !== null && _a !== void 0 ? _a : 60) * 1000;
        this.el = new node_echonet_lite_1.default({ type: "lan", timeout: timeout });
        this.api.on("didFinishLaunching" /* DID_FINISH_LAUNCHING */, () => {
            this.log.debug("Executed didFinishLaunching callback");
            this.el.init((err) => {
                if (err) {
                    log.error(`${err.name}: ${err.message}`);
                }
                else {
                    this.discoverDevices();
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
        this.el.startDiscovery(async (err, res) => {
            var _a, _b;
            if (err) {
                this.log.error(`${err.name}: ${err.message}`);
                this.el.stopDiscovery();
                return;
            }
            const device = res["device"];
            const address = device["address"];
            for (const eoj of device["eoj"]) {
                try {
                    const group_code = eoj[0];
                    const class_code = eoj[1];
                    this.log.debug(`Device found: ${JSON.stringify({
                        group_code: "0x" + Number(group_code).toString(16),
                        class_code: "0x" + Number(class_code).toString(16),
                        address: address,
                    })}`);
                    if (group_code === 0x01 && class_code === 0x30) {
                        const serial = (await (0, util_1.promisify)(this.el.getPropertyValue).bind(this.el)(address, eoj, 0x8d)).message.data.number;
                        const uuid = serial
                            ? this.api.hap.uuid.generate(serial)
                            : this.api.hap.uuid.generate(address);
                        const name = (_a = (await (0, util_1.promisify)(this.el.getPropertyValue).bind(this.el)(address, eoj, 0x8c)).message.data.code) !== null && _a !== void 0 ? _a : address;
                        const makerCode = (await (0, util_1.promisify)(this.el.getPropertyValue).bind(this.el)(address, eoj, 0x8a)).message.data.code;
                        const maker = (_b = makerCode_1.MakerList[makerCode.toString(16).padStart(6, "0").toUpperCase()]) !== null && _b !== void 0 ? _b : "Manufacturer";
                        this.addAccessory({ serial, uuid, name, address, maker, eoj });
                    }
                }
                catch (err) {
                    this.log.error(err);
                }
            }
        });
        setTimeout(() => {
            this.el.stopDiscovery();
        }, 60 * 1000);
    }
    addAccessory(opts) {
        const existingAccessory = this.accessories.find((accessory) => accessory.UUID === opts.uuid);
        if (existingAccessory) {
            this.log.info(`Restoring existing accessory from cache: ${existingAccessory.displayName}(${opts.address})`);
            new accessory_1.EchonetLiteHeaterCoolerAccessory(this, existingAccessory);
        }
        else {
            this.log.info(`Adding new accessory: ${opts.name}(${opts.address})`);
            const accessory = new this.api.platformAccessory(opts.name, opts.uuid);
            // store a copy of the device object in the `accessory.context`
            // the `context` property can be used to store any data about the accessory you may need
            accessory.context.address = opts.address;
            accessory.context.eoj = opts.eoj;
            accessory.context.model = opts.name;
            accessory.context.uuid = opts.uuid;
            accessory.context.serial = opts.serial;
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