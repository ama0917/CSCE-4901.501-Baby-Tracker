import { getAuth } from 'firebase/auth';

export const getFreshToken = async () => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken(true);
};

export const getUserId = () => {
  const auth = getAuth();
  return auth.currentUser?.uid || null;
};
