let model;
let flashEnabled = false;
let stream;
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
  model = await tf.loadGraphModel('./model/model.json');
  const video = document.getElementById('webcam');
  stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
  video.srcObject = stream;

  // Add event listeners
  document.getElementById('capture').addEventListener('click', captureAndPredict);
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
  const input = tf.tidy(() => {
    const img = tf.browser.fromPixels(canvas);
    const resized = tf.image.resizeBilinear(img, [224,224]);
    return resized.div(255).expandDims(0);
  });
  const prediction = await model.predict(input);
  const probs = prediction.arraySync()[0];
  const maxIdx = probs.indexOf(Math.max(...probs));
  const species = labels[maxIdx];
  document.getElementById('species-name').innerText = infoData[species].common;
  document.getElementById('common-name').innerText = infoData[species].common;
  document.getElementById('scientific-name').innerText = infoData[species].sci;
  document.getElementById('habitat').innerText = infoData[species].habitat;
  document.getElementById('details').innerText = infoData[species].details;
  tf.dispose([input, prediction]);
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
