import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useWeeklySummary } from '../hooks/useWeeklySummary';

export default function WeeklySummaryCard({childId, childName}: {childId: string; childName?: string}) {
  const { summary, loading, refresh } = useWeeklySummary(childId);

  const renderMetrics = () => {
    if (!summary || !summary.metrics) return null;
    const m = summary.metrics;
    return (
      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{m.avgBottleMl ?? '—'}</Text>
          <Text style={styles.metricLabel}>Avg bottle ml</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{m.avgFeedCount}</Text>
          <Text style={styles.metricLabel}>Feeds/day</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{m.avgSleepHours ?? '—'}</Text>
          <Text style={styles.metricLabel}>Avg sleep hrs</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{m.totalDiapers}</Text>
          <Text style={styles.metricLabel}>Diapers</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{childName || 'Child'}</Text>
        <Text style={styles.subtitle}>Weekly Summary</Text>
      </View>

      <View style={styles.card}>
        {loading && (
          <View style={styles.center}><ActivityIndicator size="small" /></View>
        )}

        {!loading && !summary && (
          <View style={styles.center}><Text style={styles.empty}>Add more logs this week to see your summary.</Text></View>
        )}

        {!loading && summary && (
          <>
            {summary.text ? <Text style={styles.text}>{summary.text}</Text> : <Text style={styles.text}>No summary text available.</Text>}

            {renderMetrics()}

            <View style={styles.metaRow}>
              <Text style={styles.generated}>Generated: {summary.generatedAt ? new Date(summary.generatedAt).toLocaleDateString() : '—'}</Text>
              <TouchableOpacity onPress={() => refresh()}>
                <Text style={styles.refresh}>Refresh</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 12, paddingHorizontal: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 12, color: '#666' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  center: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  empty: { color: '#888' },
  text: { color: '#222', lineHeight: 20 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  metricItem: { alignItems: 'center', flex: 1 },
  metricValue: { fontSize: 16, fontWeight: '700', color: '#222' },
  metricLabel: { fontSize: 11, color: '#666' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  generated: { color: '#888', fontSize: 12 },
  refresh: { color: '#007AFF', fontSize: 13 }
});

