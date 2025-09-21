import { useEffect, useState, useCallback } from 'react';
import { WeeklySummary } from '../ai/types';
import { summaryRepository } from '../data/summaryRepository';
import { generateSummaryClient } from '../ai/summarizerService';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

const FRESH_MS = 24 * 60 * 60 * 1000; // 24 hours

export function useWeeklySummary(childId: string | null) {
  const [summary, setSummary] = useState(null as WeeklySummary | null);
  const [loading, setLoading] = useState(false);

  const fetchAndMaybeGenerate = useCallback(async (force = false) => {
    if (!childId) return;
    setLoading(true);
    try {
      const cached = await summaryRepository.getLatestSummary(childId);
      const now = Date.now();
      if (!force && cached) {
        const gen = new Date(cached.generatedAt).getTime();
        if (now - gen < FRESH_MS) {
          setSummary(cached);
          setLoading(false);
          return;
        }
      }

      // Need to generate: fetch last 7 days of logs
      const end = new Date();
      end.setHours(23,59,59,999);
      const start = new Date();
      start.setDate(end.getDate() - 6);
      start.setHours(0,0,0,0);

      const startTs = Timestamp.fromDate(start);
      const endTs = Timestamp.fromDate(end);

      // fetch feedLogs, sleepLogs, diaperLogs in parallel
      const feedQ = query(collection(db, 'feedLogs'), where('childId', '==', childId), where('timestamp', '>=', startTs), where('timestamp', '<=', endTs));
      const sleepQ = query(collection(db, 'sleepLogs'), where('childId', '==', childId), where('timestamp', '>=', startTs), where('timestamp', '<=', endTs));
      const diaperQ = query(collection(db, 'diaperLogs'), where('childId', '==', childId), where('time', '>=', startTs), where('time', '<=', endTs));

      const [feedSnap, sleepSnap, diaperSnap] = await Promise.all([getDocs(feedQ), getDocs(sleepQ), getDocs(diaperQ)]);

      const feeds: any[] = [];
      feedSnap.forEach(d => feeds.push({id: d.id, ...d.data()}));
      const sleeps: any[] = [];
      sleepSnap.forEach(d => sleeps.push({id: d.id, ...d.data()}));
      const diapers: any[] = [];
      diaperSnap.forEach(d => diapers.push({id: d.id, ...d.data()}));

      const totalLogs = feeds.length + sleeps.length + diapers.length;
      if (totalLogs < 3) {
        // Not enough data
        setSummary(null);
        setLoading(false);
        return;
      }

      const { text, metrics } = await generateSummaryClient({feeds, sleeps, diapers});

      const newSummary = {
        childId,
        text,
        metrics,
        generatedAt: new Date().toISOString(),
      } as WeeklySummary;

      // Save to Firestore (async) but wait for write to finish to ensure caching
      await summaryRepository.saveSummary(childId, newSummary);
      // Retrieve latest saved with id
      const fresh = await summaryRepository.getLatestSummary(childId);
      setSummary(fresh);
    } catch (e) {
      console.error('useWeeklySummary error', e);
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    if (!childId) return;
    fetchAndMaybeGenerate(false);
  }, [childId, fetchAndMaybeGenerate]);

  return { summary, loading, refresh: () => fetchAndMaybeGenerate(true) };
}
