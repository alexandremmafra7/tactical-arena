import { execSync } from 'node:child_process';

try {
  const output = execSync('powershell "Get-Process | Select-Object Id, ProcessName, Path"', { encoding: 'utf8' });
  const lines = output.split('\n');
  for (const line of lines) {
    if (line.includes('Tactical Arena') || line.includes('elifoot') || line.includes('win-unpacked')) {
      const match = line.trim().match(/^(\d+)/);
      if (match) {
        console.log(`Killing process PID ${match[1]}: ${line.trim()}`);
        try { execSync(`taskkill /F /PID ${match[1]}`); } catch (e) {}
      }
    }
  }
} catch (e) {
  console.error('Error finding processes:', e.message);
}
