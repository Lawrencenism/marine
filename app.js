let model;
let flashEnabled = false;
let webcam;
let maxPredictions;
let isFrontCamera = false;
let isLooping = false;
let isFrozen = false;

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
  console.log('Initializing Marine Species Explorer...');
  
  try {
    // Load the model and metadata using official Teachable Machine API
    const modelURL = "./model/";
    console.log('Loading model from:', modelURL);
    
    model = await tmImage.load(modelURL + "model.json", modelURL + "metadata.json");
    maxPredictions = model.getTotalClasses();
    console.log('✓ Model loaded. Classes:', maxPredictions);
    
    // Setup webcam using Teachable Machine Webcam class
    const flip = true;
    webcam = new tmImage.Webcam(224, 224, flip);
    console.log('Setting up webcam...');
    
    await webcam.setup();
    console.log('✓ Webcam ready');
    
    // Append webcam canvas to DOM
    document.getElementById("webcam-container").appendChild(webcam.canvas);
    
    // Setup event listeners
    document.getElementById('start-camera').addEventListener('click', toggleCamera);
    
    document.getElementById('flip-camera').addEventListener('click', flipCamera);
    
    document.getElementById('capture').addEventListener('click', captureAndPredict);
    document.getElementById('flash').addEventListener('click', toggleFlash);
    document.getElementById('gallery').addEventListener('click', () => alert('Gallery not implemented yet'));
    document.querySelector('.add-btn').addEventListener('click', () => alert('Added to collection!'));
    
    console.log('✓ App initialized successfully!');
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    const errEl = document.getElementById('error');
    if (errEl) {
      errEl.innerText = 'Failed to initialize: ' + error.message;
      errEl.style.display = 'block';
    }
  }
}

async function loop() {
  if (!isFrozen) {
    webcam.update();
    await predict();
  }
  window.requestAnimationFrame(loop);
}

async function predict() {
  try {
    const prediction = await model.predict(webcam.canvas);
    
    // Find highest confidence prediction
    let maxProb = 0;
    let maxIdx = 0;
    
    for (let i = 0; i < maxPredictions; i++) {
      if (prediction[i].probability > maxProb) {
        maxProb = prediction[i].probability;
        maxIdx = i;
      }
    }
    
    const species = labels[maxIdx];
    if (species && infoData[species]) {
      document.getElementById('species-name').innerText = species + ' (' + (maxProb * 100).toFixed(1) + '%)';
      document.getElementById('common-name').innerText = infoData[species].common;
      document.getElementById('scientific-name').innerText = infoData[species].sci;
      document.getElementById('habitat').innerText = infoData[species].habitat;
      document.getElementById('details').innerText = infoData[species].details;
    }
  } catch (error) {
    console.error('Prediction error:', error);
  }
}

async function flipCamera() {
  try {
    if (!webcam) return;
    
    isFrontCamera = !isFrontCamera;
    const facingMode = isFrontCamera ? 'user' : 'environment';
    const flipButton = document.getElementById('flip-camera');
    
    // Visual feedback while flipping
    flipButton.style.opacity = '0.5';
    
    // Stop current webcam
    webcam.stop();
    
    // Create new webcam with flipped camera
    webcam = new tmImage.Webcam(224, 224, true);
    await webcam.setup({
      facingMode: facingMode
    });
    
    document.getElementById('webcam-container').innerHTML = '';
    document.getElementById('webcam-container').appendChild(webcam.canvas);
    
    await webcam.play();
    
    // Visual feedback - show which camera is active
    flipButton.style.opacity = '1';
    flipButton.style.backgroundColor = isFrontCamera ? '#FFD700' : '#4CAF50';
    flipButton.title = isFrontCamera ? 'Using front camera' : 'Using back camera';
    
  } catch (error) {
    console.error('Error flipping camera:', error);
    document.getElementById('error').innerText = `Camera flip failed: ${error.message}`;
    flipButton.style.opacity = '1';
  }
}

function captureAndPredict() {
  console.log('Capture clicked');
  isFrozen = true;
  const startBtn = document.getElementById('start-camera');
  startBtn.title = 'Resume camera';
  startBtn.style.opacity = '0.6';
  alert('Photo captured! Species: ' + document.getElementById('species-name').innerText);
}

async function toggleCamera() {
  const startBtn = document.getElementById('start-camera');
  
  if (isFrozen) {
    // Resume from frozen state
    console.log('Resuming camera...');
    isFrozen = false;
    startBtn.title = 'Pause camera';
    startBtn.style.opacity = '1';
    await webcam.play();
    if (!isLooping) {
      isLooping = true;
      window.requestAnimationFrame(loop);
    }
  } else {
    // Start camera from initial state
    console.log('Start camera clicked');
    isLooping = true;
    startBtn.title = 'Pause camera';
    await webcam.play();
    window.requestAnimationFrame(loop);
  }
}

function toggleFlash() {
  flashEnabled = !flashEnabled;
  const flashBtn = document.getElementById('flash');
  if (flashEnabled) {
    flashBtn.style.color = 'yellow';
  } else {
    flashBtn.style.color = '';
  }
}

// Initialize when page loads
window.addEventListener('load', init);
