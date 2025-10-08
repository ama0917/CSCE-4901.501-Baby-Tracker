import { useState, useEffect } from 'react';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app } from '../firebaseConfig';

const db = getFirestore(app);

/**
 * Hook to determine user's permissions for a specific child
 * Returns: { isOwner, canView, canLog, canViewReports, isLoading }
 */
export default function useChildPermissions(childId) {
  const [permissions, setPermissions] = useState({
    isOwner: false,
    canView: false,
    canLog: false,
    canViewReports: false,
    isLoading: true,
  });

  useEffect(() => {
    if (!childId) {
      setPermissions({
        isOwner: false,
        canView: false,
        canLog: false,
        canViewReports: false,
        isLoading: false,
      });
      return;
    }

    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      setPermissions({
        isOwner: false,
        canView: false,
        canLog: false,
        canViewReports: false,
        isLoading: false,
      });
      return;
    }

    const uid = currentUser.uid;
    const childRef = doc(db, 'children', childId);

    const unsubscribe = onSnapshot(
      childRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setPermissions({
            isOwner: false,
            canView: false,
            canLog: false,
            canViewReports: false,
            isLoading: false,
          });
          return;
        }

        const childData = snapshot.data();
        const isOwner = childData.userId === uid;
        const caregiverPerm = childData.caregiverPerms?.[uid]; // 'on', 'log', or undefined

        // Determine permissions
        const canView = isOwner || caregiverPerm === 'on' || caregiverPerm === 'log';
        const canLog = isOwner || caregiverPerm === 'on' || caregiverPerm === 'log';
        const canViewReports = isOwner; // Only owners can view reports

        setPermissions({
          isOwner,
          canView,
          canLog,
          canViewReports,
          isLoading: false,
        });
      },
      (error) => {
        console.error('Error fetching child permissions:', error);
        setPermissions({
          isOwner: false,
          canView: false,
          canLog: false,
          canViewReports: false,
          isLoading: false,
        });
      }
    );

    return () => unsubscribe();
  }, [childId]);

  return permissions;
}