// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC_37CKb7ZOS7082Anw1YskKYX4GZZlXYg",
  authDomain: "guardafacil-9d01f.firebaseapp.com",
  projectId: "guardafacil-9d01f",
  storageBucket: "guardafacil-9d01f.firebasestorage.app",
  messagingSenderId: "275667229026",
  appId: "1:275667229026:web:21ddbd99d81ce17cb0f43b",
  measurementId: "G-THG9239297"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);