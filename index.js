import dotenv from 'dotenv';
import { neigh } from 'ip-wrapper';

dotenv.config();

const adguardConfig = {
  api: process.env.API || 'http://127.0.0.1:3000',
  username: process.env.USERNAME || 'admin',
  password: process.env.PASSWORD || 'password'
};

const API_ENDPOINTS = {
  CLIENTS: '/control/clients',
  CLIENTS_UPDATE: '/control/clients/update'
};

function arraysEqual (arr1, arr2) {
  return arr1.length === arr2.length && arr1.every((value, index) => value === arr2[index]);
}

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

        const uniqueIds = [...new Set([...client.ids, ...clientIPs])];

        if (!arraysEqual(client.ids, uniqueIds)) {
          client.ids = uniqueIds;
          const updateObj = {
            name: client.name,
            data: client
          };

          console.log(`Updating client ${client.name} with new IDs: ${uniqueIds}`);
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
