const { spawn } = require('child_process');

async function main() {
  // Print a highly styled, premium visual layout for all service links immediately
  console.log('\n\x1b[1m\x1b[32m======================================================================');
  console.log('🚀  OPTIGISTIK RUNNING SUCCESSFULLY - ALL SERVICES OPERATIONAL!');
  console.log('======================================================================\x1b[0m\n');
  
  console.log('\x1b[36m🌐  Website (Site Vitrine): \x1b[0m\x1b[4m\x1b[1mhttp://localhost:3000\x1b[0m');
  console.log('\x1b[36m💻  Software (Logiciel):    \x1b[0m\x1b[4m\x1b[1mhttp://localhost:3001\x1b[0m');
  console.log('\x1b[36m📱  Driver App (Expo):      \x1b[0mScan the QR code below on your mobile device.\n');
  
  console.log('\x1b[90m----------------------------------------------------------------------\x1b[0m');
  console.log('\x1b[33mLaunching Expo Go Tunnel...\x1b[0m\n');

  // Spawn the Expo start command and inherit stdio so it remains interactive (shows QR code, keyboard shortcuts work)
  const expo = spawn('npx', ['expo', 'start', '--tunnel'], {
    stdio: 'inherit',
    shell: true
  });

  expo.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main();
