// firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

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

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
const db = getFirestore(app);

export { auth, db };
