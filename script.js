let localStream;
let isMaster = false;
let roomCode = "";
let totalStrips = 3;
let capturedImages = [];

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const captureBtn = document.getElementById("captureBtn");
const photoGallery = document.getElementById("photoGallery");
const downloadStripLink = document.getElementById("downloadStripLink");
const stripCountSelect = document.getElementById("stripCount");
const canvas = document.getElementById("canvas");
const booth = document.getElementById("booth");

// Dummy peer setup
let dummyRemoteImage = "https://via.placeholder.com/480x480.png?text=Pasangan";

window.generateRoom = function () {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  document.getElementById("roomInput").value = code;
  showToast(`Room dibuat: ${code}`, "#8b5cf6");
};

window.joinRoom = async function () {
  roomCode = document.getElementById("roomInput").value.trim();
  if (!roomCode) return showToast("Masukkan kode room yaa", "#ef4444");

  totalStrips = parseInt(stripCountSelect.value);
  renderEmptyStrips();

  downloadStripLink.classList.add("hidden");
  booth.classList.remove("hidden");

  await setupCamera();
  setupDummyRemote(); // simulasi pasangan
  showToast(`Gabung ke room ${roomCode}`, "#22c55e");
};

function showToast(text, bg) {
  Toastify({
    text,
    duration: 3000,
    gravity: "top",
    position: "center",
    backgroundColor: bg,
  }).showToast();
}

async function setupCamera() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true });
  localVideo.srcObject = localStream;
}

function setupDummyRemote() {
  // Simulasi remote video (seharusnya pakai WebRTC asli)
  remoteVideo.src = dummyRemoteImage;
  remoteVideo.loop = true;
  remoteVideo.autoplay = true;
}

captureBtn.onclick = () => {
  if (capturedImages.length >= totalStrips) return;

  const localCanvas = document.createElement("canvas");
  localCanvas.width = 480;
  localCanvas.height = 480;
  const lctx = localCanvas.getContext("2d");
  lctx.drawImage(localVideo, 0, 0, 480, 480);
  const localImg = localCanvas.toDataURL("image/png");

  const remoteCanvas = document.createElement("canvas");
  remoteCanvas.width = 480;
  remoteCanvas.height = 480;
  const rctx = remoteCanvas.getContext("2d");
  rctx.drawImage(remoteVideo, 0, 0, 480, 480);
  const remoteImg = remoteCanvas.toDataURL("image/png");

  combineImages(localImg, remoteImg);
};

function combineImages(img1, img2) {
  const size = 480;
  canvas.width = size * 2;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const left = new Image();
  const right = new Image();
  let loaded = 0;

  left.onload = right.onload = () => {
    loaded++;
    if (loaded === 2) {
      ctx.drawImage(left, 0, 0, size, size);
      ctx.drawImage(right, size, 0, size, size);
      const finalImg = canvas.toDataURL("image/png");
      updateStripPreview(finalImg);
      if (capturedImages.length === totalStrips) updateDownload();
    }
  };

  // urutan sesuai master/slave (dummy aja)
  left.src = img1;
  right.src = img2;
}

function renderEmptyStrips() {
  photoGallery.innerHTML = "";
  capturedImages = [];

  for (let i = 0; i < totalStrips; i++) {
    const slot = document.createElement("div");
    slot.className =
      "w-32 h-32 rounded border-4 border-dashed border-purple-300 flex items-center justify-center text-sm text-gray-400";
    slot.textContent = `Strip ${i + 1}`;
    slot.id = `strip-slot-${i}`;
    photoGallery.appendChild(slot);
  }
}

function updateStripPreview(imageDataURL) {
  const index = capturedImages.length;
  const slot = document.getElementById(`strip-slot-${index}`);
  if (!slot) return;

  const img = document.createElement("img");
  img.src = imageDataURL;
  img.className = "w-full h-full object-cover rounded";
  slot.innerHTML = "";
  slot.appendChild(img);
  capturedImages.push(imageDataURL);
}

function updateDownload() {
  // Gabung strip jadi 1 canvas
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = 960;
  finalCanvas.height = 480 * totalStrips;
  const ctx = finalCanvas.getContext("2d");

  let loaded = 0;
  capturedImages.forEach((dataURL, idx) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 480 * idx, 960, 480);
      loaded++;
      if (loaded === totalStrips) {
        const finalStrip = finalCanvas.toDataURL("image/png");
        downloadStripLink.href = finalStrip;
        downloadStripLink.classList.remove("hidden");
      }
    };
    img.src = dataURL;
  });
}
