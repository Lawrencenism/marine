let model;
let flashEnabled = false;
let stream;
let captured = false;

// Check if TensorFlow is loaded
if (typeof tf === 'undefined') {
  console.error('❌ TensorFlow.js library not loaded! Check CDN link in HTML.');
  alert('TensorFlow.js library failed to load. Please reload the page.');
}

// Check if Teachable Machine library is loaded
if (typeof tmImage === 'undefined') {
  console.error('❌ Teachable Machine library not loaded! Check CDN link in HTML.');
}

const labels = [
  "Clams","Corals","Crabs","Dolphin","Eel",
  "Jelly Fish","Lobster","Puffers","Sea Rays","Sea Urchins"
];
const infoData = {
  "Clams": {common:"Clam", sci:"Bivalvia", habitat:"Sand/Seafloor", details:"Filter feeder"},
  "Corals": {common:"Coral", sci:"Anthozoa", habitat:"Reefs", details:"Polyps build reefs"},
  "Crabs": {common:"Crab", sci:"Brachyura", habitat:"Coast", details:"Crustacean"},
  "Dolphin": {common:"Dolphin", sci:"Delphinidae", habitat:"Oceans", details:"Intelligent mammal"},
  "Eel": {common:"Eel", sci:"Anguilliformes", habitat:"Oceans/Rivers", details:"Slender fish"},
  "Jelly Fish": {common:"Jellyfish", sci:"Scyphozoa", habitat:"Oceans", details:"Stinging tentacles"},
  "Lobster": {common:"Lobster", sci:"Nephropidae", habitat:"Sea bottom", details:"Crustacean"},
  "Puffers": {common:"Pufferfish", sci:"Tetraodontidae", habitat:"Oceans", details:"Inflates when threatened"},
  "Sea Rays": {common:"Ray", sci:"Batoidea", habitat:"Oceans", details:"Flat-bodied fish"},
  "Sea Urchins": {common:"Sea Urchin", sci:"Echinoidea", habitat:"Rocky seabed", details:"Spiny exterior"}
};

async function init() {
  // Wait a moment for CDN scripts to fully load
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('=== Model Loading Debug ===');
  console.log('tmImage available?', typeof tmImage);
  console.log('tf available?', typeof tf);
  
  // Load model using Teachable Machine loader
  const pathsToTry = [
    { model: './model/model.json', metadata: './model/metadata.json', label: 'relative (.)' },
    { model: 'model/model.json', metadata: 'model/metadata.json', label: 'no-dot' }
  ];
  
  let loaded = false;
  
  if (typeof tmImage === 'undefined') {
    console.error('❌ FATAL: tmImage library never loaded! CDN issue.');
    const errEl = document.getElementById('error');
    if (errEl) {
      errEl.innerText = 'FATAL: Teachable Machine library failed to load from CDN. Check internet connection.';
      errEl.style.display = 'block';
    }
    return;
  }
  
  for (const pathConfig of pathsToTry) {
    try {
      console.log(`\nAttempting: ${pathConfig.label} (${pathConfig.model})`);
      
      // First verify files can be fetched
      console.log('  → Fetching files...');
      const modelResp = await fetch(pathConfig.model);
      const metadataResp = await fetch(pathConfig.metadata);
      
      console.log(`  → model.json: ${modelResp.status}`);
      console.log(`  → metadata.json: ${metadataResp.status}`);
      
      if (!modelResp.ok || !metadataResp.ok) {
        console.warn(`  ✗ Files not accessible`);
        continue;
      }
      
      console.log(`  → Files OK, parsing JSON...`);
      const modelJson = await modelResp.clone().json();
      const metadataJson = await metadataResp.json();
      console.log(`  → modelTopology present:`, !!modelJson.modelTopology);
      console.log(`  → weightsManifest present:`, !!modelJson.weightsManifest);
      console.log(`  → metadata.labels:`, metadataJson.labels?.length || 0);
      
      console.log(`  → Calling tmImage.custom.fromURL()...`);
      model = await tmImage.custom.fromURL(pathConfig.model, pathConfig.metadata);
      
      console.log('✓✓✓ Model loaded successfully!');
      console.log('  Model:', model);
      loaded = true;
      break;
    } catch (mErr) {
      console.error(`  ✗ FAILED: ${mErr.message}`);
      console.error(`    Stack: ${mErr.stack}`);
    }
  }
  
  if (!loaded) {
    const errEl = document.getElementById('error');
    if (errEl) {
      errEl.innerText = 'Model failed to load. Open browser console (F12) for detailed error logs.';
      errEl.style.display = 'block';
    }
    console.error('\n❌ ALL ATTEMPTS FAILED');
  } else {
    console.log('\n=== Model Ready ===');
  }

  const video = document.getElementById('webcam');

  function showError(msg, logErr) {
    const el = document.getElementById('error');
    if (el) {
      el.innerText = msg;
      el.style.display = 'block';
    }
    if (logErr) console.error(logErr);
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showError('Camera not supported by this browser. Try a recent Chrome/Firefox on desktop or mobile, or open this page via http(s) or localhost.');
    return;
  }

  // Mute video element (helps with autoplay policies in some browsers)
  try { video.muted = true; } catch (e) {}
  // Add a startCamera function and wire it to a user gesture (start button)
  async function startCamera() {
    // clear previous errors
    const errEl = document.getElementById('error');
    if (errEl) { errEl.style.display = 'none'; errEl.innerText = ''; }

    // Try environment (rear) camera first, then fallback to default video
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch (err1) {
      console.log('Rear camera not available or permission denied, trying default camera:', err1);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (err2) {
        showError('Unable to access camera. Please allow camera permissions and reload the page. If you opened the file directly (file://), try running via http://localhost or HTTPS.', err2);
        return false;
      }
    }

    // Attach stream and attempt to play. Play may be blocked by autoplay policies; handle that gracefully.
    video.srcObject = stream;
    try {
      await video.play();
    } catch (playErr) {
      console.warn('Autoplay prevented by browser. Video is attached; user interaction may be required to start playback.', playErr);
      showError('Camera is ready but playback was blocked by browser autoplay policy. Use the capture button to start the preview.');
      // still consider this a success (stream attached)
    }
    return true;
  }

  // Wire start camera button
  const startBtn = document.getElementById('start-camera');
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      startBtn.innerText = '⏳';
      const ok = await startCamera();
      startBtn.innerText = ok ? '▶️' : '▶️';
    });
  }

  // Add event listeners
  document.getElementById('capture').addEventListener('click', async () => {
    const capBtn = document.getElementById('capture');
    // If currently showing a captured image, allow retake
    if (captured) {
      // hide canvas, show video and resume
      const canvas = document.getElementById('canvas');
      canvas.style.display = 'none';
      video.style.display = 'block';
      try { await video.play(); } catch (e) { console.warn('Unable to resume video after retake:', e); }
      captured = false;
      if (capBtn) capBtn.innerText = '📸';
      return;
    }

    // If the video isn't started yet, try to start it on user gesture
    if (!video.srcObject) {
      await startCamera();
    }
    // If the video is paused due to autoplay block, try to resume on user gesture
    if (video.paused && video.srcObject) {
      try { await video.play(); } catch (e) { console.warn('Unable to start video on user gesture:', e); }
    }
    await captureAndPredict();
  });
  document.getElementById('flash').addEventListener('click', toggleFlash);
  document.getElementById('gallery').addEventListener('click', () => alert('Gallery not implemented yet'));
  document.querySelector('.add-btn').addEventListener('click', () => alert('Added to collection!'));
}

