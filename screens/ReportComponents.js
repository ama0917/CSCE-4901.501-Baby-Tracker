// ============================================================================
// IMPROVED SUMMARY CARDS COMPONENT
// ============================================================================

const EnhancedSummaryCard = ({ item, metric, activeTab, childAge, hasAIConsent }) => {
  const getTrendIcon = (trend) => {
    switch(trend) {
      case 'up': return 'trending-up';
      case 'down': return 'trending-down';
      default: return 'remove';
    }
  };

  const getTrendColor = (trend, metric) => {
    if (trend === 'stable') return '#888';
    if (metric === 'more') return trend === 'up' ? '#4CAF50' : '#F44336';
    if (metric === 'less') return trend === 'down' ? '#4CAF50' : '#F44336';
    return '#888';
  };

  const formatValue = (value, unit, key) => {
    if (key === 'mostCommon' && typeof value === 'string') return value;
    return `${value}${unit || ''}`;
  };

  const benchmarkColor = (avg, benchmark) => {
    if (!benchmark) return '#888';
    return parseFloat(avg) >= benchmark ? '#4CAF50' : '#FF9800';
  };

  // Get AI-based recommendation if enabled
  const aiRecommendation = hasAIConsent && childAge 
    ? getAgeBasedRecommendation(item.key, item.avg, childAge)
    : null;

  return (
    <View style={styles.enhancedSummaryCard}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardIconContainer}>
          <Ionicons 
            name={item.icon || "stats-chart"} 
            size={22} 
            color="#1976d2" 
          />
        </View>
        <View style={styles.cardLabelContainer}>
          <Text style={styles.cardLabel}>{item.label}</Text>
          {item.trend && item.trend !== 'stable' && (
            <View style={styles.trendPill}>
              <AntDesign 
                name={getTrendIcon(item.trend)}
                size={10}
                color={getTrendColor(item.trend, item.metric)}
              />
              <Text style={[
                styles.trendPillText,
                { color: getTrendColor(item.trend, item.metric) }
              ]}>
                {item.trend === 'up' ? 'Increasing' : 'Decreasing'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.cardValueSection}>
        <Text style={styles.cardValue}>
          {formatValue(item.avg, item.unit, item.key)}
        </Text>
        {item.benchmark && (
          <Text style={[
            styles.benchmarkLabel,
            { color: benchmarkColor(item.avg, item.benchmark) }
          ]}>
            Target: {item.benchmark}{item.unit || ''}/day
          </Text>
        )}
      </View>

      {/* AI Recommendation Badge */}
      {aiRecommendation && (
        <View style={[
          styles.aiRecommendationBadge,
          { 
            backgroundColor: aiRecommendation.color + '15',
            borderLeftColor: aiRecommendation.color
          }
        ]}>
          <Ionicons 
            name={aiRecommendation.icon} 
            size={14} 
            color={aiRecommendation.color} 
          />
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text style={[styles.aiRecommendationText, { color: aiRecommendation.color }]}>
              {aiRecommendation.message}
            </Text>
            {aiRecommendation.advice && (
              <Text style={styles.aiRecommendationAdvice}>
                {aiRecommendation.advice}
              </Text>
            )}
          </View>
        </View>
      )}

      {item.details && !aiRecommendation && (
        <Text style={styles.cardDetails}>
          {item.details}
        </Text>
      )}
    </View>
  );
};

// ============================================================================
// ENHANCED METRICS DISPLAY
// ============================================================================

const MetricsGrid = ({ data, activeTab }) => {
  if (!data.summary || data.summary.length === 0) {
    return null;
  }

  return (
    <View style={styles.metricsGridContainer}>
      {data.summary.map((item, index) => (
        <EnhancedSummaryCard 
          key={item.key || index} 
          item={item} 
          activeTab={activeTab}
        />
      ))}
    </View>
  );
};

// ============================================================================
// SLEEP-SPECIFIC SUMMARY
// ============================================================================

const SleepMetricsSummary = ({ data }) => {
  const totalSleep = data.summary?.find(s => s.key === 'total');
  const nightSleep = data.summary?.find(s => s.key === 'night');
  const naps = data.summary?.find(s => s.key === 'naps');
  const sessions = data.summary?.find(s => s.key === 'sessions');

  const getSleepQualityStatus = (avg, benchmark) => {
    const ratio = parseFloat(avg) / benchmark;
    if (ratio >= 0.95) return { status: 'Excellent', color: '#4CAF50', icon: 'checkmark-circle' };
    if (ratio >= 0.80) return { status: 'Good', color: '#8BC34A', icon: 'checkmark-circle-outline' };
    if (ratio >= 0.65) return { status: 'Fair', color: '#FF9800', icon: 'alert-circle' };
    return { status: 'Needs Attention', color: '#F44336', icon: 'alert-circle' };
  };

  const quality = totalSleep ? getSleepQualityStatus(totalSleep.avg, totalSleep.benchmark) : null;

  return (
    <View style={styles.metricsSummaryContainer}>
      {quality && (
        <View style={[styles.qualityStatusBanner, { backgroundColor: quality.color + '15', borderLeftColor: quality.color }]}>
          <Ionicons name={quality.icon} size={24} color={quality.color} />
          <View style={styles.qualityStatusText}>
            <Text style={[styles.qualityStatusLabel, { color: quality.color }]}>
              {quality.status}
            </Text>
            <Text style={styles.qualityStatusDescription}>
              {totalSleep?.avg || 0}hrs daily vs {totalSleep?.benchmark || 12}hrs recommended
            </Text>
          </View>
        </View>
      )}

      <View style={styles.sleepBreakdownContainer}>
        <View style={styles.sleepBreakdownItem}>
          <View style={styles.sleepBreakdownIcon}>
            <Ionicons name="moon" size={18} color="#1976d2" />
          </View>
          <View style={styles.sleepBreakdownInfo}>
            <Text style={styles.sleepBreakdownLabel}>Night Sleep</Text>
            <Text style={styles.sleepBreakdownValue}>{nightSleep?.avg || 0}hrs</Text>
          </View>
        </View>

        <View style={styles.sleepBreakdownItem}>
          <View style={styles.sleepBreakdownIcon}>
            <Ionicons name="partly-sunny" size={18} color="#FF9800" />
          </View>
          <View style={styles.sleepBreakdownInfo}>
            <Text style={styles.sleepBreakdownLabel}>Daytime Naps</Text>
            <Text style={styles.sleepBreakdownValue}>{naps?.avg || 0}hrs</Text>
          </View>
        </View>

        <View style={styles.sleepBreakdownItem}>
          <View style={styles.sleepBreakdownIcon}>
            <Ionicons name="repeat" size={18} color="#00BCD4" />
          </View>
          <View style={styles.sleepBreakdownInfo}>
            <Text style={styles.sleepBreakdownLabel}>Total Sessions</Text>
            <Text style={styles.sleepBreakdownValue}>{sessions?.avg || 0}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// FEEDING-SPECIFIC SUMMARY
// ============================================================================

const FeedingMetricsSummary = ({ data }) => {
  const perDay = data.summary?.find(s => s.key === 'perDay');
  const avgGap = data.summary?.find(s => s.key === 'avgGap');
  const avgAmount = data.summary?.find(s => s.key === 'avgAmount');
  const mostCommon = data.summary?.find(s => s.key === 'mostCommon');

  const getFeedingStatus = (perDay, avgGap) => {
    const gapHours = parseFloat(avgGap);
    if (gapHours >= 3 && gapHours <= 4 && parseFloat(perDay) >= 5) {
      return { status: 'Regular Pattern', color: '#4CAF50', icon: 'checkmark-circle' };
    }
    if (gapHours > 5) {
      return { status: 'Long Gaps', color: '#FF9800', icon: 'alert-circle' };
    }
    if (gapHours < 2.5) {
      return { status: 'Frequent Feedings', color: '#FF9800', icon: 'alert-circle' };
    }
    return { status: 'Normal Pattern', color: '#4CAF50', icon: 'checkmark-circle' };
  };

  const status = perDay && avgGap ? getFeedingStatus(perDay.avg, avgGap.avg) : null;

  return (
    <View style={styles.metricsSummaryContainer}>
      {status && (
        <View style={[styles.qualityStatusBanner, { backgroundColor: status.color + '15', borderLeftColor: status.color }]}>
          <Ionicons name={status.icon} size={24} color={status.color} />
          <View style={styles.qualityStatusText}>
            <Text style={[styles.qualityStatusLabel, { color: status.color }]}>
              {status.status}
            </Text>
            <Text style={styles.qualityStatusDescription}>
              {perDay?.avg || 0} feedings/day, avg {avgGap?.avg || 0}hrs apart
            </Text>
          </View>
        </View>
      )}

      <View style={styles.feedingDetailsContainer}>
        <View style={styles.feedingDetailRow}>
          <View style={styles.feedingDetailLabel}>
            <Ionicons name="restaurant" size={18} color="#FF9800" />
            <Text style={styles.feedingDetailText}>Per Day</Text>
          </View>
          <Text style={styles.feedingDetailValue}>{perDay?.avg || 0}</Text>
        </View>

        <View style={styles.feedingDetailRow}>
          <View style={styles.feedingDetailLabel}>
            <Ionicons name="time" size={18} color="#FF9800" />
            <Text style={styles.feedingDetailText}>Avg Gap</Text>
          </View>
          <Text style={styles.feedingDetailValue}>{avgGap?.avg || 0}hrs</Text>
        </View>

        <View style={styles.feedingDetailRow}>
          <View style={styles.feedingDetailLabel}>
            <Ionicons name="water" size={18} color="#FF9800" />
            <Text style={styles.feedingDetailText}>Avg Amount</Text>
          </View>
          <Text style={styles.feedingDetailValue}>{avgAmount?.avg || 0}ml</Text>
        </View>

        <View style={styles.feedingDetailRow}>
          <View style={styles.feedingDetailLabel}>
            <Ionicons name="alarm" size={18} color="#FF9800" />
            <Text style={styles.feedingDetailText}>Common Time</Text>
          </View>
          <Text style={styles.feedingDetailValue}>{mostCommon?.avg || 'N/A'}</Text>
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// DIAPER-SPECIFIC SUMMARY
// ============================================================================

const DiaperMetricsSummary = ({ data, wetPerDay, bmPerDay }) => {
  const totalChanges = data.summary?.find(s => s.key === 'total');
  const wetDiapers = data.summary?.find(s => s.key === 'wet');
  const bmDiapers = data.summary?.find(s => s.key === 'bm');

  const getHydrationStatus = (wet) => {
    const wetVal = parseFloat(wet);
    if (wetVal >= 5) return { status: 'Well Hydrated', color: '#4CAF50', icon: 'checkmark-circle' };
    if (wetVal >= 4) return { status: 'Adequate', color: '#8BC34A', icon: 'checkmark-circle-outline' };
    return { status: 'Low Hydration', color: '#F44336', icon: 'alert-circle' };
  };

  const getDigestionStatus = (bm) => {
    const bmVal = parseFloat(bm);
    if (bmVal >= 1 && bmVal <= 4) return { status: 'Normal', color: '#4CAF50' };
    if (bmVal > 4) return { status: 'Frequent', color: '#FF9800' };
    if (bmVal > 0) return { status: 'Low', color: '#FF9800' };
    return { status: 'Concern', color: '#F44336' };
  };

  const hydration = getHydrationStatus(wetDiapers?.avg || 0);
  const digestion = getDigestionStatus(bmDiapers?.avg || 0);

  return (
    <View style={styles.metricsSummaryContainer}>
      <View style={styles.diaperStatusRow}>
        <View style={[styles.diaperStatusCard, { borderLeftColor: hydration.color }]}>
          <View style={styles.diaperCardHeader}>
            <Ionicons name="water" size={20} color={hydration.color} />
            <Text style={styles.diaperCardTitle}>Hydration</Text>
          </View>
          <Text style={[styles.diaperStatusBadge, { color: hydration.color }]}>
            {hydration.status}
          </Text>
          <Text style={styles.diaperStatusValue}>
            {wetPerDay || wetDiapers?.avg || 0} wet/day
          </Text>
          <Text style={styles.diaperStatusNote}>
            Target: 5-7/day
          </Text>
        </View>

        <View style={[styles.diaperStatusCard, { borderLeftColor: digestion.color }]}>
          <View style={styles.diaperCardHeader}>
            <Ionicons name="medical" size={20} color={digestion.color} />
            <Text style={styles.diaperCardTitle}>Digestion</Text>
          </View>
          <Text style={[styles.diaperStatusBadge, { color: digestion.color }]}>
            {digestion.status}
          </Text>
          <Text style={styles.diaperStatusValue}>
            {bmPerDay || bmDiapers?.avg || 0} BM/day
          </Text>
          <Text style={styles.diaperStatusNote}>
            Age-dependent
          </Text>
        </View>
      </View>

      <View style={styles.diaperTotalContainer}>
        <Ionicons name="repeat" size={18} color="#00BCD4" />
        <View style={styles.diaperTotalInfo}>
          <Text style={styles.diaperTotalLabel}>Total Changes</Text>
          <Text style={styles.diaperTotalValue}>{totalChanges?.avg || 0}/day</Text>
        </View>
      </View>
    </View>
  );
};

const enhancedStyles = {
  metricsGridContainer: {
    marginBottom: 15,
    gap: 12,
  },
  enhancedSummaryCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
    marginBottom: 0,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardLabelContainer: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    gap: 4,
  },
  trendPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  cardValueSection: {
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#333',
  },
  benchmarkLabel: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  cardDetails: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Sleep Summary Styles
  metricsSummaryContainer: {
    marginBottom: 15,
  },
  qualityStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 12,
  },
  qualityStatusText: {
    marginLeft: 12,
    flex: 1,
  },
  qualityStatusLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  qualityStatusDescription: {
    fontSize: 12,
    color: '#666',
  },
  sleepBreakdownContainer: {
    gap: 10,
  },
  sleepBreakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sleepBreakdownIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sleepBreakdownInfo: {
    flex: 1,
  },
  sleepBreakdownLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 3,
  },
  sleepBreakdownValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },

  // Feeding Summary Styles
  feedingDetailsContainer: {
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  feedingDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  feedingDetailLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  feedingDetailText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  feedingDetailValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF9800',
  },

  // Diaper Summary Styles
  diaperStatusRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  diaperStatusCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  diaperCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  diaperCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  diaperStatusBadge: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  diaperStatusValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  diaperStatusNote: {
    fontSize: 11,
    color: '#999',
  },
  diaperTotalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f7fa',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#B3E5FC',
  },
  diaperTotalInfo: {
    marginLeft: 12,
    flex: 1,
  },
  diaperTotalLabel: {
    fontSize: 12,
    color: '#666',
  },
  diaperTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00BCD4',
  },
};

export {
  EnhancedSummaryCard,
  MetricsGrid,
  SleepMetricsSummary,
  FeedingMetricsSummary,
  DiaperMetricsSummary,
  enhancedStyles
};