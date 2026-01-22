

// js/firebase-config.js

// إعدادات Firebase لمشروعك
const firebaseConfig = {
  apiKey: "AIzaSyCagdZU_eAHebBGCmG5W4FFTcDZIH4wOp0",
  authDomain: "coursehub-23ed2.firebaseapp.com",
  projectId: "coursehub-23ed2",
  storageBucket: "coursehub-23ed2.appspot.com",
  messagingSenderId: "367073521017",
  appId: "1:367073521017:web:67f5fd3be4c6407247d3a8",
  measurementId: "G-NJ6E39V9NW"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firebase Auth
const auth = firebase.auth();
