let model;
let flashEnabled = false;
let stream;
let captured = false;
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
  // Load model first (non-blocking UI) but it's fine if camera fails, we still show helpful errors
  try {
    model = await tf.loadGraphModel('./model/model.json');
  } catch (mErr) {
    console.warn('Model failed to load (this may affect predictions):', mErr);
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

  const input = tf.tidy(() => {
    const img = tf.browser.fromPixels(canvas);
    const resized = tf.image.resizeBilinear(img, [224,224]);
    return resized.div(255).expandDims(0);
  });

  const prediction = model.predict(input);
  const probs = Array.isArray(prediction) ? prediction[0].arraySync()[0] : prediction.arraySync()[0];
  const maxIdx = probs.indexOf(Math.max(...probs));
  const species = labels[maxIdx];
  document.getElementById('species-name').innerText = infoData[species].common;
  document.getElementById('common-name').innerText = infoData[species].common;
  document.getElementById('scientific-name').innerText = infoData[species].sci;
  document.getElementById('habitat').innerText = infoData[species].habitat;
  document.getElementById('details').innerText = infoData[species].details;
  // Dispose tensors
  try { tf.dispose([input, prediction]); } catch (e) { /* ignore disposal errors */ }
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
