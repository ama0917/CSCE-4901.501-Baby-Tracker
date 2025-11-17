import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const OverviewAIControls = ({ 
  hasAIConsent, 
  onRefresh, 
  onShowConsent, 
  onRevokeConsent,
  isLoading,
  darkMode 
}) => {
  return (
    <View style={[
      styles.controlsContainer,
      { backgroundColor: darkMode ? '#2a2a2a' : '#fff' }
    ]}>
      {!hasAIConsent ? (
        <TouchableOpacity 
          style={styles.enableButton}
          onPress={onShowConsent}
        >
          <Ionicons name="lock-closed-outline" size={16} color="#FFF" />
          <Text style={styles.enableButtonText}>Enable AI Insights</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.activeControlsRow}>
          <TouchableOpacity 
            onPress={onRefresh} 
            style={[styles.iconButton, isLoading && styles.iconButtonDisabled]}
            disabled={isLoading}
          >
            <Ionicons 
              name="refresh" 
              size={20} 
              color={isLoading ? '#ccc' : '#1976d2'} 
            />
            <Text style={[
              styles.iconButtonText,
              { color: isLoading ? '#ccc' : '#1976d2' }
            ]}>
              Refresh
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={onRevokeConsent} 
            style={[styles.iconButton, { backgroundColor: darkMode ? '#3a3a3a' : '#ffebee' }]}
          >
            <Ionicons name="lock-closed" size={18} color="#f44336" />
            <Text style={[styles.iconButtonText, { color: '#f44336' }]}>
              Revoke Access
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  controlsContainer: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  enableButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  activeControlsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    gap: 6,
  },
  iconButtonDisabled: {
    opacity: 0.5,
  },
  iconButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default OverviewAIControls;