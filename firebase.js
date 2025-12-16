// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyC4ST7gLhlYKzmOTNLOA_J88oTw4i817kU",
  authDomain: "vsplit1-b2ed3.firebaseapp.com",
  projectId: "vsplit1-b2ed3",
  storageBucket: "vsplit1-b2ed3.firebasestorage.app",
  messagingSenderId: "218798598983",
  appId: "1:218798598983:web:23de4b5a7ab5c2ab07ba62",
  measurementId: "G-FN2EKMTK59"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
getAnalytics(firebaseApp);
