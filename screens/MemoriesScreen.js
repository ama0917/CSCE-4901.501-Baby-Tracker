import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  Modal,
  Dimensions,
  Platform,
  StatusBar,
  ActivityIndicator,
  Animated,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Video } from 'expo-av';
import { Camera, ArrowLeft, Plus, Trash2, Play, Image as ImageIcon, Edit3, X } from 'lucide-react-native';
import { useDarkMode } from '../screens/DarkMode';
import ThemedBackground from '../screens/ThemedBackground';

const { width, height } = Dimensions.get('window');

export default function MemoriesScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { childId, name } = route.params || {};
  const { darkMode } = useDarkMode();

  const [memories, setMemories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [editingCaption, setEditingCaption] = useState(null);
  const [captionText, setCaptionText] = useState('');
  const [showCaptionModal, setShowCaptionModal] = useState(false);
  const [pendingAsset, setPendingAsset] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (!childId) {
        Alert.alert('Error', 'Child ID is missing');
        navigation.goBack();
      } else {
        loadMemories();
      }
    }, [childId])
  );

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const { status: mediaLibraryStatus } = await MediaLibrary.requestPermissionsAsync();
    
    if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
      Alert.alert(
        'Permissions Required',
        'Please grant camera and photo library permissions to add memories.'
      );
      return false;
    }
    return true;
  };

  // Load memories from local storage
  const loadMemories = async () => {
    try {
      setIsLoading(true);
      const storageKey = `memories_${childId}`;
      const storedMemories = await AsyncStorage.getItem(storageKey);
      
      if (storedMemories) {
        const parsedMemories = JSON.parse(storedMemories);
        // Sort by date, newest first
        const sortedMemories = parsedMemories.sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        setMemories(sortedMemories);
      } else {
        setMemories([]);
      }
    } catch (error) {
      console.error('Error loading memories:', error);
      Alert.alert('Error', 'Failed to load memories');
    } finally {
      setIsLoading(false);
    }
  };

  // Save memories to local storage
  const saveMemories = async (updatedMemories) => {
    try {
      const storageKey = `memories_${childId}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(updatedMemories));
    } catch (error) {
      console.error('Error saving memories:', error);
      throw error;
    }
  };

  const showImagePicker = () => {
    Alert.alert(
      'Add Memory',
      'Choose how you want to add a memory',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Camera', onPress: () => openCamera() },
        { text: 'Photo Library', onPress: () => openLibrary() },
      ]
    );
  };

  const openCamera = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });              

      if (!result.canceled && result.assets[0]) {
        setPendingAsset(result.assets[0]);
        setCaptionText('');
        setShowCaptionModal(true);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera');
    }
  };

  const openLibrary = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
          
      if (!result.canceled && result.assets[0]) {
        setPendingAsset(result.assets[0]);
        setCaptionText('');
        setShowCaptionModal(true);
      }
    } catch (error) {
      console.error('Library error:', error);
      Alert.alert('Error', 'Failed to open photo library');
    }
  };

  const saveMemory = async (caption = '') => {
    if (!pendingAsset) return;
    
    try {
      setIsUploading(true);
      
      // Create memory object with local URI
      const newMemory = {
        id: Date.now().toString(),
        childId,
        type: pendingAsset.type === 'video' ? 'video' : 'image',
        uri: pendingAsset.uri, // Store local URI
        caption: caption.trim(),
        createdAt: new Date().toISOString(),
        duration: pendingAsset.duration || null,
        width: pendingAsset.width,
        height: pendingAsset.height,
      };
      
      // Add to memories array
      const updatedMemories = [newMemory, ...memories];
      setMemories(updatedMemories);
      
      // Save to local storage
      await saveMemories(updatedMemories);
      
      Alert.alert('Success', 'Memory added successfully!');
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save memory');
    } finally {
      setIsUploading(false);
      setShowCaptionModal(false);
      setCaptionText('');
      setPendingAsset(null);
    }
  };

  const updateCaption = async (memoryId, newCaption) => {
    try {
      const updatedMemories = memories.map(memory =>
        memory.id === memoryId
          ? { ...memory, caption: newCaption.trim() }
          : memory
      );
      
      setMemories(updatedMemories);
      await saveMemories(updatedMemories);
      
      Alert.alert('Success', 'Caption updated successfully!');
      setEditingCaption(null);
      setCaptionText('');
    } catch (error) {
      console.error('Update caption error:', error);
      Alert.alert('Error', 'Failed to update caption');
    }
  };

  const deleteMemory = async (memory) => {
    Alert.alert(
      'Delete Memory',
      'Are you sure you want to delete this memory? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedMemories = memories.filter(m => m.id !== memory.id);
              setMemories(updatedMemories);
              await saveMemories(updatedMemories);
              
              Alert.alert('Success', 'Memory deleted successfully');
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete memory');
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

const CaptionModal = () => (
    <Modal visible={showCaptionModal} transparent animationType="slide">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.captionModalContainer}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.captionModalContent, { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }]}>
            <Text style={[styles.captionModalTitle, { color: darkMode ? '#fff' : '#2E3A59' }]}>
              Add a Caption
            </Text>
            
            <TextInput
              style={[
                styles.captionInput,
                { 
                  backgroundColor: darkMode ? '#2c2c2c' : '#f5f5f5',
                  color: darkMode ? '#fff' : '#2E3A59'
                }
              ]}
              placeholder="Describe this memory... (optional)"
              placeholderTextColor={darkMode ? '#999' : '#666'}
              value={captionText}
              onChangeText={setCaptionText}
              multiline
              maxLength={200}
              autoFocus={false}
            />
            
            <Text style={[styles.characterCount, { color: darkMode ? '#999' : '#666' }]}>
              {captionText.length}/200
            </Text>

            <View style={styles.captionModalButtons}>
              <TouchableOpacity
                style={[styles.captionModalButton, styles.captionCancelButton]}
                onPress={() => {
                  setShowCaptionModal(false);
                  setCaptionText('');
                  setPendingAsset(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.captionModalButtonText, { color: darkMode ? '#fff' : '#2E3A59' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.captionModalButton}
                onPress={() => saveMemory(captionText)}
                activeOpacity={0.8}
                disabled={isUploading}
              >
                <LinearGradient
                  colors={['#E1BEE7', '#CE93D8']}
                  style={styles.captionSaveGradient}
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.captionModalButtonText}>Save Memory</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const MemoryCard = ({ memory }) => (
    <TouchableOpacity
      style={styles.memoryCard}
      onPress={() => {
        setSelectedMemory(memory);
        setShowFullScreen(true);
      }}
      activeOpacity={0.8}
    >
      <View style={styles.memoryImageContainer}>
        {memory.type === 'image' ? (
          <Image source={{ uri: memory.uri }} style={styles.memoryImage} />
        ) : (
          <View style={styles.videoContainer}>
            <Image 
              source={{ uri: memory.uri }} 
              style={styles.memoryImage}
              onError={() => {}}
            />
            <View style={styles.playButton}>
              <Play size={24} color="#fff" fill="#fff" />
            </View>
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.memoryGradient}
        >
          {memory.caption ? (
            <Text style={styles.memoryCaption} numberOfLines={2}>
              {memory.caption}
            </Text>
          ) : null}
          <Text style={styles.memoryDate}>
            {formatDate(memory.createdAt)}
          </Text>
        </LinearGradient>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={(e) => {
          e.stopPropagation();
          deleteMemory(memory);
        }}
        activeOpacity={0.7}
      >
        <Trash2 size={16} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.editButton}
        onPress={(e) => {
          e.stopPropagation();
          setCaptionText(memory.caption || '');
          setEditingCaption(memory.id);
        }}
        activeOpacity={0.7}
      >
        <Edit3 size={16} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const EditCaptionModal = () => (
    <Modal visible={editingCaption !== null} transparent animationType="slide">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.captionModalContainer}
      >
        <TouchableOpacity 
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => {
            setEditingCaption(null);
            setCaptionText('');
          }}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.captionModalContent, { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }]}>
              <Text style={[styles.captionModalTitle, { color: darkMode ? '#fff' : '#2E3A59' }]}>
                Edit Caption
              </Text>
              
              <TextInput
                style={[
                  styles.captionInput,
                  { 
                    backgroundColor: darkMode ? '#2c2c2c' : '#f5f5f5',
                    color: darkMode ? '#fff' : '#2E3A59'
                  }
                ]}
                placeholder="Describe this memory..."
                placeholderTextColor={darkMode ? '#999' : '#666'}
                value={captionText}
                onChangeText={setCaptionText}
                multiline
                maxLength={200}
                autoFocus={false}
              />
              
              <Text style={[styles.characterCount, { color: darkMode ? '#999' : '#666' }]}>
                {captionText.length}/200
              </Text>

              <View style={styles.captionModalButtons}>
                <TouchableOpacity
                  style={[styles.captionModalButton, styles.captionCancelButton]}
                  onPress={() => {
                    setEditingCaption(null);
                    setCaptionText('');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.captionModalButtonText, { color: darkMode ? '#fff' : '#2E3A59' }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.captionModalButton}
                  onPress={() => updateCaption(editingCaption, captionText)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#81D4FA', '#64B5F6']}
                    style={styles.captionSaveGradient}
                  >
                    <Text style={styles.captionModalButtonText}>Save</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );

  const FullScreenModal = () => (
    <Modal visible={showFullScreen} transparent animationType="fade">
      <View style={styles.fullScreenContainer}>
        <TouchableOpacity
          style={styles.fullScreenClose}
          onPress={() => setShowFullScreen(false)}
          activeOpacity={0.8}
        >
          <X size={24} color="#fff" />
        </TouchableOpacity>
        
        {selectedMemory && (
          <View style={styles.fullScreenContent}>
            {selectedMemory.type === 'image' ? (
              <Image
                source={{ uri: selectedMemory.uri }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            ) : (
              <Video
                source={{ uri: selectedMemory.uri }}
                style={styles.fullScreenVideo}
                useNativeControls
                resizeMode="contain"
                shouldPlay={false}
              />
            )}
            {selectedMemory.caption ? (
              <View style={styles.fullScreenCaptionContainer}>
                <Text style={styles.fullScreenCaption}>
                  {selectedMemory.caption}
                </Text>
              </View>
            ) : null}
            <Text style={styles.fullScreenDate}>
              {formatDate(selectedMemory.createdAt)}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );

  return (
    <ThemedBackground>
      <StatusBar
        barStyle={darkMode ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerButton}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={darkMode ? ['#1f1f1f', '#2c2c2c'] : ['#fff', '#f5f5f5']}
              style={styles.headerButtonGradient}
            >
              <ArrowLeft size={20} color={darkMode ? '#fff' : '#2E3A59'} />
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[styles.title, { color: darkMode ? '#fff' : '#2E3A59' }]}>
            {name}'s Memories
          </Text>

          <TouchableOpacity
            onPress={showImagePicker}
            style={styles.headerButton}
            activeOpacity={0.7}
            disabled={isUploading}
          >
            <LinearGradient
              colors={['#E1BEE7', '#FFCDD2']}
              style={styles.headerButtonGradient}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Plus size={20} color="#fff" />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={darkMode ? '#fff' : '#2E3A59'} />
            <Text style={[styles.loadingText, { color: darkMode ? '#ccc' : '#666' }]}>
              Loading memories...
            </Text>
          </View>
        ) : memories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Camera size={64} color={darkMode ? '#666' : '#ccc'} />
            <Text style={[styles.emptyText, { color: darkMode ? '#ccc' : '#666' }]}>
              No memories yet
            </Text>
            <Text style={[styles.emptySubtext, { color: darkMode ? '#999' : '#999' }]}>
              Tap the + button to add your first memory
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.memoriesContainer}
            contentContainerStyle={styles.memoriesContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.memoriesGrid}>
              {memories.map((memory) => (
                <MemoryCard key={memory.id} memory={memory} />
              ))}
            </View>
          </ScrollView>
        )}
      </Animated.View>
      
      <CaptionModal />
      <EditCaptionModal />
      <FullScreenModal />
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : StatusBar.currentHeight + 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    marginBottom: 20,
  },
  headerButton: {
    borderRadius: 16,
    elevation: 5,
  },
  headerButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  memoriesContainer: {
    flex: 1,
  },
  memoriesContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  memoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  memoryCard: {
    width: (width - 50) / 2,
    marginBottom: 15,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    position: 'relative',
  },
  memoryImageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  memoryImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoContainer: {
    position: 'relative',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -20,
    marginLeft: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoryGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: 60,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 20,
  },
  memoryCaption: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 18,
  },
  memoryDate: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '500',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(244, 67, 54, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    position: 'absolute',
    top: 8,
    right: 48,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(33, 150, 243, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captionModalContainer: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captionModalContent: {
    width: width * 0.85,
    borderRadius: 20,
    padding: 24,
    elevation: 10,
  },
  captionModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  captionInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 20,
  },
  captionModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  captionModalButton: {
    flex: 1,
    marginHorizontal: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  captionCancelButton: {
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
  },
  captionSaveGradient: {
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captionModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : StatusBar.currentHeight + 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  fullScreenContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  fullScreenImage: {
    width: width,
    height: height * 0.7,
  },
  fullScreenVideo: {
    width: width,
    height: height * 0.7,
  },
  fullScreenCaptionContainer: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    maxWidth: width * 0.9,
  },
  fullScreenCaption: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  fullScreenDate: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
});