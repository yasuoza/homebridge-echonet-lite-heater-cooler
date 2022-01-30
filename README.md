<p align="center">
<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">
</p>

<span align="center">

# homebridge-echonet-lite-heater-cooler

[![GitHub Release](https://flat.badgen.net/github/release/yasuoza/homebridge-echonet-lite-heater-cooler/master?icon=github)](https://github.com/yasuoza/homebridge-echonet-lite-heater-cooler/releases)

Homebridge plugin for ECHONET lite air conditioner.

</span>

## Features

- ECHONET lite support.
- Periodical status updates.

## Install

```
npm install -g yasuoza/homebridge-echonet-lite-heater-cooler
```

## Configuration

### Configure with UI

Configure with [Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x#readme) is recommended.

### Configure with config.json

```json
{
  "platforms": [
    {
      "name": "HeaterCooler",
      "refreshInterval": 15,
      "platform": "EchonetLiteHeaterCooler"
    }
  ]
}
```
