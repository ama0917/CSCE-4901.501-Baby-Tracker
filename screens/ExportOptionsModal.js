import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator
} from 'react-native';
import { Ionicons, AntDesign, FontAwesome5 } from '@expo/vector-icons';

const ExportOptionsModal = ({ 
  visible, 
  onClose, 
  onExport, 
  darkMode, 
  theme,
  hasAIConsent,
  aiSummaries 
}) => {
  const [exportFormat, setExportFormat] = useState('pdf'); // 'pdf' or 'excel'
  const [timeRange, setTimeRange] = useState('weekly'); // 'weekly', 'monthly', 'annual'
  const [includeCategories, setIncludeCategories] = useState({
    sleep: true,
    feeding: true,
    diaper: true,
  });
  const [includeAIInsights, setIncludeAIInsights] = useState(hasAIConsent);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    
    const options = {
      format: exportFormat,
      timeRange,
      categories: includeCategories,
      includeAI: includeAIInsights && hasAIConsent,
      aiSummaries: includeAIInsights && hasAIConsent ? aiSummaries : null,
    };
    
    try {
      await onExport(options);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
      onClose();
    }
  };

  const toggleCategory = (category) => {
    setIncludeCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const atLeastOneCategory = Object.values(includeCategories).some(v => v);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[
          styles.modalContainer,
          { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }
        ]}>
          {/* Header */}
          <View style={[
            styles.modalHeader,
            { borderBottomColor: darkMode ? '#333' : '#e0e0e0' }
          ]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Export Report Options
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Export Format Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                Export Format
              </Text>
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={[
                    styles.formatOption,
                    exportFormat === 'pdf' && styles.formatOptionActive,
                    { 
                      backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8',
                      borderColor: exportFormat === 'pdf' ? '#1976d2' : 'transparent'
                    }
                  ]}
                  onPress={() => setExportFormat('pdf')}
                >
                  <AntDesign 
                    name="file-pdf" 
                    size={32} 
                    color={exportFormat === 'pdf' ? '#E53935' : theme.textSecondary} 
                  />
                  <Text style={[
                    styles.formatText,
                    { color: exportFormat === 'pdf' ? theme.textPrimary : theme.textSecondary }
                  ]}>
                    PDF
                  </Text>
                  {exportFormat === 'pdf' && (
                    <Ionicons 
                      name="checkmark-circle" 
                      size={20} 
                      color="#1976d2" 
                      style={styles.checkmark}
                    />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.formatOption,
                    exportFormat === 'excel' && styles.formatOptionActive,
                    { 
                      backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8',
                      borderColor: exportFormat === 'excel' ? '#1976d2' : 'transparent'
                    }
                  ]}
                  onPress={() => setExportFormat('excel')}
                >
                  <FontAwesome5 
                    name="file-excel" 
                    size={32} 
                    color={exportFormat === 'excel' ? '#2E7D32' : theme.textSecondary} 
                  />
                  <Text style={[
                    styles.formatText,
                    { color: exportFormat === 'excel' ? theme.textPrimary : theme.textSecondary }
                  ]}>
                    Excel
                  </Text>
                  {exportFormat === 'excel' && (
                    <Ionicons 
                      name="checkmark-circle" 
                      size={20} 
                      color="#1976d2" 
                      style={styles.checkmark}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Time Range Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                Time Period
              </Text>
              <View style={styles.timeRangeContainer}>
                {['weekly', 'monthly', 'annual'].map((range) => (
                  <TouchableOpacity
                    key={range}
                    style={[
                      styles.timeRangeOption,
                      timeRange === range && styles.timeRangeActive,
                      { 
                        backgroundColor: darkMode ? '#2a2a2a' : '#f8f8f8',
                        borderColor: timeRange === range ? '#1976d2' : 'transparent'
                      }
                    ]}
                    onPress={() => setTimeRange(range)}
                  >
                    <Text style={[
                      styles.timeRangeText,
                      { color: timeRange === range ? '#1976d2' : theme.textSecondary }
                    ]}>
                      {range.charAt(0).toUpperCase() + range.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Categories Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                Include Data Categories
              </Text>
              
              <TouchableOpacity
                style={[
                  styles.categoryRow,
                  { borderBottomColor: darkMode ? '#333' : '#f0f0f0' }
                ]}
                onPress={() => toggleCategory('sleep')}
              >
                <View style={styles.categoryLeft}>
                  <Ionicons name="bed" size={20} color="#1976d2" />
                  <Text style={[styles.categoryText, { color: theme.textPrimary }]}>
                    Sleep Data
                  </Text>
                </View>
                <Switch
                  value={includeCategories.sleep}
                  onValueChange={() => toggleCategory('sleep')}
                  trackColor={{ false: '#767577', true: '#81b0ff' }}
                  thumbColor={includeCategories.sleep ? '#1976d2' : '#f4f3f4'}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.categoryRow,
                  { borderBottomColor: darkMode ? '#333' : '#f0f0f0' }
                ]}
                onPress={() => toggleCategory('feeding')}
              >
                <View style={styles.categoryLeft}>
                  <Ionicons name="restaurant" size={20} color="#FF9800" />
                  <Text style={[styles.categoryText, { color: theme.textPrimary }]}>
                    Feeding Data
                  </Text>
                </View>
                <Switch
                  value={includeCategories.feeding}
                  onValueChange={() => toggleCategory('feeding')}
                  trackColor={{ false: '#767577', true: '#ffcc80' }}
                  thumbColor={includeCategories.feeding ? '#FF9800' : '#f4f3f4'}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.categoryRow}
                onPress={() => toggleCategory('diaper')}
              >
                <View style={styles.categoryLeft}>
                  <Ionicons name="water" size={20} color="#00BCD4" />
                  <Text style={[styles.categoryText, { color: theme.textPrimary }]}>
                    Diaper Data
                  </Text>
                </View>
                <Switch
                  value={includeCategories.diaper}
                  onValueChange={() => toggleCategory('diaper')}
                  trackColor={{ false: '#767577', true: '#80deea' }}
                  thumbColor={includeCategories.diaper ? '#00BCD4' : '#f4f3f4'}
                />
              </TouchableOpacity>
            </View>

            {/* AI Insights Section */}
            {hasAIConsent && (
              <View style={styles.section}>
                <View style={styles.aiHeader}>
                  <View style={styles.aiHeaderLeft}>
                    <Ionicons name="sparkles" size={20} color="#1976d2" />
                    <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginBottom: 0 }]}>
                      AI Insights
                    </Text>
                  </View>
                  <Switch
                    value={includeAIInsights}
                    onValueChange={setIncludeAIInsights}
                    trackColor={{ false: '#767577', true: '#81b0ff' }}
                    thumbColor={includeAIInsights ? '#1976d2' : '#f4f3f4'}
                  />
                </View>
                <Text style={[styles.aiDescription, { color: theme.textSecondary }]}>
                  Include AI-generated summaries, insights, and recommendations in the exported report.
                </Text>
              </View>
            )}

            {/* Warning if no categories selected */}
            {!atLeastOneCategory && (
              <View style={[
                styles.warningBox,
                { backgroundColor: darkMode ? '#4a3a1a' : '#FFF9C4' }
              ]}>
                <Ionicons name="warning" size={20} color="#F9A825" />
                <Text style={[styles.warningText, { color: darkMode ? '#FFC107' : '#F57F17' }]}>
                  Please select at least one data category to export.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[
            styles.modalFooter,
            { borderTopColor: darkMode ? '#333' : '#e0e0e0' }
          ]}>
            <TouchableOpacity
              style={[
                styles.cancelButton,
                { borderColor: darkMode ? '#404040' : '#ccc' }
              ]}
              onPress={onClose}
              disabled={isExporting}
            >
              <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.exportButton,
                (!atLeastOneCategory || isExporting) && styles.exportButtonDisabled
              ]}
              onPress={handleExport}
              disabled={!atLeastOneCategory || isExporting}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={20} color="#fff" />
                  <Text style={styles.exportButtonText}>
                    Export {exportFormat.toUpperCase()}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 5,
  },
  modalContent: {
    padding: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formatOption: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    position: 'relative',
  },
  formatOptionActive: {
    borderWidth: 2,
  },
  formatText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  timeRangeOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
  },
  timeRangeActive: {
    borderWidth: 2,
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryText: {
    fontSize: 15,
    fontWeight: '500',
  },
  aiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  exportButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#1976d2',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  exportButtonDisabled: {
    backgroundColor: '#ccc',
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default ExportOptionsModal;