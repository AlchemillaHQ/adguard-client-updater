import dotenv from 'dotenv';
import { neigh } from 'ip-wrapper';
import { pingIP, arraysEqual } from './utils.js';

dotenv.config();

const staleIPs = {}; // Object to track stale IPs with TTL

const adguardConfig = {
  api: process.env.API || 'http://127.0.0.1:3000',
  username: process.env.USERNAME || 'admin',
  password: process.env.PASSWORD || 'password'
};

const API_ENDPOINTS = {
  CLIENTS: '/control/clients',
  CLIENTS_UPDATE: '/control/clients/update'
};

async function adguardFetch(endpoint, method, body) {
  try {
    const response = await fetch(`http://${adguardConfig.api}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${adguardConfig.username}:${adguardConfig.password}`).toString('base64')
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.text()
  } catch (error) {
    console.log(error);
    throw error;
  }
}


async function updateClients() {
  try {
    let [neighbors, existingClients] = await Promise.all([
      neigh.show(),
      adguardFetch(API_ENDPOINTS.CLIENTS, 'GET')
    ]);

    existingClients = JSON.parse(existingClients);

    const neighborIPsByMAC = neighbors.reduce((acc, neighbor) => {
      if (neighbor.lladdr && neighbor.dst) {
        acc[neighbor.lladdr] = (acc[neighbor.lladdr] || []);
        acc[neighbor.lladdr].push(neighbor.dst);
      }
      return acc;
    }, {});

    const clientUpdates = existingClients.clients.map(async (client) => {
      const macAddresses = client.ids.filter(id => id.includes(':') && id.length === 17);
      let ipsForClient = client.ids.filter(id => !id.includes(':') || id.length !== 17);

      macAddresses.forEach(mac => {
        if (neighborIPsByMAC[mac]) {
          ipsForClient = [...ipsForClient, ...neighborIPsByMAC[mac]];
        }
      });

      const pingResults = await Promise.all(ipsForClient.map(ip => pingIP(ip)));
      ipsForClient = ipsForClient.filter((ip, index) => {
        const isAlive = pingResults[index];
        if (isAlive) {
          if (staleIPs[ip]) {
            delete staleIPs[ip];
          }
        } else {
          staleIPs[ip] = (staleIPs[ip] || 0) + 1;
        }
        return isAlive || (staleIPs[ip] <= 100);
      });

      const updatedIds = [...new Set([...macAddresses, ...ipsForClient])];

      if (!arraysEqual(client.ids, updatedIds)) {
        client.ids = updatedIds;
        const updateObj = {
          name: client.name,
          data: client
        };

        console.log(`Updating client ${client.name} with new IDs: ${updatedIds}`);
        return adguardFetch(API_ENDPOINTS.CLIENTS_UPDATE, 'POST', updateObj);
      }
    });

    await Promise.all(clientUpdates);
  } catch (error) {
    console.error('Unable to update AdGuard clients', error.message);
  }
}


console.log('Started AdGuard client updater\n-----------------------------');
await updateClients();
setInterval(updateClients, 60000);
