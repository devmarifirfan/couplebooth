import { db, ref, onValue, set, get, update } from "./firebase-config.js";

const roomInput = document.getElementById("roomInput");
const booth = document.getElementById("booth");
const localVideo = document.getElementById("localVideo");
const remoteImg = document.getElementById("remoteImg");
const canvas = document.getElementById("canvas");
const captureBtn = document.getElementById("captureBtn");
const downloadLink = document.getElementById("downloadLink");
const statusText = document.getElementById("statusText");

let roomCode = "";
let userPath = "";
let partnerPath = "";
let photoIndex = 1;
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
  } catch (e) {
    alert("Tidak bisa akses kamera");
    return;
  }

  // Tampilkan pasangan
  onValue(ref(db, `rooms/${roomCode}/${partnerPath}`), (snap) => {
    const val = snap.val();
    if (val) remoteImg.src = val;
  });
};

captureBtn.onclick = async () => {
  if (photoIndex > 4) return alert("Sudah ambil 4 foto!");

  // 1. Ambil frame lokal
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = 320;
  tempCanvas.height = 240;
  const ctx = tempCanvas.getContext("2d");
  ctx.drawImage(localVideo, 0, 0, 320, 240);
  const localData = tempCanvas.toDataURL("image/jpeg");

  // 2. Set ready status
  const readyPath = `rooms/${roomCode}/ready${userPath === "user1" ? "1" : "2"}`;
  await set(ref(db, readyPath), true);
  statusText.innerText = "Menunggu pasangan...";

  // 3. Tunggu sampai pasangan ready
  const checkInterval = setInterval(async () => {
    const snap1 = await get(ref(db, `rooms/${roomCode}/ready1`));
    const snap2 = await get(ref(db, `rooms/${roomCode}/ready2`));
    if (snap1.val() && snap2.val()) {
      clearInterval(checkInterval);
      statusText.innerText = "Mengambil foto...";

      // 4. Ambil frame pasangan
      const partnerSnap = await get(ref(db, `rooms/${roomCode}/${partnerPath}`));
      const partnerData = partnerSnap.val();

      // 5. Gabungkan
      canvas.width = 640;
      canvas.height = 240 * 4;
      const ctx = canvas.getContext("2d");
      const yOffset = (photoIndex - 1) * 240;

      const localImg = new Image();
      const remoteImgTag = new Image();
      localImg.src = localData;
      remoteImgTag.src = partnerData;

      localImg.onload = () => {
        remoteImgTag.onload = () => {
          ctx.drawImage(localImg, 0, yOffset, 320, 240);
          ctx.drawImage(remoteImgTag, 320, yOffset, 320, 240);

          // 6. Simpan ke database
          const photoPath = `rooms/${roomCode}/photos/photo${photoIndex}`;
          set(ref(db, photoPath), canvas.toDataURL("image/jpeg"));

          // 7. Reset
          update(ref(db, `rooms/${roomCode}`), {
            ready1: false,
            ready2: false
          });

          if (photoIndex === 4) {
            statusText.innerText = "Selesai! Bisa download sekarang.";
            downloadLink.href = canvas.toDataURL("image/png");
          } else {
            statusText.innerText = `Foto ${photoIndex} selesai!`;
          }

          photoIndex++;
        };
      };
    }
  }, 1000);
};
