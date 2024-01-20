# AdGuard Client Updater

# Why?

AdGuard offers a useful feature that allows you to set different rules for different clients. However, if you're not using AdGuard's built-in DHCP server, you can only use IPv4 or IPv6 addresses as client identifiers. This script addresses this limitation by obtaining IP addresses from an external source and adding them to the list of IDs for a client in AdGuard Home

Integrating this into adguard is the best way to go about this but for some reason they don't want to do it. So I made this script to do it for me, feel free to use it if you want. 

# How to use

## Requirements

* NodeJS (18+)
* AdGuard Home (Tested on 0.107.42)
* A Linux Machine (I run this script on an OpenWRT router)

## Installation

1. Clone this repo

```
git clone https://github.com/AlchemillaHQ/adguard-client-updater.git
```

2. Install dependencies

```
npm install
```

3. Copy the example config file and edit it

```
cp .sample.env .env
```

4. Run the script

```
npm start
```

## License

AGPL-3.0-or-later