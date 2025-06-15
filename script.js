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
const stripSelect = document.getElementById("stripSelect");
const flipBtn = document.getElementById("flipBtn");

let roomCode = "";
let userPath = "user1";
let partnerPath = "user2";
let isMaster = false;
let videoDevices = [];
let currentDeviceIndex = 0;
let currentStream = null;
let capturedImages = [];
let expectedStrips = 3;
let selfCaptured = false;
let waitingPartner = false;

window.generateRoomCode = function () {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  roomInput.value = code;
  alert(`Bagikan kode ini ke pasanganmu: ${code}`);
};

window.joinRoom = async function () {
  roomCode = roomInput.value.trim();
  if (!roomCode) return showToast("Masukkan Room Code terlebih dahulu!");
  booth.classList.remove("hidden");

  const user1Ref = ref(db, `rooms/${roomCode}/user1`);
  const snapshot = await get(user1Ref);
  if (snapshot.exists()) {
    userPath = "user2";
    partnerPath = "user1";
    isMaster = false;
    stripSelect.classList.add("hidden");
  } else {
    isMaster = true;
    stripSelect.classList.remove("hidden");
  }

  await getVideoDevices();
  await startCamera();

  const partnerRef = ref(db, `rooms/${roomCode}/${partnerPath}`);
  onValue(partnerRef, (snapshot) => {
    const data = snapshot.val();
    if (data?.capture) {
      if (selfCaptured && !waitingPartner) {
        mergePhotos(data.capture);
      } else {
        waitingPartner = true;
      }
    }
  });

  setInterval(() => {
    if (!currentStream) return;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = 320;
    tempCanvas.height = 240;
    const ctx = tempCanvas.getContext("2d");
    ctx.drawImage(localVideo, 0, 0, 320, 240);
    const dataURL = tempCanvas.toDataURL("image/jpeg");
    set(ref(db, `rooms/${roomCode}/${userPath}/preview`), dataURL);
  }, 1000);

  const previewRef = ref(db, `rooms/${roomCode}/${partnerPath}/preview`);
  onValue(previewRef, (snapshot) => {
    const url = snapshot.val();
    if (url) {
      remoteImg.src = url;
      statusText.textContent = "Status: Terhubung!";
    }
  });
};

flipBtn.onclick = async () => {
  currentDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length;
  await startCamera();
};

async function getVideoDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  videoDevices = devices.filter((d) => d.kind === "videoinput");
}

async function startCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach((t) => t.stop());
  }

  const deviceId = videoDevices[currentDeviceIndex]?.deviceId;
  currentStream = await navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      width: 320,
      height: 240,
    },
  });

  localVideo.srcObject = currentStream;
}

captureBtn.onclick = () => {
  expectedStrips = parseInt(stripSelect.value || "3");
  if (capturedImages.length >= expectedStrips) return showToast("Strip penuh!");

  startCountdown(() => {
    const squareSize = 240;
    canvas.width = squareSize;
    canvas.height = squareSize;

    const ctx = canvas.getContext("2d");
    const cropX = (localVideo.videoWidth - squareSize) / 2;
    const cropY = (localVideo.videoHeight - squareSize) / 2;

    ctx.drawImage(localVideo, cropX, cropY, squareSize, squareSize, 0, 0, squareSize, squareSize);
    const imageURL = canvas.toDataURL("image/png");
    selfCaptured = true;

    set(ref(db, `rooms/${roomCode}/${userPath}/capture`), imageURL);

    if (waitingPartner) {
      get(ref(db, `rooms/${roomCode}/${partnerPath}/capture`)).then((snap) => {
        if (snap.exists()) {
          mergePhotos(snap.val(), imageURL);
        }
      });
      waitingPartner = false;
    } else {
      showToast("Menunggu pasangan mengambil gambar...");
    }
  });
};

function mergePhotos(partnerImgURL, selfImgURL = null) {
  const squareSize = 240;
  canvas.width = squareSize * 2;
  canvas.height = squareSize;

  const ctx = canvas.getContext("2d");

  const leftImg = new Image();
  const rightImg = new Image();

  leftImg.onload = () => {
    rightImg.onload = () => {
      ctx.drawImage(leftImg, 0, 0, squareSize, squareSize);
      ctx.drawImage(rightImg, squareSize, 0, squareSize, squareSize);

      const mergedURL = canvas.toDataURL("image/png");
      capturedImages.push(mergedURL);

      const img = document.createElement("img");
      img.src = mergedURL;
      img.className = "strip-img";
      photoGallery.appendChild(img);
      updateStripDownload();

      selfCaptured = false;
      waitingPartner = false;
    };

    rightImg.src = selfImgURL || canvas.toDataURL("image/png");
  };

  leftImg.src = selfImgURL ? partnerImgURL : canvas.toDataURL("image/png");
}

function updateStripDownload() {
  if (capturedImages.length < 1) return;

  const stripCanvas = document.createElement("canvas");
  const width = 480;
  const height = 240 * capturedImages.length;
  stripCanvas.width = width;
  stripCanvas.height = height;

  const ctx = stripCanvas.getContext("2d");

  capturedImages.forEach((src, i) => {
    const img = new Image();
    img.src = src;
    ctx.drawImage(img, 0, i * 240, 480, 240);
  });

  const stripURL = stripCanvas.toDataURL("image/png");
  downloadStripLink.href = stripURL;
}

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

function showToast(message) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.className =
    "fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50";
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}
