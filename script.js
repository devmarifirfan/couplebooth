import { db, ref, onValue, set, get } from "./firebase-config.js";

const roomInput = document.getElementById("roomInput");
const booth = document.getElementById("booth");
const localVideo = document.getElementById("localVideo");
const remoteImg = document.getElementById("remoteImg");
const canvas = document.getElementById("canvas");
const captureBtn = document.getElementById("captureBtn");
const downloadLink = document.getElementById("downloadLink");
const photoGallery = document.getElementById("photoGallery");
const photoList = document.getElementById("photoList");
const downloadStripBtn = document.getElementById("downloadStripBtn");
const statusText = document.getElementById("statusText");

let roomCode = "";
let userPath = "user1";
let partnerPath = "user2";
let stream = null;
let photos = []; // Menyimpan 4 foto (dataURL)

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
  userPath = snapshot.exists() ? "user2" : "user1";
  partnerPath = userPath === "user1" ? "user2" : "user1";

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    localVideo.srcObject = stream;

    setInterval(() => {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = 320;
      tempCanvas.height = 240;
      const ctx = tempCanvas.getContext("2d");
      ctx.drawImage(localVideo, 0, 0, 320, 240);
      const dataURL = tempCanvas.toDataURL("image/jpeg");

      set(ref(db, `rooms/${roomCode}/${userPath}`), dataURL);
    }, 1500);
  } catch (error) {
    alert("Tidak bisa mengakses kamera. Pastikan kamu memberi izin.");
    return;
  }

  onValue(ref(db, `rooms/${roomCode}/${partnerPath}`), (snapshot) => {
    const dataUrl = snapshot.val();
    if (dataUrl) {
      remoteImg.src = dataUrl;
      statusText.textContent = "Status: Terhubung!";
    } else {
      statusText.textContent = "Status: Menunggu pasangan...";
    }
  });
};

captureBtn.onclick = () => {
  if (photos.length >= 4) {
    alert("Sudah 4 foto. Silakan unduh.");
    return;
  }

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = 400;
  tempCanvas.height = 150;
  const ctx = tempCanvas.getContext("2d");

  // Set ukuran lokal & pasangan
  ctx.drawImage(localVideo, 0, 0, 200, 150);
  ctx.drawImage(remoteImg, 200, 0, 200, 150);

  const imageURL = tempCanvas.toDataURL("image/png");
  photos.push(imageURL);

  // Tampilkan thumbnail dan tombol unduh
  const wrapper = document.createElement("div");
  wrapper.style.textAlign = "center";

  const img = document.createElement("img");
  img.src = imageURL;
  img.width = 150;

  const btn = document.createElement("a");
  btn.href = imageURL;
  btn.download = `photo-${photos.length}.png`;
  btn.textContent = `⬇️ Download ${photos.length}`;

  wrapper.appendChild(img);
  wrapper.appendChild(btn);
  photoList.appendChild(wrapper);

  photoGallery.classList.remove("hidden");
};

// Gabungkan semua foto jadi 1 strip vertikal
downloadStripBtn.onclick = () => {
  if (photos.length === 0) return alert("Belum ada foto!");

  const stripCanvas = document.createElement("canvas");
  const width = 400;
  const heightPerPhoto = 150;
  stripCanvas.width = width;
  stripCanvas.height = photos.length * heightPerPhoto;
  const ctx = stripCanvas.getContext("2d");

  photos.forEach((dataUrl, i) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, i * heightPerPhoto, width, heightPerPhoto);

      if (i === photos.length - 1) {
        const stripURL = stripCanvas.toDataURL("image/png");
        downloadLink.href = stripURL;
        downloadLink.click(); // auto download
      }
    };
    img.src = dataUrl;
  });
};
