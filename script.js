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
const resetRoomBtn = document.getElementById("resetRoomBtn"); // tombol reset

let roomCode = "";
let isMaster = false;
let stream;
let peerConnection;
let capturedImages = [];
let totalStrips = 3;
let currentFacingMode = "user";
let partnerCaptured = false;
let myCapture = null;

const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

window.generateRoom = async () => {
  roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  roomInput.value = roomCode;
  isMaster = true;
  showToast("Room dibuat, bagikan ke pasangan.");
  stripSelector.classList.remove("hidden");
};

window.joinRoom = async () => {
  roomCode = roomInput.value.trim();
  if (!roomCode) return alert("Masukkan Room Code!");

  totalStrips = parseInt(stripCountSelect.value);
  capturedImages = [];
  photoGallery.innerHTML = "";
  downloadStripLink.classList.add("hidden");

  booth.classList.remove("hidden");

  await setupCamera();
  setupConnection();
  renderEmptyStrips();
};

async function setupCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacingMode, width: 480, height: 480 },
      audio: false,
    });
    console.log("Akses kamera berhasil:", stream);
    localVideo.srcObject = stream;
  } catch (error) {
    console.error("Gagal mengakses kamera:", error);
    showToast("Gagal mengakses kamera, periksa izin browser.");
  }
}

window.flipCamera = async () => {
  currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
  if (stream) stream.getTracks().forEach((track) => track.stop());
  await setupCamera();
  if (peerConnection) {
    const sender = peerConnection
      .getSenders()
      .find((s) => s.track.kind === "video");
    if (sender) sender.replaceTrack(stream.getVideoTracks()[0]);
  }
};

function setupConnection() {
  if (!stream) {
    console.error("Stream belum siap!");
    return;
  }

  peerConnection = new RTCPeerConnection(rtcConfig);

  stream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, stream);
  });

  peerConnection.ontrack = (e) => {
    console.log("Track diterima dari pasangan:", e.streams);
    if (e.streams && e.streams[0]) {
      remoteVideo.srcObject = e.streams[0];
      console.log("Remote stream:", e.streams[0]);
    }
  };

  peerConnection.onicecandidate = (e) => {
    if (e.candidate) {
      const candidateRef = ref(
        db,
        `rooms/${roomCode}/${
          isMaster ? "callerCandidates" : "calleeCandidates"
        }`
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
  console.log("Mengirim offer:", offer);
  await peerConnection.setLocalDescription(offer);
  set(ref(db, `rooms/${roomCode}/offer`), { sdp: offer.sdp, type: offer.type });

  onValue(ref(db, `rooms/${roomCode}/answer`), async (snapshot) => {
    const data = snapshot.val();
    if (data && !peerConnection.currentRemoteDescription) {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data)
      );
      console.log("Jawaban diterima:", data);
      statusText.textContent = "Status: Terhubung!";
      showToast("Pasangan terhubung!");
    }
  });

  onChildAdded(ref(db, `rooms/${roomCode}/calleeCandidates`), (snap) => {
    if (snap.val()) {
      peerConnection.addIceCandidate(new RTCIceCandidate(snap.val()));
    }
  });
}

function listenForOffer() {
  onValue(ref(db, `rooms/${roomCode}/offer`), async (snap) => {
    const offer = snap.val();
    if (offer) {
      console.log("Menerima offer:", offer);
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log("Mengirim jawaban:", answer);
      set(ref(db, `rooms/${roomCode}/answer`), {
        sdp: answer.sdp,
        type: answer.type,
      });

      statusText.textContent = "Status: Terhubung!";
      showToast("Terhubung ke pasangan!");

      onChildAdded(ref(db, `rooms/${roomCode}/callerCandidates`), (snap2) => {
        if (snap2.val()) {
          peerConnection.addIceCandidate(new RTCIceCandidate(snap2.val()));
        }
      });
    }
  });
}

