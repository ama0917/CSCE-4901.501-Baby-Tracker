import { useEffect, useState } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app } from '../firebaseConfig';

const useUserRole = () => {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const db = getFirestore(app);
  const auth = getAuth();

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error('No user signed in');

        const userDoc = await getDoc(doc(db, 'Users', currentUser.uid));
        if (!userDoc.exists()) throw new Error('User document not found');

        const data = userDoc.data();
        setRole(data.Role); // Ensure capitalization matches Firestore
      } catch (err) {
        console.error('Error fetching role:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, []);

  return { role, loading, error };
};

export default useUserRole;
