import { db, ref, onValue, set, get } from "./firebase-config.js";

const roomInput = document.getElementById("roomInput");
const booth = document.getElementById("booth");
const localVideo = document.getElementById("localVideo");
const remoteImg = document.getElementById("remoteImg");
const statusText = document.getElementById("statusText");
const captureBtn = document.getElementById("captureBtn");
const countdown = document.getElementById("countdown");
const photoGallery = document.getElementById("photoGallery");
const canvas = document.getElementById("canvas");
const downloadStripLink = document.getElementById("downloadStripLink");
const stripCountSelect = document.getElementById("stripCount");

let roomCode = "";
let stream = null;
let userPath = "user1";
let partnerPath = "user2";
let capturedImages = [];
let mode = "self";
let currentStrip = 0;
let maxStrip = 3;

document.querySelectorAll("input[name='mode']").forEach(input => {
  input.addEventListener("change", () => {
    mode = document.querySelector("input[name='mode']:checked").value;
  });
});

stripCountSelect.addEventListener("change", () => {
  maxStrip = parseInt(stripCountSelect.value);
});

window.generateRoomCode = function () {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  roomInput.value = code;
  alert(`Bagikan kode ini ke pasanganmu: ${code}`);
};

window.joinRoom = async function () {
  roomCode = roomInput.value.trim();
  if (!roomCode) return alert("Masukkan Room Code terlebih dahulu!");
  booth.classList.remove("hidden");

  const user1Ref = ref(db, `rooms/${roomCode}/user1`);
  const snapshot = await get(user1Ref);
  if (snapshot.exists()) {
    userPath = "user2";
    partnerPath = "user1";
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    localVideo.srcObject = stream;

    setTimeout(() => {
      setInterval(() => {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = 320;
        tempCanvas.height = 240;
        const ctx = tempCanvas.getContext("2d");
        ctx.drawImage(localVideo, 0, 0, 320, 240);
        const dataURL = tempCanvas.toDataURL("image/jpeg");
        set(ref(db, `rooms/${roomCode}/${userPath}`), dataURL);
      }, 1000);
    }, 1000);
  } catch (error) {
    alert("Tidak bisa akses kamera.");
    return;
  }

  const partnerRef = ref(db, `rooms/${roomCode}/${partnerPath}`);
  get(partnerRef).then((snapshot) => {
    const dataUrl = snapshot.val();
    if (dataUrl) {
      remoteImg.src = dataUrl;
      statusText.textContent = "Status: Terhubung!";
    }
  });

  onValue(partnerRef, (snapshot) => {
    const dataUrl = snapshot.val();
    if (dataUrl) {
      remoteImg.src = dataUrl;
      statusText.textContent = "Status: Terhubung!";
    }
  });
};

function startCountdown(callback) {
  countdown.classList.remove("hidden");
  let count = 3;
  countdown.textContent = count;

  const interval = setInterval(() => {
    count--;
    countdown.textContent = count;
    if (count === 0) {
      clearInterval(interval);
      countdown.classList.add("hidden");
      callback();
    }
  }, 1000);
}

function captureSelf() {
  const squareSize = 240;
  canvas.width = squareSize;
  canvas.height = squareSize;
  const ctx = canvas.getContext("2d");

  const cropX = (localVideo.videoWidth - squareSize) / 2;
  const cropY = (localVideo.videoHeight - squareSize) / 2;
  ctx.drawImage(localVideo, cropX, cropY, squareSize, squareSize, 0, 0, squareSize, squareSize);

  const imageURL = canvas.toDataURL("image/png");
  addCapturedImage(imageURL);
}

function captureTogether() {
  const captureRef = ref(db, `rooms/${roomCode}/capture/${userPath}`);
  const partnerCaptureRef = ref(db, `rooms/${roomCode}/capture/${partnerPath}`);

  const squareSize = 240;
  canvas.width = squareSize;
  canvas.height = squareSize;
  const ctx = canvas.getContext("2d");

  const cropX = (localVideo.videoWidth - squareSize) / 2;
  const cropY = (localVideo.videoHeight - squareSize) / 2;
  ctx.drawImage(localVideo, cropX, cropY, squareSize, squareSize, 0, 0, squareSize, squareSize);
  const dataURL = canvas.toDataURL("image/png");

  set(captureRef, dataURL);

  const unsubscribe = onValue(partnerCaptureRef, (snap) => {
    const partnerImage = snap.val();
    if (partnerImage) {
      unsubscribe();

      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = squareSize * 2;
      finalCanvas.height = squareSize;
      const finalCtx = finalCanvas.getContext("2d");

      const img1 = new Image();
      img1.src = userPath === "user1" ? dataURL : partnerImage;
      const img2 = new Image();
      img2.src = userPath === "user1" ? partnerImage : dataURL;

      img1.onload = () => {
        finalCtx.drawImage(img1, 0, 0, squareSize, squareSize);
        img2.onload = () => {
          finalCtx.drawImage(img2, squareSize, 0, squareSize, squareSize);
          const finalImageURL = finalCanvas.toDataURL("image/png");
          addCapturedImage(finalImageURL);
        };
      };
    }
  });
}

function addCapturedImage(imageURL) {
  capturedImages.push(imageURL);
  const img = document.createElement("img");
  img.src = imageURL;
  img.classList.add("strip-img");
  photoGallery.appendChild(img);
  currentStrip++;

  updateStripDownload();

  if (currentStrip >= maxStrip) {
    alert("Sesi foto selesai!");
    captureBtn.disabled = true;
  }
}

function updateStripDownload() {
  if (capturedImages.length < 1) return;
  const width = 640;
  const height = 240 * capturedImages.length;

  const stripCanvas = document.createElement("canvas");
  stripCanvas.width = width;
  stripCanvas.height = height;
  const ctx = stripCanvas.getContext("2d");

  let loaded = 0;
  capturedImages.forEach((src, i) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, i * 240, width, 240);
      loaded++;
      if (loaded === capturedImages.length) {
        const stripDataURL = stripCanvas.toDataURL("image/png");
        downloadStripLink.href = stripDataURL;
      }
    };
    img.src = src;
  });
}

captureBtn.onclick = () => {
  if (currentStrip >= maxStrip) return;

  startCountdown(() => {
    if (mode === "self") {
      captureSelf();
    } else {
      captureTogether();
    }
  });
};
