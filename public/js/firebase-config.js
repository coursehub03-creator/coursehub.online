// js/firebase-config.js

// إعداد Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCagdZU_eAHebBGCmG5W4FFTcDZIH4wOp0",
  authDomain: "coursehub-23ed2.firebaseapp.com",
  projectId: "coursehub-23ed2",
  storageBucket: "coursehub-23ed2.appspot.com",
  messagingSenderId: "367073521017",
  appId: "1:367073521017:web:67f5fd3be4c6407247d3a8"
};

// Initialize Firebase (نسخة التوافق - compat)
firebase.initializeApp(firebaseConfig);

// Auth & Firestore
const auth = firebase.auth();
const db = firebase.firestore();

// Google Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
