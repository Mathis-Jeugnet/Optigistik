const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  // Print a highly styled, premium visual layout for all service links immediately
  console.log('\n\x1b[1m\x1b[32m======================================================================');
  console.log('🚀  OPTIGISTIK RUNNING SUCCESSFULLY - INITIALIZING TUNNELS...');
  console.log('======================================================================\x1b[0m\n');
  
  console.log('\x1b[36m🌐  Website (Site Vitrine): \x1b[0m\x1b[4m\x1b[1mhttp://localhost:3000\x1b[0m');
  console.log('\x1b[36m💻  Software (Logiciel):    \x1b[0m\x1b[4m\x1b[1mhttp://localhost:3001\x1b[0m');
  console.log('\x1b[36m📱  Driver App (Expo):      \x1b[0mScan the QR code below on your mobile device.\n');
  
  console.log('\x1b[90m----------------------------------------------------------------------\x1b[0m');
  
  console.log('\x1b[33mCréation du tunnel public automatique pour la Reconnaissance Vocale (solveur:8000)...\x1b[0m');
  const ltSolver = spawn('npx', ['--yes', 'localtunnel', '--port', '8000', '--local-host', 'solveur'], { shell: true });
  
  console.log('\x1b[33mCréation du tunnel public automatique pour l\'API (logiciel:3000)...\x1b[0m');
  const ltApi = spawn('npx', ['--yes', 'localtunnel', '--port', '3000', '--local-host', 'logiciel'], { shell: true });

  let solverUrl = null;
  let apiUrl = null;
  let expoLaunched = false;

  function launchExpoIfReady() {
    // We proceed if we have resolved both URLs (either successfully or using fallback)
    if (solverUrl && apiUrl && !expoLaunched) {
      expoLaunched = true;
      
      console.log(`\n\x1b[32m✅ Tunnel vocal prêt et sécurisé : ${solverUrl}\x1b[0m`);
      console.log(`\x1b[32m✅ Tunnel API prêt et sécurisé   : ${apiUrl}\x1b[0m\n`);
      
      // Inject solver URL dynamically into JourneyScreen.tsx
      const journeyPath = path.join(__dirname, 'src', 'screens', 'main', 'JourneyScreen.tsx');
      if (fs.existsSync(journeyPath)) {
        let journeyCode = fs.readFileSync(journeyPath, 'utf8');
        journeyCode = journeyCode.replace(/const backendUrl = `https?:\/\/[^`]+\/transcribe_base64`;/g, `const backendUrl = \`${solverUrl}/transcribe_base64\`;`);
        fs.writeFileSync(journeyPath, journeyCode);
        console.log('✏️  URL du solveur vocal injectée dans JourneyScreen.tsx');
      }
      
      // Inject API URL dynamically into api.ts
      const apiPath = path.join(__dirname, 'src', 'utils', 'api.ts');
      if (fs.existsSync(apiPath)) {
        let apiCode = fs.readFileSync(apiPath, 'utf8');
        apiCode = apiCode.replace(/const injectedUrl = "[^"]*";/g, `const injectedUrl = "${apiUrl}";`);
        fs.writeFileSync(apiPath, apiCode);
        console.log('✏️  URL de l\'API Logiciel injectée dans api.ts');
      }

      console.log('\n\x1b[33mLaunching Expo Go Tunnel (with Cache Clear)...\x1b[0m\n');
      const expo = spawn('npx', ['expo', 'start', '--tunnel', '--clear'], {
        stdio: 'inherit',
        shell: true
      });

      expo.on('exit', (code) => {
        ltSolver.kill();
        ltApi.kill();
        process.exit(code || 0);
      });
    }
  }

  // Handle solver tunnel output
  ltSolver.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('your url is:')) {
      solverUrl = output.split('your url is:')[1].trim();
      launchExpoIfReady();
    }
  });

  // Handle API tunnel output
  ltApi.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('your url is:')) {
      apiUrl = output.split('your url is:')[1].trim();
      launchExpoIfReady();
    }
  });

  // Handle errors / exits
  const handleError = (serviceName, err) => {
    console.error(`[${serviceName} Error]`, err.toString());
  };

  ltSolver.stderr.on('data', (data) => {
    const str = data.toString();
    if (!str.includes('npm WARN') && !str.includes('npm notice')) {
      handleError('Solver Tunnel', str);
    }
  });

  ltApi.stderr.on('data', (data) => {
    const str = data.toString();
    if (!str.includes('npm WARN') && !str.includes('npm notice')) {
      handleError('API Tunnel', str);
    }
  });

  ltSolver.on('close', (code) => {
    if (!solverUrl && !expoLaunched) {
      console.log('⚠️ Solver tunnel failed to start. Falling back to localhost.');
      solverUrl = 'http://localhost:8000';
      launchExpoIfReady();
    }
  });

  ltApi.on('close', (code) => {
    if (!apiUrl && !expoLaunched) {
      console.log('⚠️ API tunnel failed to start. Falling back to default.');
      apiUrl = 'http://localhost:3001';
      launchExpoIfReady();
    }
  });
}

main();
