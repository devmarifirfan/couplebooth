import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, set, get, update } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC1yl1m6X3ob9Hafn4P1Nbppr11DKs7ngA",
  authDomain: "girlfriendproject-a2a0b.firebaseapp.com",
  databaseURL: "https://girlfriendproject-a2a0b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "girlfriendproject-a2a0b",
  storageBucket: "girlfriendproject-a2a0b.appspot.com",
  messagingSenderId: "128310648897",
  appId: "1:128310648897:web:fb1836480e8e600b2026c0"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, onValue, set, get, update };
