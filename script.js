import {
  db,
  ref,
  set,
  onValue,
  remove,
  push,
  onChildAdded,
} from "./firebase-config.js";

const roomInput = document.getElementById("roomInput");
const booth = document.getElementById("booth");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const statusText = document.getElementById("statusText");
const captureBtn = document.getElementById("captureBtn");
const stripCountSelect = document.getElementById("stripCount");
const stripSelector = document.getElementById("stripSelector");
const photoGallery = document.getElementById("photoGallery");
const downloadStripLink = document.getElementById("downloadStripLink");
const canvas = document.getElementById("canvas");

let roomCode = "";
let isMaster = false;
let localStream;
let peerConnection;
let capturedImages = [];
let totalStrips = 3;
let currentFacingMode = "user";
let partnerCaptureListenerSet = false;

let remoteStream = new MediaStream();
remoteVideo.srcObject = remoteStream;
remoteVideo.muted = true; // supaya autoplay lancar

const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

window.generateRoom = async () => {
  // Cleanup dulu kalau sebelumnya ada room
  if (roomCode) {
    await cleanupRoom(roomCode);
  }
  roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  roomInput.value = roomCode;
  isMaster = true;
  totalStrips = parseInt(stripCountSelect.value);
  capturedImages = [];
  photoGallery.innerHTML = "";
  downloadStripLink.classList.add("hidden");
  stripSelector.classList.remove("hidden");
  booth.classList.remove("hidden");
  statusText.textContent = "Status: Membuat Room...";
  showToast("Room dibuat, bagikan ke pasangan.");
  await setupCamera();
  setupConnection();
  setupPartnerCaptureListener();
};

window.joinRoom = async () => {
  const code = roomInput.value.trim();
  if (!code) {
    alert("Masukkan Room Code!");
    return;
  }
  if (roomCode && roomCode !== code) {
    await cleanupRoom(roomCode);
  }
  roomCode = code;
  isMaster = false;
  totalStrips = parseInt(stripCountSelect.value);
  capturedImages = [];
  photoGallery.innerHTML = "";
  downloadStripLink.classList.add("hidden");
  stripSelector.classList.add("hidden");
  booth.classList.remove("hidden");
  statusText.textContent = "Status: Bergabung ke Room...";
  showToast("Menghubungkan ke pasangan...");
  await setupCamera();
  setupConnection();
  setupPartnerCaptureListener();
};

async function cleanupRoom(code) {
  try {
    await remove(ref(db, `rooms/${code}`));
  } catch (e) {
    console.warn("Gagal cleanup room:", e);
  }
}

async function setupCamera() {
  try {
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacingMode, width: 480, height: 480 },
      audio: false,
    });
    localVideo.srcObject = localStream;
    console.log("Akses kamera berhasil:", localStream);
  } catch (error) {
    console.error("Gagal mengakses kamera:", error);
    showToast("Gagal mengakses kamera, periksa izin browser.");
  }
}

window.flipCamera = async () => {
  currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
  await setupCamera();
  if (peerConnection) {
    const sender = peerConnection
      .getSenders()
      .find((s) => s.track.kind === "video");
    if (sender) sender.replaceTrack(localStream.getVideoTracks()[0]);
  }
};

function setupConnection() {
  if (!localStream) {
    console.error("Stream belum siap!");
    return;
  }

  peerConnection = new RTCPeerConnection(rtcConfig);

  // Hapus remoteStream lama dulu
  remoteStream = new MediaStream();
  remoteVideo.srcObject = remoteStream;

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (e) => {
    // Biasanya e.streams[0] ada
    if (e.streams && e.streams[0]) {
      e.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
      remoteVideo.srcObject = remoteStream;
      console.log("Track diterima dari pasangan:", e.streams[0]);
    }
  };

  peerConnection.onicecandidate = (e) => {
    if (e.candidate) {
      const candidateRef = ref(
        db,
        `rooms/${roomCode}/${isMaster ? "callerCandidates" : "calleeCandidates"}`
      );
      push(candidateRef, e.candidate.toJSON());
    }
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log("ICE connection state:", peerConnection.iceConnectionState);
  };

  peerConnection.onconnectionstatechange = () => {
    console.log("Peer connection state:", peerConnection.connectionState);
  };

  if (isMaster) {
    createOffer();
  } else {
    listenForOffer();
  }
}

async function createOffer() {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  await set(ref(db, `rooms/${roomCode}/offer`), {
    sdp: offer.sdp,
    type: offer.type,
  });
  statusText.textContent = "Status: Menunggu jawaban...";

  // Listen answer
  onValue(ref(db, `rooms/${roomCode}/answer`), async (snapshot) => {
    const data = snapshot.val();
    if (data && !peerConnection.currentRemoteDescription) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
      statusText.textContent = "Status: Terhubung!";
      showToast("Pasangan terhubung!");
    }
  });

  // Listen callee ICE candidates
  onChildAdded(ref(db, `rooms/${roomCode}/calleeCandidates`), (snap) => {
    if (snap.val()) {
      peerConnection.addIceCandidate(new RTCIceCandidate(snap.val()));
    }
  });
}

