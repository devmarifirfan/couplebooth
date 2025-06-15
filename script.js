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

let roomCode = "";
let stream = null;
let userPath = "user1";
let partnerPath = "user2";
let capturedImages = [];

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
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 320 },
        height: { ideal: 240 },
        aspectRatio: 4 / 3
      }
    });
    localVideo.srcObject = stream;

    // Kirim frame secara berkala
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

  // Snapshot awal
  get(partnerRef).then((snapshot) => {
    const dataUrl = snapshot.val();
    if (dataUrl) {
      remoteImg.src = dataUrl;
      statusText.textContent = "Status: Terhubung!";
    }
  });

  // Realtime update
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

captureBtn.onclick = () => {
  startCountdown(() => {
    const width = 320;
    const height = 240;
    canvas.width = width * 2;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(localVideo, 0, 0, width, height);
    ctx.drawImage(remoteImg, width, 0, width, height);

    const imageURL = canvas.toDataURL("image/png");
    capturedImages.push(imageURL);

    const img = document.createElement("img");
    img.src = imageURL;
    img.classList.add("strip-img");
    photoGallery.appendChild(img);
    updateStripDownload();
  });
};

function updateStripDownload() {
  if (capturedImages.length < 1) return;

  const stripCanvas = document.createElement("canvas");
  const width = 640;
  const height = 240 * capturedImages.length;
  stripCanvas.width = width;
  stripCanvas.height = height;
  const ctx = stripCanvas.getContext("2d");

  capturedImages.forEach((src, index) => {
    const img = new Image();
    img.src = src;
    ctx.drawImage(img, 0, index * 240, width, 240);
  });

  const stripDataURL = stripCanvas.toDataURL("image/png");
  downloadStripLink.href = stripDataURL;
}
