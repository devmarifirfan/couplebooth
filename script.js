import { db, ref, set, onValue, remove } from "./firebase-config.js";

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
let stream;
let peerConnection;
let capturedImages = [];
let totalStrips = 3;
let readyState = { local: false, remote: false };

// STUN Google
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
  booth.classList.remove("hidden");

  stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  localVideo.srcObject = stream;

  peerConnection = new RTCPeerConnection(rtcConfig);
  stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

  peerConnection.ontrack = (e) => {
    remoteVideo.srcObject = e.streams[0];
  };

  peerConnection.onicecandidate = (e) => {
    if (e.candidate) {
      set(ref(db, `rooms/${roomCode}/${isMaster ? "callerCandidates" : "calleeCandidates"}`), e.candidate.toJSON());
    }
  };

  if (isMaster) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    set(ref(db, `rooms/${roomCode}/offer`), { sdp: offer.sdp, type: offer.type });

    onValue(ref(db, `rooms/${roomCode}/answer`), async (snapshot) => {
      const data = snapshot.val();
      if (data && !peerConnection.currentRemoteDescription) {
        const answerDesc = new RTCSessionDescription(data);
        await peerConnection.setRemoteDescription(answerDesc);
        statusText.textContent = "Status: Terhubung!";
        showToast("Pasangan terhubung!");
      }
    });

    onValue(ref(db, `rooms/${roomCode}/calleeCandidates`), async (snap) => {
      const data = snap.val();
      if (data) peerConnection.addIceCandidate(new RTCIceCandidate(data));
    });

  } else {
    const offerSnap = await ref(db, `rooms/${roomCode}/offer`);
    onValue(offerSnap, async (snap) => {
      const offer = snap.val();
      if (offer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        set(ref(db, `rooms/${roomCode}/answer`), { sdp: answer.sdp, type: answer.type });
        statusText.textContent = "Status: Terhubung!";
        showToast("Terhubung ke pasangan!");

        onValue(ref(db, `rooms/${roomCode}/callerCandidates`), async (snap2) => {
          const data = snap2.val();
          if (data) peerConnection.addIceCandidate(new RTCIceCandidate(data));
        });
      }
    });
  }
};

captureBtn.onclick = () => {
  if (capturedImages.length >= totalStrips) {
    showToast("Strip sudah penuh!");
    return;
  }

  // Kirim status siap capture
  const userKey = isMaster ? "master" : "client";
  set(ref(db, `rooms/${roomCode}/capture/${userKey}`), true);
  showToast("Menunggu pasangan mengambil foto...");

  // Tunggu pasangan juga siap
  const partnerKey = isMaster ? "client" : "master";
  onValue(ref(db, `rooms/${roomCode}/capture/${partnerKey}`), async (snap) => {
    const isReady = snap.val();
    if (isReady) {
      if (!readyState.local) {
        readyState.local = true;
        // Delay 300ms for sync
        setTimeout(() => {
          captureAndCombine();
          readyState = { local: false, remote: false };
          remove(ref(db, `rooms/${roomCode}/capture`)); // Reset
        }, 300);
      }
    }
  });
};

function captureAndCombine() {
  canvas.width = 640;
  canvas.height = 240;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(localVideo, 0, 0, 320, 240);
  ctx.drawImage(remoteVideo, 320, 0, 320, 240);

  const imgUrl = canvas.toDataURL("image/png");
  capturedImages.push(imgUrl);

  const img = document.createElement("img");
  img.src = imgUrl;
  img.classList.add("w-40", "border", "rounded");
  photoGallery.appendChild(img);

  updateDownload();
}

function updateDownload() {
  if (capturedImages.length < 1) return;

  const stripCanvas = document.createElement("canvas");
  stripCanvas.width = 640;
  stripCanvas.height = 240 * capturedImages.length;

  const ctx = stripCanvas.getContext("2d");

  capturedImages.forEach((src, idx) => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      ctx.drawImage(img, 0, idx * 240, 640, 240);
      const dataURL = stripCanvas.toDataURL("image/png");
      downloadStripLink.href = dataURL;
      downloadStripLink.classList.remove("hidden");
    };
  });
}

function showToast(msg) {
  Toastify({
    text: msg,
    duration: 3000,
    gravity: "top",
    position: "right",
    backgroundColor: "#8b5cf6",
  }).showToast();
}