function listenForOffer() {
  onValue(ref(db, `rooms/${roomCode}/offer`), async (snapshot) => {
    const offer = snapshot.val();
    if (!offer) return;

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await set(ref(db, `rooms/${roomCode}/answer`), {
      sdp: answer.sdp,
      type: answer.type,
    });

    statusText.textContent = "Status: Terhubung!";
    showToast("Terhubung ke pasangan!");

    // Listen caller ICE candidates
    onChildAdded(ref(db, `rooms/${roomCode}/callerCandidates`), (snap) => {
      if (snap.val()) {
        peerConnection.addIceCandidate(new RTCIceCandidate(snap.val()));
      }
    });
  });
}

captureBtn.onclick = () => {
  if (capturedImages.length >= totalStrips) {
    showToast("Strip sudah penuh!");
    return;
  }
  captureAndSend();
};

function captureAndSend() {
  const squareSize = 480;
  canvas.width = squareSize;
  canvas.height = squareSize;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(localVideo, 0, 0, squareSize, squareSize);
  const myCaptureDataUrl = canvas.toDataURL("image/png");

  // Tampilkan preview di gallery (sementara)
  const imgPreview = document.createElement("img");
  imgPreview.src = myCaptureDataUrl;
  imgPreview.classList.add("w-40", "rounded", "border-2", "border-purple-600");
  photoGallery.appendChild(imgPreview);

  // Kirim ke DB
  const userKey = isMaster ? "master" : "client";
  set(ref(db, `rooms/${roomCode}/capture/${userKey}`), myCaptureDataUrl);
  statusText.textContent = "Status: Menunggu pasangan capture...";
  showToast("Capture terkirim, menunggu pasangan...");

  // Kita tidak perlu pasang listener baru di sini, sudah pasang di setupPartnerCaptureListener()
}

function setupPartnerCaptureListener() {
  if (partnerCaptureListenerSet) return; // supaya gak duplikat listener
  partnerCaptureListenerSet = true;

  const partnerKey = isMaster ? "client" : "master";

  onValue(ref(db, `rooms/${roomCode}/capture/${partnerKey}`), (snapshot) => {
    const partnerCapture = snapshot.val();
    if (!partnerCapture) return;

    // Kalau strip penuh, jangan proses lagi
    if (capturedImages.length >= totalStrips) return;

    // Ambil capture kita dari DB untuk gabung (atau bisa simpan di variabel kalau mau)
    const userKey = isMaster ? "master" : "client";
    onValue(ref(db, `rooms/${roomCode}/capture/${userKey}`), (snap) => {
      const myCaptureDataUrl = snap.val();
      if (!myCaptureDataUrl) return;

      // Gabung gambar kiri kanan, master kiri, client kanan
      combineImages(
        isMaster ? myCaptureDataUrl : partnerCapture,
        isMaster ? partnerCapture : myCaptureDataUrl
      );

      // Hapus capture sementara supaya siap untuk capture berikutnya
      remove(ref(db, `rooms/${roomCode}/capture`));

      // Update status dan jika sudah penuh, aktifkan tombol download
      if (capturedImages.length + 1 === totalStrips) {
        setTimeout(updateDownloadLink, 1000);
      }
    }, { onlyOnce: true });
  });
}

function combineImages(imgLeftSrc, imgRightSrc) {
  const width = 480;
  const height = 480;
  canvas.width = width * 2;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  const leftImg = new Image();
  const rightImg = new Image();

  let loadedCount = 0;
  function tryDraw() {
    loadedCount++;
    if (loadedCount === 2) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(leftImg, 0, 0, width, height);
      ctx.drawImage(rightImg, width, 0, width, height);

      const combinedDataUrl = canvas.toDataURL("image/png");
      capturedImages.push(combinedDataUrl);

      const imgElement = document.createElement("img");
      imgElement.src = combinedDataUrl;
      imgElement.classList.add("w-full", "border", "rounded", "mb-3");
      photoGallery.appendChild(imgElement);
    }
  }

  leftImg.onload = tryDraw;
  rightImg.onload = tryDraw;

  leftImg.src = imgLeftSrc;
  rightImg.src = imgRightSrc;
}

function updateDownloadLink() {
  if (capturedImages.length === 0) return;

  const stripCanvas = document.createElement("canvas");
  stripCanvas.width = 960;
  stripCanvas.height = 480 * capturedImages.length;
  const ctx = stripCanvas.getContext("2d");

  let loadedCount = 0;
  capturedImages.forEach((src, index) => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      ctx.drawImage(img, 0, index * 480, 960, 480);
      loadedCount++;
      if (loadedCount === capturedImages.length) {
        const dataUrl = stripCanvas.toDataURL("image/png");
        downloadStripLink.href = dataUrl;
        downloadStripLink.classList.remove("hidden");
        downloadStripLink.download = `strip_${roomCode}.png`;
        statusText.textContent = "Status: Strip siap didownload!";
        showToast("Strip siap didownload!");
      }
    };
  });
}

function showToast(msg) {
  Toastify({
    text: msg,
    duration: 3000,
    gravity: "top",
    position: "right",
    style: {
      background: "#8b5cf6",
    },
  }).showToast();
}
