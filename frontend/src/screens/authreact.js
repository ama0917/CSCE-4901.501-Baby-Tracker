import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const auth = getAuth();

signInWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    // Signed in
    const user = userCredential.user;
    // Get the ID token
    user.getIdToken().then((idToken) => {
      // Store the token for future API calls
      localStorage.setItem("token", idToken);
    });
  })
  .catch((error) => {
    // Handle Errors here.
    console.error(error);
  });
