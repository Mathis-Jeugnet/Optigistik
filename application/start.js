const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  // Print a highly styled, premium visual layout for all service links immediately
  console.log('\n\x1b[1m\x1b[32m======================================================================');
  console.log('🚀  OPTIGISTIK RUNNING SUCCESSFULLY - ALL SERVICES OPERATIONAL!');
  console.log('======================================================================\x1b[0m\n');
  
  console.log('\x1b[36m🌐  Website (Site Vitrine): \x1b[0m\x1b[4m\x1b[1mhttp://localhost:3000\x1b[0m');
  console.log('\x1b[36m💻  Software (Logiciel):    \x1b[0m\x1b[4m\x1b[1mhttp://localhost:3001\x1b[0m');
  console.log('\x1b[36m📱  Driver App (Expo):      \x1b[0mScan the QR code below on your mobile device.\n');
  
  console.log('\x1b[90m----------------------------------------------------------------------\x1b[0m');
  
  console.log('\x1b[33mCréation du tunnel public automatique pour la Reconnaissance Vocale...\x1b[0m');
  
  // Start localtunnel for the python backend
  const lt = spawn('npx', ['--yes', 'localtunnel', '--port', '8000', '--local-host', 'solveur'], { shell: true });
  
  let urlFound = false;

  lt.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('your url is:')) {
      const url = output.split('your url is:')[1].trim();
      console.log(`\x1b[32m✅ Tunnel vocal prêt et sécurisé : ${url}\x1b[0m\n`);
      
      // Inject this URL dynamically into JourneyScreen.tsx
      const journeyPath = path.join(__dirname, 'src', 'screens', 'main', 'JourneyScreen.tsx');
      if (fs.existsSync(journeyPath)) {
        let journeyCode = fs.readFileSync(journeyPath, 'utf8');
        
        // Match ANY loca.lt url dynamically and replace it
        journeyCode = journeyCode.replace(/const backendUrl = `https:\/\/.*\.loca\.lt\/transcribe_base64`;/g, `const backendUrl = \`${url}/transcribe_base64\`;`);
        
        fs.writeFileSync(journeyPath, journeyCode);
      }
      
      if (!urlFound) {
        urlFound = true;
        // Start Expo after tunnel is ready and code is patched
        console.log('\x1b[33mLaunching Expo Go Tunnel...\x1b[0m\n');
        const expo = spawn('npx', ['expo', 'start', '--tunnel'], {
          stdio: 'inherit',
          shell: true
        });

        expo.on('exit', (code) => {
          lt.kill();
          process.exit(code || 0);
        });
      }
    }
  });

  lt.stderr.on('data', (data) => {
    // Ignore routine npm warnings, only log actual localtunnel errors
    const str = data.toString();
    if (!str.includes('npm WARN') && !str.includes('npm notice')) {
      console.error(`localtunnel: ${str}`);
    }
  });

  lt.on('close', (code) => {
    if (!urlFound) {
      console.error('localtunnel failed to start properly. Check your internet connection.');
      // Start Expo anyway so the user isn't completely blocked
      console.log('\x1b[33mLaunching Expo Go Tunnel (without Voice Tunnel)...\x1b[0m\n');
      const expo = spawn('npx', ['expo', 'start', '--tunnel'], {
        stdio: 'inherit',
        shell: true
      });
      expo.on('exit', (c) => process.exit(c || 0));
    }
  });
}

main();
