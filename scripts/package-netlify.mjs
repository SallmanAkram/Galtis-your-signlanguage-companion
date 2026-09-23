import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');
const deployDir = path.resolve(rootDir, 'netlify-deploy');
const zipFile = path.resolve(rootDir, 'netlify-deploy.zip');

console.log('🚀 [1/5] Building production assets with Vite...');
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

console.log('\n📁 [2/5] Preparing netlify-deploy folder...');
if (fs.existsSync(deployDir)) {
  fs.rmSync(deployDir, { recursive: true, force: true });
}
fs.mkdirSync(deployDir, { recursive: true });

// Copy dist into netlify-deploy
console.log('📦 Copying build distribution (assets, models, skins, animations)...');
fs.cpSync(distDir, deployDir, { recursive: true });

// Copy Netlify configs (_redirects and _headers are the standard files read by Netlify Drop)
console.log('⚙️  Configuring Netlify routing (_redirects) and headers (_headers)...');
fs.writeFileSync(path.resolve(deployDir, '_redirects'), '/*  /index.html  200\n', 'utf8');
if (fs.existsSync(path.resolve(rootDir, 'public', '_headers'))) {
  fs.copyFileSync(path.resolve(rootDir, 'public', '_headers'), path.resolve(deployDir, '_headers'));
}

// Generate deploy instructions README
console.log('📝 [3/5] Writing README_DEPLOY.md...');
const readmeContent = `# SignBridge (Galtis 3D ASL Companion) - Netlify Deployment Guide

This directory contains the production-ready distribution files for **SignBridge (Galtis-Web)**, pre-configured for hosting on Netlify.

---

## ⚡ Method 1: Netlify Drop (Instant Drag & Drop, No Terminal)

1. Open your web browser and go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Log in or create a free Netlify account if prompted.
3. Drag and drop the **\`netlify-deploy\`** folder (or the **\`netlify-deploy.zip\`** archive) into the upload area on Netlify Drop.
4. Netlify will publish your site in seconds and provide you with a live URL (e.g., \`https://random-name.netlify.app\`).
5. (Optional) Go to **Site configuration > Change site name** to choose a custom name (e.g., \`https://galtis-asl.netlify.app\`).

---

## 💻 Method 2: Netlify CLI (Command Line)

If you have Node.js and the Netlify CLI installed:
\`\`\`bash
# 1. Install Netlify CLI globally (if not already installed)
npm install -g netlify-cli

# 2. Deploy directly from the project root:
netlify deploy --prod --dir=netlify-deploy
\`\`\`

---

## 🌐 Method 3: Git Repository Deployment (Continuous Deployment)

1. Push your repository to GitHub, GitLab, or Bitbucket.
2. In Netlify, click **Add new site > Import an existing project**.
3. Select your repository.
4. The included \`netlify.toml\` will automatically configure:
   - **Build command**: \`npm run build\`
   - **Publish directory**: \`dist\`
   - **Functions directory**: \`netlify/functions\`
5. Every time you push changes to your Git repository, Netlify will automatically build and publish updates!

---

## 🎯 Features Checklist on Netlify

- **3D Avatar & Character Rigging**: Built with Three.js. Loads 3D FBX models and skins directly.
- **StudioGalt MoCap ASL Dictionary**: 2,400+ sign words with authentic motion-capture JSON animations.
- **Microphone Voice-to-Sign Recognition**:
  - Works natively out-of-the-box in Google Chrome, Microsoft Edge, Safari (macOS & iOS), and Android Chrome via the browser Web Speech API.
  - Netlify provides free HTTPS out-of-the-box, enabling seamless microphone permissions.
- **MediaPipe AI Camera Landmark Detection**: Runs client-side in the browser using WebAssembly. Camera access is supported over Netlify's HTTPS.
- **Quick Prompts & ASL Keyboard**: Instant demonstration buttons and interactive keyboard.

---

## 🔑 Optional: Gemini AI Audio Transcription (Firefox Fallback)

In Google Chrome, Microsoft Edge, and Safari, speech recognition runs 100% inside the browser with no API key needed.

If you or your users use **Mozilla Firefox** (which lacks the native browser SpeechRecognition API):
1. In Netlify, open your site dashboard.
2. Navigate to **Site configuration > Environment variables**.
3. Click **Add a variable**:
   - Key: \`GEMINI_API_KEY\`
   - Value: \`Your-Google-Gemini-API-Key\`
4. Trigger a redeploy. Netlify's serverless function (\`netlify/functions/transcribe.mts\`) will now transcribe voice recordings using Google Gemini 2.5 Flash!
`;

fs.writeFileSync(path.resolve(deployDir, 'README_DEPLOY.md'), readmeContent, 'utf8');

console.log('\n🗜️  [4/5] Creating netlify-deploy.zip archive...');
if (fs.existsSync(zipFile)) {
  fs.rmSync(zipFile, { force: true });
}

// Use bsdtar (built into Windows 10/11) for fast zip creation
execSync(`tar -a -cf "${zipFile}" -C "${deployDir}" .`, { stdio: 'inherit' });

console.log('\n📊 [5/5] Packaging Summary:');
const zipStat = fs.statSync(zipFile);
const zipSizeMB = (zipStat.size / (1024 * 1024)).toFixed(2);

function countFiles(dir) {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name));
    } else {
      count++;
    }
  }
  return count;
}

const totalFiles = countFiles(deployDir);
console.log(`✅ netlify-deploy folder: ${totalFiles} files`);
console.log(`✅ netlify-deploy.zip:    ${zipSizeMB} MB`);
console.log(`\n🎉 Ready to deploy! You can drag either the 'netlify-deploy' folder or 'netlify-deploy.zip' to https://app.netlify.com/drop\n`);
