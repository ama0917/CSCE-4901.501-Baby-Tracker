// firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore'; // or getDatabase for Realtime DB
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyC7zYQqg6zP8mHQdT9Uv90m1RCTHC9dbQ0",
    authDomain: "babytracker-ab1ed.firebaseapp.com",
    projectId: "babytracker-ab1ed",
    storageBucket: "babytracker-ab1ed.firebasestorage.app",
    messagingSenderId: "413147113225",
    appId: "1:413147113225:web:8246c3f97e047e88fbd5d8",
    measurementId: "G-9DB0WYBT80"
  };

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