async function captureAndPredict() {
  const video = document.getElementById('webcam');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);

  // Freeze the captured image: show canvas, hide video and pause playback
  try {
    video.pause();
    video.style.display = 'none';
    canvas.style.display = 'block';
    captured = true;
    const capBtn = document.getElementById('capture');
    if (capBtn) capBtn.innerText = '↺ Retake';
  } catch (e) { console.warn('Could not freeze video UI:', e); }

  // Flash effect if enabled
  if (flashEnabled) {
    const flashDiv = document.createElement('div');
    flashDiv.style.position = 'fixed';
    flashDiv.style.top = '0';
    flashDiv.style.left = '0';
    flashDiv.style.width = '100%';
    flashDiv.style.height = '100%';
    flashDiv.style.backgroundColor = 'white';
    flashDiv.style.zIndex = '9999';
    document.body.appendChild(flashDiv);
    setTimeout(() => document.body.removeChild(flashDiv), 200);
  }

  // Predict
  // Prepare input and run prediction if model is available
  if (!model) {
    console.warn('Model not loaded; skipping prediction.');
    document.getElementById('species-name').innerText = '[Model not loaded]';
    return;
  }

  try {
    // Teachable Machine API: predict from canvas element directly
    const prediction = await model.predict(canvas);
    console.log('✓ Prediction result:', prediction);
    
    // Find the class with highest probability
    let maxProb = 0;
    let maxIdx = 0;
    
    prediction.forEach((pred, idx) => {
      console.log(`Class ${idx} (${labels[idx]}): ${pred.probability.toFixed(4)}`);
      if (pred.probability > maxProb) {
        maxProb = pred.probability;
        maxIdx = idx;
      }
    });
    
    const species = labels[maxIdx];
    console.log('Predicted species:', species, 'with confidence:', (maxProb * 100).toFixed(1) + '%');
    
    if (species && infoData[species]) {
      document.getElementById('species-name').innerText = infoData[species].common + ' (' + (maxProb * 100).toFixed(0) + '%)';
      document.getElementById('common-name').innerText = infoData[species].common;
      document.getElementById('scientific-name').innerText = infoData[species].sci;
      document.getElementById('habitat').innerText = infoData[species].habitat;
      document.getElementById('details').innerText = infoData[species].details;
    } else {
      document.getElementById('species-name').innerText = 'Unknown species (ID: ' + maxIdx + ')';
      console.warn('Species not found:', species);
    }
  } catch (predErr) {
    console.error('❌ Prediction failed:', predErr);
    document.getElementById('species-name').innerText = 'Prediction error: ' + predErr.message;
  }
}

async function toggleFlash() {
  flashEnabled = !flashEnabled;
  const flashBtn = document.getElementById('flash');
  if (flashEnabled) {
    flashBtn.style.color = 'yellow';
  } else {
    flashBtn.style.color = '';
  }
  // Note: Actual torch toggle requires MediaStream Track API, but for simplicity, using screen flash
}

init();
