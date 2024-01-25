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

    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch from AdGuard: ${error.message}`);
    throw error;
  }
}

async function updateClients() {
  try {
    const neighbors = await neigh.show();
    const existingClients = JSON.parse(await adguardFetch(API_ENDPOINTS.CLIENTS, 'GET'));

    if (existingClients.clients) {
      const clientUpdates = existingClients.clients.map(async (client) => {
        const clientIPs = new Set(neighbors
            .filter(neighbor => client.ids.includes(neighbor.lladdr))
            .map(neighbor => neighbor.dst));
        
        Object.keys(staleIPs).forEach(ip => clientIPs.add(ip));

        const pingResults = await Promise.all(Array.from(clientIPs).map(ip => pingIP(ip)));
        const updatedIPs = new Set(); // Use a Set to ensure uniqueness

        Array.from(clientIPs).forEach((ip, index) => {
          if (pingResults[index]) {
            updatedIPs.add(ip);
            staleIPs[ip] = 0; // Reset stale count
          } else {
            if (!staleIPs[ip]) staleIPs[ip] = 0;
            staleIPs[ip]++;
          }
        });

        const finalIPs = Array.from(updatedIPs).filter(ip => !staleIPs[ip] || staleIPs[ip] <= 4);

        if (!arraysEqual(client.ids, finalIPs)) {
          client.ids = finalIPs;
          const updateObj = {
            name: client.name,
            data: client
          };

          console.log(`Updating client ${client.name} with new IPs: ${finalIPs}`);
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
