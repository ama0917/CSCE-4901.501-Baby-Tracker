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
  TouchableWithoutFeedback,
  Keyboard
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
        const asset = result.assets[0];
        setTimeout(() => {
          setPendingAsset(asset);
          setCaptionText('');
          setShowCaptionModal(true);
        }, 200); // small delay to prevent UI freeze
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
        style={styles.modalBackdrop}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
                },
              ]}
              placeholder="Describe this memory... (optional)"
              placeholderTextColor={darkMode ? '#999' : '#666'}
              value={captionText}
              onChangeText={setCaptionText}
              multiline
              maxLength={200}
              autoFocus
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
              >
                <Text style={[styles.captionModalButtonText, { color: darkMode ? '#fff' : '#2E3A59' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.captionModalButton}
                onPress={() => saveMemory(captionText)}
                disabled={isUploading}
              >
                <LinearGradient colors={['#E1BEE7', '#CE93D8']} style={styles.captionSaveGradient}>
                  {isUploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.captionModalButtonText}>Save Memory</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );


  const MemoryCard = ({ memory, index }) => {
    // Random slight rotation for scrapbook effect
    const rotations = ['-2deg', '1deg', '-1deg', '2deg', '0deg', '-1.5deg', '1.5deg'];
    const rotation = rotations[index % rotations.length];
    
    return (
      <TouchableOpacity
        style={[styles.memoryCard, { transform: [{ rotate: rotation }] }]}
        onPress={() => {
          setSelectedMemory(memory);
          setShowFullScreen(true);
        }}
        activeOpacity={0.8}
      >
        {/* Decorative corner tape effect */}
        <View style={styles.tapeTopLeft} />
        <View style={styles.tapeTopRight} />
        
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
                <Play size={20} color="#E1BEE7" fill="#E1BEE7" />
              </View>
            </View>
          )}
          <View style={styles.memoryGradient}>
            {memory.caption ? (
              <Text style={styles.memoryCaption} numberOfLines={3}>
                {memory.caption}
              </Text>
            ) : null}
            <Text style={styles.memoryDate}>
              {formatDate(memory.createdAt)}
            </Text>
          </View>
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
  };

  const EditCaptionModal = () => (
    <Modal visible={editingCaption !== null} transparent animationType="slide">
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
              colors={darkMode ? ['#E1BEE7', '#CE93D8'] : ['#FFE5EC', '#FFC1E3']}
              style={styles.headerButtonGradient}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Plus size={20} color={darkMode ? '#fff' : '#E91E63'} />
              )}
            </LinearGradient>
          </TouchableOpacity>
                  </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={darkMode ? '#E1BEE7' : '#CE93D8'} />
            <Text style={[styles.loadingText, { color: darkMode ? '#ccc' : '#666' }]}>
              Loading memories...
            </Text>
          </View>
        ) : memories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyScrapbookIcon}>
              <Camera size={64} color={darkMode ? '#666' : '#E1BEE7'} />
              <Text style={styles.emptyScrapbookDeco}></Text>
            </View>
            <Text style={[styles.emptyText, { color: darkMode ? '#ccc' : '#666' }]}>
              Your Scrapbook is Empty
            </Text>
            <Text style={[styles.emptySubtext, { color: darkMode ? '#999' : '#999' }]}>
              Start creating beautiful memories by tapping the + button above
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.memoriesContainer}
            contentContainerStyle={styles.memoriesContent}
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.memoriesGrid}>
            {memories.map((memory, index) => (
              <MemoryCard key={memory.id} memory={memory} index={index} />
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
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Noteworthy-Bold' : 'sans-serif-medium',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Noteworthy' : 'sans-serif',
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
    fontFamily: Platform.OS === 'ios' ? 'Noteworthy-Bold' : 'sans-serif-medium',
  },
  emptySubtext: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Noteworthy' : 'sans-serif',
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
    marginBottom: 20,
    borderRadius: 0,
    position: 'relative',
    backgroundColor: '#fff',
    // Scrapbook paper effect
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 8,
    transform: [{ rotate: '0deg' }],
  },
  memoryImageContainer: {
    width: '100%',
    height: 200,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 8,
    borderColor: '#fff',
    backgroundColor: '#f5f5f5',
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
    marginTop: -25,
    marginLeft: -25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#E1BEE7',
  },
  memoryGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: 80,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 30,
    backgroundColor: 'transparent',
  },
  memoryCaption: {
    color: '#2E3A59',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    lineHeight: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 8,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Noteworthy' : 'sans-serif',
    borderLeftWidth: 3,
    borderLeftColor: '#E1BEE7',
  },
  memoryDate: {
    color: '#666',
    fontSize: 10,
    fontWeight: '500',
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 6,
    borderRadius: 4,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center',
  },
  deleteButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  editButton: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  captionModalContainer: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captionModalContent: {
    width: width * 0.85,
    borderRadius: 20,
    padding: 28,
    elevation: 10,
    borderWidth: 4,
    borderColor: '#E1BEE7',
  },
  captionModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Noteworthy-Bold' : 'sans-serif-medium',
  },
  captionInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#E1BEE7',
    fontFamily: Platform.OS === 'ios' ? 'Noteworthy' : 'sans-serif',
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
    borderWidth: 2,
    borderColor: '#BDBDBD',
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
    fontFamily: Platform.OS === 'ios' ? 'Noteworthy-Bold' : 'sans-serif-medium',
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
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    borderWidth: 2,
    borderColor: '#fff',
  },
  fullScreenContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  fullScreenImage: {
    width: width * 0.9,
    height: height * 0.6,
    borderRadius: 8,
    borderWidth: 12,
    borderColor: '#fff',
  },
  fullScreenVideo: {
    width: width * 0.9,
    height: height * 0.6,
    borderRadius: 8,
    borderWidth: 12,
    borderColor: '#fff',
  },
  fullScreenCaptionContainer: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    maxWidth: width * 0.85,
    borderWidth: 3,
    borderColor: '#E1BEE7',
  },
  fullScreenCaption: {
    color: '#2E3A59',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Noteworthy' : 'sans-serif',
  },
  fullScreenDate: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tapeTopLeft: {
    position: 'absolute',
    top: -5,
    left: 15,
    width: 40,
    height: 20,
    backgroundColor: 'rgba(255, 223, 186, 0.7)',
    transform: [{ rotate: '-45deg' }],
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.3)',
  },
  tapeTopRight: {
    position: 'absolute',
    top: -5,
    right: 15,
    width: 40,
    height: 20,
    backgroundColor: 'rgba(255, 223, 186, 0.7)',
    transform: [{ rotate: '45deg' }],
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.3)',
  },
  emptyScrapbookIcon: {
  position: 'relative',
  marginBottom: 10,
  },
  emptyScrapbookDeco: {
    position: 'absolute',
    top: -10,
    right: -20,
    fontSize: 32,
  },
});