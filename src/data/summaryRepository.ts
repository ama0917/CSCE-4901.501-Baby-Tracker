import { WeeklySummary } from '../ai/types';
import { db } from '../../firebaseConfig';
import { collection, addDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';

export const summaryRepository = {
  async saveSummary(childId: string, summary: Omit<WeeklySummary, 'id'>) : Promise<void> {
    const colRef = collection(db, 'children', childId, 'summaries');
    // Ensure generatedAt exists
    const payload = { ...summary, generatedAt: summary.generatedAt || new Date().toISOString() } as any;
    await addDoc(colRef, payload);
  },

  async getLatestSummary(childId: string): Promise<WeeklySummary | null> {
    const colRef = collection(db, 'children', childId, 'summaries');
    const q = query(colRef, orderBy('generatedAt', 'desc'), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...(doc.data() as any) } as WeeklySummary;
  }
};
