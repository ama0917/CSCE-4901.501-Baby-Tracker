import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const MemoriesConsentModal = ({ visible, onAccept, onDecline, darkMode }) => {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: darkMode ? '#2a2a2a' : '#fff' }]}>
          <View style={styles.header}>
            <Ionicons name="images" size={32} color="#667eea" />
            <Text style={[styles.title, { color: darkMode ? '#fff' : '#333' }]}>
              Welcome to Memories
            </Text>
          </View>
          
          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.contentContainer}
          >
            <Text style={[styles.text, { color: darkMode ? '#ddd' : '#333' }]}>
              Create a beautiful digital scrapbook of your child's precious moments.
            </Text>
            
            <Text style={[styles.subheading, { color: darkMode ? '#64b5f6' : '#667eea' }]}>
              What you can do:
            </Text>
            <Text style={[styles.bullet, { color: darkMode ? '#ccc' : '#555' }]}>
              • Upload photos and videos
            </Text>
            <Text style={[styles.bullet, { color: darkMode ? '#ccc' : '#555' }]}>
              • Add captions and descriptions
            </Text>
            <Text style={[styles.bullet, { color: darkMode ? '#ccc' : '#555' }]}>
              • Tag special milestones
            </Text>
            <Text style={[styles.bullet, { color: darkMode ? '#ccc' : '#555' }]}>
              • Share with family (optional)
            </Text>
            
            <Text style={[styles.subheading, { color: darkMode ? '#64b5f6' : '#667eea' }]}>
              Privacy & Storage:
            </Text>
            <Text style={[styles.bullet, { color: darkMode ? '#ccc' : '#555' }]}>
              • Media stored securely in Firebase Storage
            </Text>
            <Text style={[styles.bullet, { color: darkMode ? '#ccc' : '#555' }]}>
              • Only accessible by you and authorized caregivers
            </Text>
            <Text style={[styles.bullet, { color: darkMode ? '#ccc' : '#555' }]}>
              • You can delete memories anytime
            </Text>
            <Text style={[styles.bullet, { color: darkMode ? '#ccc' : '#555' }]}>
              • Standard Firebase storage costs may apply
            </Text>
            
            <View style={[
              styles.note,
              {
                backgroundColor: darkMode ? '#1f1f1f' : '#f5f5f5',
                borderLeftColor: darkMode ? '#64b5f6' : '#667eea'
              }
            ]}>
              <Text style={[styles.noteText, { color: darkMode ? '#aaa' : '#666' }]}>
                By using Memories, you agree to store your photos and videos in our secure cloud storage.
              </Text>
            </View>
          </ScrollView>
          
          <View style={styles.actions}>
            <TouchableOpacity 
              style={[
                styles.declineButton,
                { 
                  borderColor: darkMode ? '#555' : '#ccc',
                  backgroundColor: darkMode ? '#2a2a2a' : '#fff'
                }
              ]} 
              onPress={onDecline}
            >
              <Text style={[styles.declineText, { color: darkMode ? '#ccc' : '#666' }]}>
                Not Now
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.acceptGradient}
              >
                <Text style={styles.acceptText}>Start Creating Memories</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    borderRadius: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    paddingTop: 25,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
  },
  scrollView: {
    maxHeight: 400,
  },
  contentContainer: {
    padding: 20,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 10,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 24,
    marginLeft: 10,
    marginBottom: 8,
  },
  note: {
    marginTop: 20,
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  noteText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 15,
    gap: 10,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  declineText: {
    fontWeight: '600',
    fontSize: 15,
  },
  acceptButton: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  acceptGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  acceptText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default MemoriesConsentModal;