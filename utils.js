import { exec } from 'child_process';

export function arraysEqual (arr1, arr2) {
  return arr1.length === arr2.length && arr1.every((value, index) => value === arr2[index]);
}

export function pingIP (ip) {
  return new Promise((resolve, reject) => {
    const command = ip.includes(':') ? `ping6 -c 1 ${ip}` : `ping -c 1 ${ip}`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        resolve(false);
        return;
      }
      resolve(stdout.includes('1 packets received') || stdout.includes('1 received'));
    });
  });
}
