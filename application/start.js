const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function createPublicTunnel(port, localHost, serviceName) {
  return new Promise((resolve) => {
    let resolved = false;

    function attempt() {
      if (resolved) return;
      console.log(`\x1b[33mCréation du tunnel public pour ${serviceName} (${localHost}:${port})...\x1b[0m`);

      const proc = spawn('npx', ['localtunnel', '--port', port.toString(), '--local-host', localHost], { shell: true });

      proc.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('your url is:')) {
          const url = output.split('your url is:')[1].trim();
          if (url && !resolved) {
            resolved = true;
            resolve(url);
          }
        }
      });

      proc.stderr.on('data', (data) => {
        const str = data.toString();
        if (str.includes('connection refused') || str.includes('Error:')) {
          console.log(`\x1b[33m[${serviceName}] Reconnexion au serveur localtunnel.me...\x1b[0m`);
        }
      });

      proc.on('close', () => {
        if (!resolved) {
          setTimeout(attempt, 2000);
        }
      });

      proc.on('error', () => {
        if (!resolved) {
          setTimeout(attempt, 2000);
        }
      });
    }

    attempt();
  });
}

async function main() {
  console.log('\n\x1b[1m\x1b[32m======================================================================');
  console.log('🚀  OPTIGISTIK RUNNING SUCCESSFULLY - INITIALIZING TUNNELS...');
  console.log('======================================================================\x1b[0m\n');
  
  console.log('\x1b[36m🌐  Website (Site Vitrine): \x1b[0m\x1b[4m\x1b[1mhttp://localhost:3000\x1b[0m');
  console.log('\x1b[36m💻  Software (Logiciel):    \x1b[0m\x1b[4m\x1b[1mhttp://localhost:3001\x1b[0m');
  console.log('\x1b[36m📱  Driver App (Expo):      \x1b[0mScan the QR code below on your mobile device.\n');
  
  console.log('\x1b[90m----------------------------------------------------------------------\x1b[0m');

  // Connexion automatique avec retry jusqu'à obtention des 3 vrais tunnels publics HTTPS
  const [solverUrl, apiUrl, expoTunnelUrl] = await Promise.all([
    createPublicTunnel(8000, 'solveur', 'Solveur Vocal'),
    createPublicTunnel(3000, 'logiciel', 'API Logiciel'),
    createPublicTunnel(8081, 'localhost', 'Metro Expo')
  ]);

  console.log(`\n\x1b[32m✅ Tunnel public Solveur prêt : ${solverUrl}\x1b[0m`);
  console.log(`\x1b[32m✅ Tunnel public API prêt     : ${apiUrl}\x1b[0m`);
  console.log(`\x1b[32m✅ Tunnel public Expo prêt    : ${expoTunnelUrl}\x1b[0m\n`);

  // Configurer le proxy URL Expo sans ajouter le port 8081
  const expoHostname = expoTunnelUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const proxyUrl = `https://${expoHostname}`;
  
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME = expoHostname;
  process.env.EXPO_PACKAGER_PROXY_URL = proxyUrl;

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

  console.log('\n\x1b[33mLancement du Metro Bundler Expo avec Proxy HTTPS public...\x1b[0m\n');
  const expo = spawn('npx', ['expo', 'start', '--clear'], {
    stdio: 'inherit',
    shell: true,
    env: { 
      ...process.env, 
      REACT_NATIVE_PACKAGER_HOSTNAME: expoHostname,
      EXPO_PACKAGER_PROXY_URL: proxyUrl
    }
  });

  expo.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main();
