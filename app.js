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
    // Start with back camera on phones (environment) and flip enabled for desktop
    const flip = true;
    webcam = new tmImage.Webcam(224, 224, flip);
    console.log('Setting up webcam with back camera...');
    
    // Request back camera (environment) for phones, front camera is secondary
    await webcam.setup({
      facingMode: 'environment'
    });
    console.log('✓ Webcam ready - using back camera');
    isFrontCamera = false;
    
    // Append webcam canvas to DOM
    document.getElementById("webcam-container").appendChild(webcam.canvas);
    
    // Setup event listeners
    const startBtn = document.getElementById('start-camera');
    const flipBtn = document.getElementById('flip-camera');
    const captureBtn = document.getElementById('capture');
    const flashBtn = document.getElementById('flash');
    const galleryBtn = document.getElementById('gallery');
    const addBtn = document.querySelector('.add-btn');
    
    if (!startBtn) throw new Error('start-camera button not found');
    if (!flipBtn) throw new Error('flip-camera button not found');
    if (!captureBtn) throw new Error('capture button not found');
    if (!flashBtn) throw new Error('flash button not found');
    if (!galleryBtn) throw new Error('gallery button not found');
    if (!addBtn) throw new Error('add-btn button not found');
    
    startBtn.addEventListener('click', toggleCamera);
    flipBtn.addEventListener('click', flipCamera);
    captureBtn.addEventListener('click', captureAndPredict);
    flashBtn.addEventListener('click', toggleFlash);
    galleryBtn.addEventListener('click', () => alert('Gallery not implemented yet'));
    addBtn.addEventListener('click', () => alert('Added to collection!'));
    
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
    if (!webcam) {
      console.error('Webcam not initialized');
      return;
    }
    
    const flipButton = document.getElementById('flip-camera');
    flipButton.style.opacity = '0.5';
    flipButton.style.pointerEvents = 'none';
    
    // Toggle camera
    isFrontCamera = !isFrontCamera;
    const facingMode = isFrontCamera ? 'user' : 'environment';
    const cameraLabel = isFrontCamera ? 'front' : 'back';
    
    console.log(`Switching to ${cameraLabel} camera...`);
    
    // Stop current webcam stream
    if (webcam && webcam.canvas && webcam.canvas.parentNode) {
      webcam.stop();
    }
    
    // Create new webcam instance with new facingMode
    webcam = new tmImage.Webcam(224, 224, true);
    
    // Setup with specific facing mode
    await webcam.setup({
      facingMode: { ideal: facingMode }
    });
    
    // Replace canvas in DOM
    const container = document.getElementById('webcam-container');
    container.innerHTML = '';
    container.appendChild(webcam.canvas);
    
    // Resume playback if was playing
    if (isLooping) {
      await webcam.play();
    }
    
    // Update button visual feedback
    flipButton.style.opacity = '1';
    flipButton.style.pointerEvents = 'auto';
    flipButton.style.backgroundColor = isFrontCamera ? '#FFD700' : '#4CAF50';
    flipButton.title = isFrontCamera ? 'Switch to back camera' : 'Switch to front camera';
    
    console.log(`✓ Switched to ${cameraLabel} camera`);
    
  } catch (error) {
    console.error('Error flipping camera:', error);
    const flipButton = document.getElementById('flip-camera');
    flipButton.style.opacity = '1';
    flipButton.style.pointerEvents = 'auto';
    
    document.getElementById('error').innerText = `Camera flip failed: ${error.message}`;
    document.getElementById('error').style.display = 'block';
  }
}

function captureAndPredict() {
  try {
    console.log('Photo captured');
    isFrozen = true;
    const startBtn = document.getElementById('start-camera');
    startBtn.title = 'Resume camera';
    startBtn.style.opacity = '0.6';
    
    const speciesName = document.getElementById('species-name').innerText;
    alert('📸 Photo captured!\n\n' + speciesName);
  } catch (error) {
    console.error('Error capturing:', error);
    document.getElementById('error').innerText = `Capture error: ${error.message}`;
    document.getElementById('error').style.display = 'block';
  }
}

async function toggleCamera() {
  const startBtn = document.getElementById('start-camera');
  
  try {
    if (isFrozen) {
      // Resume from frozen state
      console.log('Resuming camera...');
      isFrozen = false;
      startBtn.title = 'Pause camera';
      startBtn.style.opacity = '1';
      
      if (!isLooping) {
        isLooping = true;
        await webcam.play();
        window.requestAnimationFrame(loop);
      }
    } else if (isLooping) {
      // Pause/freeze the camera
      console.log('Pausing camera...');
      isFrozen = true;
      startBtn.title = 'Resume camera';
      startBtn.style.opacity = '0.6';
    } else {
      // Start camera from initial state
      console.log('Starting camera...');
      isLooping = true;
      startBtn.title = 'Pause camera';
      startBtn.style.opacity = '1';
      await webcam.play();
      window.requestAnimationFrame(loop);
    }
  } catch (error) {
    console.error('Error toggling camera:', error);
    document.getElementById('error').innerText = `Camera error: ${error.message}`;
    document.getElementById('error').style.display = 'block';
  }
}

function toggleFlash() {
  try {
    flashEnabled = !flashEnabled;
    const flashBtn = document.getElementById('flash');
    if (flashEnabled) {
      flashBtn.style.color = 'yellow';
      flashBtn.style.textShadow = '0 0 10px yellow';
      console.log('Flash enabled');
    } else {
      flashBtn.style.color = '';
      flashBtn.style.textShadow = '';
      console.log('Flash disabled');
    }
  } catch (error) {
    console.error('Error toggling flash:', error);
  }
}

// Initialize when page loads
window.addEventListener('load', init);
