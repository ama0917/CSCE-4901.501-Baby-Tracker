import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';

const auth = getAuth();

signInWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    // Signed in
    const user = userCredential.user;
    // Get the ID token
    user.getIdToken().then((idToken) => {
      // Store the token for future API calls
      AsyncStorage.setItem("token", idToken);
    });
  })
  .catch((error) => {
    // Handle Errors here.
    console.error(error);
  });
