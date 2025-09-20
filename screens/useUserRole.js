import { useEffect, useState } from 'react';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app } from '../firebaseConfig';

const useUserRole = () => {
  const [role, setRole] = useState('unassigned'); // 'parent' | 'caregiver' | 'unassigned'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const db = getFirestore(app);
  const auth = getAuth();

  useEffect(() => {
    const run = async () => {
      try {
        const u = auth.currentUser;
        if (!u) {
          setRole('unassigned');
          return;
        }

        // Read Users/{uid}.UserType if present
        const snap = await getDoc(doc(db, 'Users', u.uid));
        const raw = (snap.exists() && (snap.data()?.UserType || '')).toLowerCase();

        if (raw === 'caregiver') {
          setRole('caregiver');
          return;
        }

        if (raw === 'parent') {
          // Validate they actually own a child; otherwise treat as unassigned
          const owns = await getDocs(query(collection(db, 'children'), where('userId', '==', u.uid), limit(1)));
          setRole(!owns.empty ? 'parent' : 'unassigned');
          return;
        }

        // No role recorded yet
        setRole('unassigned');
      } catch (e) {
        console.error('useUserRole error', e);
        setError(e?.message || String(e));
        setRole('unassigned');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return { role, loading, error };
};

export default useUserRole;
