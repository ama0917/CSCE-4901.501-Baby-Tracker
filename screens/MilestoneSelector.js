import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, TextInput,
  KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

const COMMON_MILESTONES = [
  { id: 'first_smile', label: 'First Smile', icon: 'emoticon-happy' },
  { id: 'first_laugh', label: 'First Laugh', icon: 'emoticon-lol' },
  { id: 'first_words', label: 'First Words', icon: 'comment-text' },
  { id: 'first_steps', label: 'First Steps', icon: 'walk' },
  { id: 'first_tooth', label: 'First Tooth', icon: 'tooth' },
  { id: 'rolling_over', label: 'Rolling Over', icon: 'rotate-3d-variant' },
  { id: 'sitting_up', label: 'Sitting Up', icon: 'seat' },
  { id: 'crawling', label: 'Crawling', icon: 'baby-carriage' },
  { id: 'standing', label: 'Standing', icon: 'human-handsup' },
  { id: 'first_food', label: 'First Solid Food', icon: 'food-apple' },
  { id: 'potty_trained', label: 'Potty Trained', icon: 'toilet' },
  { id: 'first_day_school', label: 'First Day of School', icon: 'school' },
  { id: 'birthday', label: 'Birthday', icon: 'cake-variant' },
  { id: 'custom', label: 'Custom Milestone', icon: 'star' },
];

const MilestoneSelector = ({ visible, onClose, onSelect, darkMode }) => {
  const [customMilestone, setCustomMilestone] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleSelect = (milestone) => {
    if (milestone.id === 'custom') {
      setShowCustomInput(true);
    } else {
      onSelect(milestone);
      handleClose();
    }
  };

  const handleClose = () => {
    setShowCustomInput(false);
    setCustomMilestone('');
    Keyboard.dismiss();
    onClose();
  };

  const handleCustomSubmit = () => {
    if (customMilestone.trim()) {
      onSelect({
        id: 'custom',
        label: customMilestone.trim(),
        icon: 'star'
      });
      setCustomMilestone('');
      setShowCustomInput(false);
      Keyboard.dismiss();
      onClose();
    }
  };

  const handleBackFromCustom = () => {
    setShowCustomInput(false);
    setCustomMilestone('');
    Keyboard.dismiss();
  };

  const renderMilestone = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.milestoneItem,
        { backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa' }
      ]}
      onPress={() => handleSelect(item)}
    >
      <MaterialCommunityIcons name={item.icon} size={24} color="#667eea" />
      <Text style={[styles.milestoneLabel, { color: darkMode ? '#fff' : '#2E3A59' }]}>
        {item.label}
      </Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }]}>
                <SafeAreaView edges={['bottom']} style={styles.safeArea}>
                  {/* Header */}
                  <View style={styles.modalHeader}>
                    {showCustomInput && (
                      <TouchableOpacity onPress={handleBackFromCustom} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={darkMode ? '#fff' : '#2E3A59'} />
                      </TouchableOpacity>
                    )}
                    <Text style={[styles.modalTitle, { color: darkMode ? '#fff' : '#2E3A59' }]}>
                      {showCustomInput ? 'Custom Milestone' : 'Select Milestone'}
                    </Text>
                    <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                      <MaterialCommunityIcons name="close" size={24} color={darkMode ? '#fff' : '#2E3A59'} />
                    </TouchableOpacity>
                  </View>

                  {/* Custom Input */}
                  {showCustomInput ? (
                    <View style={styles.customInputContainer}>
                      <Text style={[styles.customInputLabel, { color: darkMode ? '#aaa' : '#666' }]}>
                        Enter a custom milestone name
                      </Text>
                      <TextInput
                        style={[
                          styles.customInput,
                          {
                            backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa',
                            color: darkMode ? '#fff' : '#2E3A59',
                            borderColor: darkMode ? '#444' : '#e9ecef'
                          }
                        ]}
                        placeholder="e.g., First Bike Ride"
                        placeholderTextColor={darkMode ? '#888' : '#999'}
                        value={customMilestone}
                        onChangeText={setCustomMilestone}
                        autoFocus
                        maxLength={50}
                        returnKeyType="done"
                        onSubmitEditing={handleCustomSubmit}
                      />
                      <Text style={[styles.charCount, { color: darkMode ? '#888' : '#999' }]}>
                        {customMilestone.length}/50
                      </Text>
                      
                      <View style={styles.customButtonsRow}>
                        <TouchableOpacity
                          style={[styles.customButton, styles.cancelButton, { backgroundColor: darkMode ? '#2c2c2c' : '#f0f0f0' }]}
                          onPress={handleBackFromCustom}
                        >
                          <Text style={[styles.cancelButtonText, { color: darkMode ? '#aaa' : '#666' }]}>
                            Cancel
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.customButton, !customMilestone.trim() && styles.customButtonDisabled]}
                          onPress={handleCustomSubmit}
                          disabled={!customMilestone.trim()}
                        >
                          <LinearGradient
                            colors={customMilestone.trim() ? ['#667eea', '#764ba2'] : ['#ccc', '#aaa']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.customButtonGradient}
                          >
                            <MaterialCommunityIcons name="check" size={20} color="#fff" />
                            <Text style={styles.customButtonText}>Add Milestone</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <FlatList
                      data={COMMON_MILESTONES}
                      renderItem={renderMilestone}
                      keyExtractor={(item) => item.id}
                      contentContainerStyle={styles.milestoneList}
                      showsVerticalScrollIndicator={false}
                    />
                  )}
                </SafeAreaView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  safeArea: {
    maxHeight: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    padding: 4,
  },
  milestoneList: {
    padding: 20,
    paddingBottom: 10,
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  milestoneLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  customInputContainer: {
    padding: 20,
    paddingBottom: 10,
  },
  customInputLabel: {
    fontSize: 14,
    marginBottom: 12,
    fontWeight: '500',
  },
  customInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 4,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 20,
  },
  customButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  customButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  customButtonDisabled: {
    opacity: 0.6,
  },
  cancelButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  customButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  customButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MilestoneSelector;