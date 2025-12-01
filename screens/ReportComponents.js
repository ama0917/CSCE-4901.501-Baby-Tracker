import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AntDesign } from '@expo/vector-icons';

const EnhancedSummaryCard = ({ item, metric, activeTab, childAge, hasAIConsent, darkMode, theme }) => {
  const getTrendIcon = (trend) => {
    switch(trend) {
      case 'up': return 'trending-up';
      case 'down': return 'trending-down';
      default: return 'remove';
    }
  };

  const getTrendColor = (trend, metric) => {
    if (trend === 'stable') return darkMode ? '#999' : '#888';
    if (metric === 'more') return trend === 'up' ? '#4CAF50' : '#F44336';
    if (metric === 'less') return trend === 'down' ? '#4CAF50' : '#F44336';
    return darkMode ? '#999' : '#888';
  };

  const formatValue = (value, unit, key) => {
    if (key === 'mostCommon' && typeof value === 'string') return value;
    return `${value}${unit || ''}`;
  };

  const benchmarkColor = (avg, benchmark) => {
    if (!benchmark) return darkMode ? '#999' : '#888';
    return parseFloat(avg) >= benchmark ? '#4CAF50' : '#FF9800';
  };

  // Get AI-based recommendation if enabled
  const getAgeBasedRecommendation = (metric, value, ageInMonths) => {
    // This function should be passed from parent or defined here
    // For now, returning null
    return null;
  };

  const aiRecommendation = hasAIConsent && childAge 
    ? getAgeBasedRecommendation(item.key, item.avg, childAge)
    : null;

  return (
    <View style={[
      enhancedStyles.enhancedSummaryCard,
      { 
        backgroundColor: darkMode ? '#2a2a2a' : '#f8f9fa',
        borderLeftColor: darkMode ? '#64b5f6' : '#1976d2'
      }
    ]}>
      <View style={enhancedStyles.cardTopRow}>
        <View style={[
          enhancedStyles.cardIconContainer,
          { backgroundColor: darkMode ? '#1a3a52' : '#E3F2FD' }
        ]}>
          <Ionicons 
            name={item.icon || "stats-chart"} 
            size={22} 
            color={darkMode ? '#64b5f6' : '#1976d2'} 
          />
        </View>
        <View style={enhancedStyles.cardLabelContainer}>
          <Text style={[enhancedStyles.cardLabel, { color: theme.textSecondary }]}>
            {item.label}
          </Text>
          {item.trend && item.trend !== 'stable' && (
            <View style={[
              enhancedStyles.trendPill,
              { backgroundColor: darkMode ? '#333' : '#f0f0f0' }
            ]}>
              <AntDesign 
                name={getTrendIcon(item.trend)}
                size={10}
                color={getTrendColor(item.trend, item.metric)}
              />
              <Text style={[
                enhancedStyles.trendPillText,
                { color: getTrendColor(item.trend, item.metric) }
              ]}>
                {item.trend === 'up' ? 'Increasing' : 'Decreasing'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={enhancedStyles.cardValueSection}>
        <Text style={[enhancedStyles.cardValue, { color: theme.textPrimary }]}>
          {formatValue(item.avg, item.unit, item.key)}
        </Text>
        {item.benchmark && (
          <Text style={[
            enhancedStyles.benchmarkLabel,
            { color: benchmarkColor(item.avg, item.benchmark) }
          ]}>
            Target: {item.benchmark}{item.unit || ''}/day
          </Text>
        )}
      </View>

      {/* AI Recommendation Badge */}
      {aiRecommendation && (
        <View style={[
          enhancedStyles.aiRecommendationBadge,
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
            <Text style={[enhancedStyles.aiRecommendationText, { color: aiRecommendation.color }]}>
              {aiRecommendation.message}
            </Text>
            {aiRecommendation.advice && (
              <Text style={[
                enhancedStyles.aiRecommendationAdvice,
                { color: darkMode ? '#aaa' : '#666' }
              ]}>
                {aiRecommendation.advice}
              </Text>
            )}
          </View>
        </View>
      )}

      {item.details && !aiRecommendation && (
        <Text style={[enhancedStyles.cardDetails, { color: theme.textSecondary }]}>
          {item.details}
        </Text>
      )}
    </View>
  );
};

// ============================================================================
// ENHANCED METRICS DISPLAY
// ============================================================================

const MetricsGrid = ({ data, activeTab, darkMode, theme, hasAIConsent, childAge }) => {
  if (!data.summary || data.summary.length === 0) {
    return null;
  }

  return (
    <View style={enhancedStyles.metricsGridContainer}>
      {data.summary.map((item, index) => (
        <EnhancedSummaryCard 
          key={item.key || index} 
          item={item} 
          activeTab={activeTab}
          darkMode={darkMode}
          theme={theme}
          hasAIConsent={hasAIConsent}
          childAge={childAge}
        />
      ))}
    </View>
  );
};

// ============================================================================
// SLEEP-SPECIFIC SUMMARY
// ============================================================================

const SleepMetricsSummary = ({ data, darkMode, theme }) => {
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
    <View style={enhancedStyles.metricsSummaryContainer}>
      {quality && (
        <View style={[
          enhancedStyles.qualityStatusBanner, 
          { 
            backgroundColor: quality.color + (darkMode ? '25' : '15'),
            borderLeftColor: quality.color 
          }
        ]}>
          <Ionicons name={quality.icon} size={24} color={quality.color} />
          <View style={enhancedStyles.qualityStatusText}>
            <Text style={[enhancedStyles.qualityStatusLabel, { color: quality.color }]}>
              {quality.status}
            </Text>
            <Text style={[
              enhancedStyles.qualityStatusDescription,
              { color: darkMode ? '#bbb' : '#666' }
            ]}>
              {totalSleep?.avg || 0}{totalSleep?.unit || 'hrs'} daily vs {totalSleep?.benchmark || 12}hrs recommended
            </Text>
          </View>
        </View>
      )}

      <View style={[
        enhancedStyles.sleepBreakdownContainer,
        { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }
      ]}>
        <View style={[
          enhancedStyles.sleepBreakdownItem,
          {
            backgroundColor: darkMode ? '#2a2a2a' : '#fff',
            borderColor: darkMode ? '#404040' : '#e0e0e0'
          }
        ]}>
          <View style={[
            enhancedStyles.sleepBreakdownIcon,
            { backgroundColor: darkMode ? '#1a3a52' : '#f0f0f0' }
          ]}>
            <Ionicons name="moon" size={18} color={darkMode ? '#64b5f6' : '#1976d2'} />
          </View>
          <View style={enhancedStyles.sleepBreakdownInfo}>
            <Text style={[
              enhancedStyles.sleepBreakdownLabel,
              { color: darkMode ? '#999' : '#999' }
            ]}>
              Night Sleep
            </Text>
            <Text style={[
              enhancedStyles.sleepBreakdownValue,
              { color: darkMode ? '#fff' : '#333' }
            ]}>
              {nightSleep?.avg || 0}{nightSleep?.unit || 'hrs'}
            </Text>
          </View>
        </View>

        <View style={[
          enhancedStyles.sleepBreakdownItem,
          {
            backgroundColor: darkMode ? '#2a2a2a' : '#fff',
            borderColor: darkMode ? '#404040' : '#e0e0e0'
          }
        ]}>
          <View style={[
            enhancedStyles.sleepBreakdownIcon,
            { backgroundColor: darkMode ? '#4a3a1a' : '#f0f0f0' }
          ]}>
            <Ionicons name="partly-sunny" size={18} color="#FF9800" />
          </View>
          <View style={enhancedStyles.sleepBreakdownInfo}>
            <Text style={[
              enhancedStyles.sleepBreakdownLabel,
              { color: darkMode ? '#999' : '#999' }
            ]}>
              Daytime Naps
            </Text>
            <Text style={[
              enhancedStyles.sleepBreakdownValue,
              { color: darkMode ? '#fff' : '#333' }
            ]}>
              {naps?.avg || 0}{naps?.unit || 'hrs'}
            </Text>
          </View>
        </View>

        <View style={[
          enhancedStyles.sleepBreakdownItem,
          {
            backgroundColor: darkMode ? '#2a2a2a' : '#fff',
            borderColor: darkMode ? '#404040' : '#e0e0e0'
          }
        ]}>
          <View style={[
            enhancedStyles.sleepBreakdownIcon,
            { backgroundColor: darkMode ? '#1a4a4a' : '#f0f0f0' }
          ]}>
            <Ionicons name="repeat" size={18} color="#00BCD4" />
          </View>
          <View style={enhancedStyles.sleepBreakdownInfo}>
            <Text style={[
              enhancedStyles.sleepBreakdownLabel,
              { color: darkMode ? '#999' : '#999' }
            ]}>
              Total Sessions
            </Text>
            <Text style={[
              enhancedStyles.sleepBreakdownValue,
              { color: darkMode ? '#fff' : '#333' }
            ]}>
              {sessions?.avg || 0}{sessions?.unit || ''}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// FEEDING-SPECIFIC SUMMARY
// ============================================================================

const FeedingMetricsSummary = ({ data, darkMode, theme }) => {
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
    <View style={enhancedStyles.metricsSummaryContainer}>
      {status && (
        <View style={[
          enhancedStyles.qualityStatusBanner, 
          { 
            backgroundColor: status.color + (darkMode ? '25' : '15'),
            borderLeftColor: status.color 
          }
        ]}>
          <Ionicons name={status.icon} size={24} color={status.color} />
          <View style={enhancedStyles.qualityStatusText}>
            <Text style={[enhancedStyles.qualityStatusLabel, { color: status.color }]}>
              {status.status}
            </Text>
            <Text style={[
              enhancedStyles.qualityStatusDescription,
              { color: darkMode ? '#bbb' : '#666' }
            ]}>
              {perDay?.avg || 0} feedings/day, avg {avgGap?.avg || 0}hrs apart
            </Text>
          </View>
        </View>
      )}

      <View style={[
        enhancedStyles.feedingDetailsContainer,
        { 
          backgroundColor: darkMode ? '#1f1f1f' : '#fff',
          borderColor: darkMode ? '#404040' : '#e0e0e0'
        }
      ]}>
        <View style={[
          enhancedStyles.feedingDetailRow,
          { borderBottomColor: darkMode ? '#333' : '#f0f0f0' }
        ]}>
          <View style={enhancedStyles.feedingDetailLabel}>
            <Ionicons name="restaurant" size={18} color="#FF9800" />
            <Text style={[
              enhancedStyles.feedingDetailText,
              { color: darkMode ? '#e0e0e0' : '#666' }
            ]}>
              Per Day
            </Text>
          </View>
          <Text style={[
            enhancedStyles.feedingDetailValue,
            { color: darkMode ? '#FFA726' : '#FF9800' }
          ]}>
            {perDay?.avg || 0} feedings
          </Text>
        </View>

        <View style={[
          enhancedStyles.feedingDetailRow,
          { borderBottomColor: darkMode ? '#333' : '#f0f0f0' }
        ]}>
          <View style={enhancedStyles.feedingDetailLabel}>
            <Ionicons name="time" size={18} color="#FF9800" />
            <Text style={[
              enhancedStyles.feedingDetailText,
              { color: darkMode ? '#e0e0e0' : '#666' }
            ]}>
              Avg Gap
            </Text>
          </View>
          <Text style={[
            enhancedStyles.feedingDetailValue,
            { color: darkMode ? '#FFA726' : '#FF9800' }
          ]}>
            {avgGap?.avg || 0}hrs
          </Text>
        </View>

        <View style={[
          enhancedStyles.feedingDetailRow,
          { borderBottomWidth: 0 }
        ]}>
          <View style={enhancedStyles.feedingDetailLabel}>
            <Ionicons name="alarm" size={18} color="#FF9800" />
            <Text style={[
              enhancedStyles.feedingDetailText,
              { color: darkMode ? '#e0e0e0' : '#666' }
            ]}>
              Common Time
            </Text>
          </View>
          <Text style={[
            enhancedStyles.feedingDetailValue,
            { color: darkMode ? '#FFA726' : '#FF9800' }
          ]}>
            {mostCommon?.avg || 'N/A'}
          </Text>
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// DIAPER-SPECIFIC SUMMARY
// ============================================================================

const DiaperMetricsSummary = ({ data, wetPerDay, bmPerDay, darkMode, theme }) => {
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
    <View style={enhancedStyles.metricsSummaryContainer}>
      <View style={enhancedStyles.diaperStatusRow}>
        <View style={[
          enhancedStyles.diaperStatusCard, 
          { 
            borderLeftColor: hydration.color,
            backgroundColor: darkMode ? '#2a2a2a' : '#fff',
            borderColor: darkMode ? '#404040' : '#e0e0e0'
          }
        ]}>
          <View style={enhancedStyles.diaperCardHeader}>
            <Ionicons name="water" size={20} color={hydration.color} />
            <Text style={[enhancedStyles.diaperCardTitle, { color: theme.textPrimary }]}>
              Hydration
            </Text>
          </View>
          <Text style={[enhancedStyles.diaperStatusBadge, { color: hydration.color }]}>
            {hydration.status}
          </Text>
          <Text style={[enhancedStyles.diaperStatusValue, { color: theme.textPrimary }]}>
            {wetPerDay || wetDiapers?.avg || 0} wet/day
          </Text>
          <Text style={[enhancedStyles.diaperStatusNote, { color: darkMode ? '#aaa' : '#999' }]}>
            Target: 5-7/day
          </Text>
        </View>

        <View style={[
          enhancedStyles.diaperStatusCard, 
          { 
            borderLeftColor: digestion.color,
            backgroundColor: darkMode ? '#2a2a2a' : '#fff',
            borderColor: darkMode ? '#404040' : '#e0e0e0'
          }
        ]}>
          <View style={enhancedStyles.diaperCardHeader}>
            <Ionicons name="medical" size={20} color={digestion.color} />
            <Text style={[enhancedStyles.diaperCardTitle, { color: theme.textPrimary }]}>
              Digestion
            </Text>
          </View>
          <Text style={[enhancedStyles.diaperStatusBadge, { color: digestion.color }]}>
            {digestion.status}
          </Text>
          <Text style={[enhancedStyles.diaperStatusValue, { color: theme.textPrimary }]}>
            {bmPerDay || bmDiapers?.avg || 0} BM/day
          </Text>
          <Text style={[enhancedStyles.diaperStatusNote, { color: theme.textPrimary }]}>
            Age-dependent
          </Text>
        </View>
      </View>

      <View style={[
        enhancedStyles.diaperTotalContainer,
        {
          backgroundColor: darkMode ? '#1a4a4a' : '#f0f7fa',
          borderColor: darkMode ? '#2a6a6a' : '#B3E5FC'
        }
      ]}>
        <Ionicons name="repeat" size={18} color="#00BCD4" />
        <View style={enhancedStyles.diaperTotalInfo}>
          <Text style={[enhancedStyles.diaperTotalLabel, { color: darkMode ? '#bbb' : '#666' }]}>
            Total Changes
          </Text>
          <Text style={[enhancedStyles.diaperTotalValue, { color: '#00BCD4' }]}>
            {totalChanges?.avg || 0}/day
          </Text>
        </View>
      </View>
    </View>
  );
};

const enhancedStyles = StyleSheet.create({
  metricsGridContainer: {
    marginBottom: 15,
    gap: 12,
  },
  enhancedSummaryCard: {
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
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
    marginBottom: 4,
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
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
  },
  benchmarkLabel: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  cardDetails: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  aiRecommendationBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    marginTop: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  aiRecommendationText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
  },
  aiRecommendationAdvice: {
    fontSize: 11,
    fontStyle: 'italic',
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
  },
  sleepBreakdownContainer: {
    gap: 10,
  },
  sleepBreakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
  },
  sleepBreakdownIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sleepBreakdownInfo: {
    flex: 1,
  },
  sleepBreakdownLabel: {
    fontSize: 12,
    marginBottom: 3,
  },
  sleepBreakdownValue: {
    fontSize: 18,
    fontWeight: '700',
  },

  // Feeding Summary Styles
  feedingDetailsContainer: {
    gap: 10,
    borderRadius: 10,
    padding: 12,
  },
  feedingDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  feedingDetailLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  feedingDetailText: {
    fontSize: 13,
    fontWeight: '500',
  },
  feedingDetailValue: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Diaper Summary Styles
  diaperStatusRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  diaperStatusCard: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
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
  },
  diaperStatusBadge: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  diaperStatusValue: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  diaperStatusNote: {
    fontSize: 11,
  },
  diaperTotalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
  },
  diaperTotalInfo: {
    marginLeft: 12,
    flex: 1,
  },
  diaperTotalLabel: {
    fontSize: 12,
  },
  diaperTotalValue: {
    fontSize: 18,
    fontWeight: '700',
  },
});

export {
  EnhancedSummaryCard,
  MetricsGrid,
  SleepMetricsSummary,
  FeedingMetricsSummary,
  DiaperMetricsSummary,
  enhancedStyles
};