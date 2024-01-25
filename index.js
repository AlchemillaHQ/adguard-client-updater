import dotenv from 'dotenv';
import { neigh } from 'ip-wrapper';
import { pingIP, arraysEqual } from './utils.js';

dotenv.config();

const staleIPs = {};

const adguardConfig = {
  api: process.env.API || 'http://127.0.0.1:3000',
  username: process.env.USERNAME || 'admin',
  password: process.env.PASSWORD || 'password'
};

const API_ENDPOINTS = {
  CLIENTS: '/control/clients',
  CLIENTS_UPDATE: '/control/clients/update'
};

async function adguardFetch (endpoint, method, body) {
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

    return await response.text();
  } catch (error) {
    console.error(`Failed to fetch from AdGuard: ${error.message}`);
    throw error;
  }
}

async function updateClients () {
  try {
    const neighbors = await neigh.show();
    const existingClients = JSON.parse(await adguardFetch(API_ENDPOINTS.CLIENTS, 'GET'));

    if (existingClients.clients) {
      const clientUpdates = existingClients.clients.map(async (client) => {
        const clientIPs = neighbors
          .filter(neighbor => client.ids.includes(neighbor.lladdr))
          .map(neighbor => neighbor.dst);

        const pingResults = await Promise.all(clientIPs.map(ip => pingIP(ip)));
        const activeIPs = new Set(); // Use a Set to ensure uniqueness
        clientIPs.forEach((ip, index) => {
          if (pingResults[index]) {
            activeIPs.add(ip);
            staleIPs[ip] = 0; // Reset stale count
          } else {
            if (!staleIPs[ip]) staleIPs[ip] = 0;
            staleIPs[ip]++;
          }
        });

        const updatedIDs = client.ids.filter(id => !staleIPs[id] || staleIPs[id] <= 4);
        const combinedIDs = Array.from(new Set([...updatedIDs, ...activeIPs]));

        if (!arraysEqual(client.ids, combinedIDs)) {
          client.ids = combinedIDs;
          const updateObj = {
            name: client.name,
            data: client
          };

          console.log(`Updating client ${client.name} with new IDs: ${combinedIDs}`);
          return adguardFetch(API_ENDPOINTS.CLIENTS_UPDATE, 'POST', updateObj);
        }
      });

      await Promise.all(clientUpdates);
    }
  } catch (error) {
    console.error('Unable to update AdGuard clients', error.message);
  }
}

console.log('Started AdGuard client updater\n-----------------------------');
await updateClients();
setInterval(updateClients, 60000);
