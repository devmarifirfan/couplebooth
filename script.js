import { db, ref, onValue, set, get } from "./firebase-config.js";

const roomInput = document.getElementById("roomInput");
const booth = document.getElementById("booth");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const canvas = document.getElementById("canvas");
const captureBtn = document.getElementById("captureBtn");
const downloadLink = document.getElementById("downloadLink");

let roomCode = "";
let stream = null;

window.generateRoomCode = function () {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  roomInput.value = code;
  alert(`Bagikan kode ini ke pasanganmu: ${code}`);
};

window.joinRoom = async function () {
  roomCode = roomInput.value.trim();
  if (!roomCode) return alert("Masukkan Room Code terlebih dahulu!");
  booth.classList.remove("hidden");

  // Deteksi user1/user2
  const user1Ref = ref(db, `rooms/${roomCode}/user1`);
  const snapshot = await get(user1Ref);

  let userPath = "user1";
  if (snapshot.exists()) userPath = "user2";

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    localVideo.srcObject = stream;

    // Capture manual dari video element ke canvas dan convert jadi dataURL
    setInterval(() => {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = 320;
      tempCanvas.height = 240;
      const ctx = tempCanvas.getContext("2d");
      ctx.drawImage(localVideo, 0, 0, tempCanvas.width, tempCanvas.height);
      const dataURL = tempCanvas.toDataURL("image/jpeg");

      set(ref(db, `rooms/${roomCode}/${userPath}`), dataURL);
    }, 1500);
  } catch (error) {
    alert("Tidak bisa mengakses kamera. Pastikan kamu memberi izin.");
    return;
  }

  // Tampilkan pasangan
  const partnerPath = userPath === "user1" ? "user2" : "user1";
  onValue(ref(db, `rooms/${roomCode}/${partnerPath}`), (snapshot) => {
    const dataUrl = snapshot.val();
    if (dataUrl) remoteVideo.src = dataUrl;
  });
};

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
