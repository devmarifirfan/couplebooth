import { db, ref, onValue, set } from "./firebase-config.js";

const roomInput = document.getElementById("roomInput");
const booth = document.getElementById("booth");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const canvas = document.getElementById("canvas");
const captureBtn = document.getElementById("captureBtn");
const downloadLink = document.getElementById("downloadLink");

let roomCode = "";
let stream = null;
let role = "user1";

// Generate Room Code
window.generateRoomCode = function () {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  roomInput.value = code;
  alert(`Bagikan kode ini ke pasanganmu: ${code}`);
};

// Join Room
window.joinRoom = async function () {
  roomCode = roomInput.value.trim();
  if (!roomCode) return alert("Masukkan Room Code terlebih dahulu!");

  booth.classList.remove("hidden");

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    localVideo.srcObject = stream;
  } catch (e) {
    alert("Tidak bisa mengakses kamera. Pastikan kamu memberi izin.");
    return;
  }

  // Cek apakah user1 sudah diisi
  const user1Ref = ref(db, `rooms/${roomCode}/user1`);
  onValue(user1Ref, (snapshot) => {
    if (snapshot.exists()) {
      role = "user2";
    }
    startStreaming();
  }, { onlyOnce: true });
};

function startStreaming() {
  const myRef = ref(db, `rooms/${roomCode}/${role}`);
  const otherRef = ref(db, `rooms/${roomCode}/${role === "user1" ? "user2" : "user1"}`);

  const tempCanvas = document.createElement("canvas");
  const ctx = tempCanvas.getContext("2d");

  setInterval(() => {
    if (!localVideo.videoWidth) return;

    tempCanvas.width = localVideo.videoWidth;
    tempCanvas.height = localVideo.videoHeight;
    ctx.drawImage(localVideo, 0, 0, tempCanvas.width, tempCanvas.height);

    const dataUrl = tempCanvas.toDataURL("image/jpeg", 0.7);
    set(myRef, dataUrl);
  }, 1500);

  onValue(otherRef, (snapshot) => {
    const dataUrl = snapshot.val();
    if (dataUrl) remoteVideo.src = dataUrl;
  });
}

// Gabungkan Foto
captureBtn.onclick = () => {
  const width = 400, height = 150;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(localVideo, 0, 0, width / 2, height);
  ctx.drawImage(remoteVideo, width / 2, 0, width / 2, height);

  const imageURL = canvas.toDataURL("image/png");
  downloadLink.href = imageURL;
  canvas.classList.remove("hidden");
};