function renderEmptyStrips() {
  photoGallery.innerHTML = "";
  for (let i = 0; i < totalStrips; i++) {
    const row = document.createElement("div");
    row.classList.add("flex", "gap-2", "mb-2");

    const img1 = document.createElement("div");
    const img2 = document.createElement("div");

    [img1, img2].forEach((el) => {
      el.classList.add(
        "w-40",
        "h-40",
        "bg-purple-100",
        "border",
        "border-dashed",
        "flex",
        "items-center",
        "justify-center",
        "text-purple-300",
        "text-sm",
        "rounded"
      );
      el.textContent = "Foto";
    });

    row.appendChild(img1);
    row.appendChild(img2);
    photoGallery.appendChild(row);
  }
}

captureBtn.onclick = () => {
  if (capturedImages.length >= totalStrips) {
    showToast("Strip sudah penuh!");
    return;
  }

  const squareSize = 480;
  canvas.width = squareSize;
  canvas.height = squareSize;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(localVideo, 0, 0, squareSize, squareSize);
  myCapture = canvas.toDataURL("image/png");

  const userKey = isMaster ? "master" : "client";
  set(ref(db, `rooms/${roomCode}/capture/${userKey}`), myCapture);
  showToast("Menunggu pasangan...");

  const partnerKey = isMaster ? "client" : "master";
  const partnerRef = ref(db, `rooms/${roomCode}/capture/${partnerKey}`);

  if (isListening) return;
  isListening = true;

  onValue(partnerRef, async (snap) => {
    const partnerImg = snap.val();
    if (partnerImg && !partnerCaptured) {
      partnerCaptured = true;
      setTimeout(() => {
        combineImages(myCapture, partnerImg);
        partnerCaptured = false;
        remove(ref(db, `rooms/${roomCode}/capture`));

        off(partnerRef); 
        isListening = false; 
      }, 500);
    }
  });
};

function combineImages(img1, img2) {
  const left = new Image();
  const right = new Image();
  let loaded = 0;

  left.onload = right.onload = () => {
    loaded++;
    if (loaded === 2) {
      const rowIndex = capturedImages.length;
      capturedImages.push([img1, img2]);

      const row = photoGallery.children[rowIndex];
      if (row && row.children.length === 2) {
        [img1, img2].forEach((src, i) => {
          const img = document.createElement("img");
          img.src = src;
          img.classList.add(
            "w-full",
            "h-full",
            "object-cover",
            "rounded",
            "border"
          );
          const cell = row.children[i];
          cell.innerHTML = "";
          cell.appendChild(img);
        });
      }

      if (capturedImages.length === totalStrips) {
        setTimeout(updateDownload, 500);
      }
    }
  };

  left.src = isMaster ? img1 : img2;
  right.src = isMaster ? img2 : img1;
}

function updateDownload() {
  if (capturedImages.length < 1) return;

  const stripCanvas = document.createElement("canvas");
  stripCanvas.width = 960;
  stripCanvas.height = 480 * capturedImages.length;
  const ctx = stripCanvas.getContext("2d");

  let loadedCount = 0;

  capturedImages.forEach(([leftSrc, rightSrc], index) => {
    const leftImg = new Image();
    const rightImg = new Image();
    let pairLoaded = 0;

    leftImg.onload = rightImg.onload = () => {
      pairLoaded++;
      if (pairLoaded === 2) {
        ctx.drawImage(leftImg, 0, index * 480, 480, 480);
        ctx.drawImage(rightImg, 480, index * 480, 480, 480);
        loadedCount++;
        if (loadedCount === capturedImages.length) {
          const dataURL = stripCanvas.toDataURL("image/png");
          downloadStripLink.href = dataURL;
          downloadStripLink.classList.remove("hidden");
        }
      }
    };

    leftImg.src = leftSrc;
    rightImg.src = rightSrc;
  });
}

resetRoomBtn.onclick = () => {
  if (!roomCode) return alert("Belum masuk room.");

  // Hapus semua data di Firebase untuk room tersebut
  remove(ref(db, `rooms/${roomCode}`));

  // Reset galeri foto
  capturedImages = [];
  photoGallery.innerHTML = "";
  downloadStripLink.classList.add("hidden");
  renderEmptyStrips();

  showToast("Room berhasil di-reset. Siap foto ulang!");
};

function showToast(msg) {
  Toastify({
    text: msg,
    duration: 3000,
    gravity: "top",
    position: "right",
    backgroundColor: "#8b5cf6",
  }).showToast();
}
