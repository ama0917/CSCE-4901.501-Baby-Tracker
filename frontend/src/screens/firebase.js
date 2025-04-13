// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBMq6GqUrmSro2knerMeUdtJMMrdt6MGu8",
  authDomain: "csce-4901-testdatabase.firebaseapp.com",
  projectId: "csce-4901-testdatabase",
  storageBucket: "csce-4901-testdatabase.appspot.com",
  messagingSenderId: "your-id",
  appId: "your-app-id",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export const getFirebaseToken = async () => {
  const user = auth.currentUser;
  if (user) {
    return await user.getIdToken();
  }
  return null;
};

export { auth };
