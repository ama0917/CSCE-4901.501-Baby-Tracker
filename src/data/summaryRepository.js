const { db } = require('../../firebaseConfig');
const { collection, query, orderBy, limit, getDocs } = require('firebase/firestore');

const summaryRepository = {
  async getLatestSummary(childId) {
    const colRef = collection(db, 'children', childId, 'summaries');
    const q = query(colRef, orderBy('generatedAt', 'desc'), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...(doc.data()) };
  }
};

module.exports = { summaryRepository };
