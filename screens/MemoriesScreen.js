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
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Video } from 'expo-av';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  deleteDoc, 
  doc,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { Camera, ArrowLeft, Plus, Trash2, Play, Image as ImageIcon } from 'lucide-react-native';
import { db, storage } from '../firebaseConfig';
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
        fetchMemories();
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

  const fetchMemories = async () => {
    try {
      setIsLoading(true);
      const memoriesQuery = query(
        collection(db, 'memories'),
        where('childId', '==', childId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(memoriesQuery);
      const fetchedMemories = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));
      
      setMemories(fetchedMemories);
    } catch (error) {
      console.error('Error fetching memories:', error);
      Alert.alert('Error', 'Failed to load memories');
    } finally {
      setIsLoading(false);
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
        await uploadMemory(result.assets[0]);
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
        await uploadMemory(result.assets[0]);
      }
    } catch (error) {
      console.error('Library error:', error);
      Alert.alert('Error', 'Failed to open photo library');
    }
  };

  const uploadMemory = async (asset) => {
    try {
      console.log('Uploading asset:', asset);
      setIsUploading(true);
      
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      
      const fileExtension = asset.type === 'video' ? 'mp4' : 'jpg';
      const fileName = `${childId}_${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, `memories/${fileName}`);
      
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      
      const memoryData = {
        childId,
        type: asset.type === 'video' ? 'video' : 'image',
        url: downloadURL,
        fileName,
        createdAt: serverTimestamp(),
        duration: asset.duration || null,
        width: asset.width,
        height: asset.height,
      };
      
      await addDoc(collection(db, 'memories'), memoryData);
      
      Alert.alert('Success', 'Memory added successfully!');
      fetchMemories();
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload memory');
    } finally {
      setIsUploading(false);
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
              // Delete from storage
              const storageRef = ref(storage, `memories/${memory.fileName}`);
              await deleteObject(storageRef);
              
              // Delete from firestore
              await deleteDoc(doc(db, 'memories', memory.id));
              
              Alert.alert('Success', 'Memory deleted successfully');
              fetchMemories();
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete memory');
            }
          }
        }
      ]
    );
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
          <Image source={{ uri: memory.url }} style={styles.memoryImage} />
        ) : (
          <View style={styles.videoContainer}>
            <Image 
              source={{ uri: memory.url }} 
              style={styles.memoryImage}
              onError={() => {
                // Fallback for video thumbnails
              }}
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
    </TouchableOpacity>
  );

  const FullScreenModal = () => (
    <Modal visible={showFullScreen} transparent animationType="fade">
      <View style={styles.fullScreenContainer}>
        <TouchableOpacity
          style={styles.fullScreenClose}
          onPress={() => setShowFullScreen(false)}
          activeOpacity={0.8}
        >
          <Text style={styles.fullScreenCloseText}>✕</Text>
        </TouchableOpacity>
        
        {selectedMemory && (
          <View style={styles.fullScreenContent}>
            {selectedMemory.type === 'image' ? (
              <Image
                source={{ uri: selectedMemory.url }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            ) : (
              <Video
                source={{ uri: selectedMemory.url }}
                style={styles.fullScreenVideo}
                useNativeControls
                resizeMode="contain"
                shouldPlay={false}
              />
            )}
            <Text style={styles.fullScreenDate}>
              {selectedMemory && formatDate(selectedMemory.createdAt)}
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
        {/* Header */}
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

        {/* Content */}
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
    height: 60,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  memoryDate: {
    color: '#fff',
    fontSize: 12,
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
  fullScreenCloseText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  fullScreenContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  fullScreenImage: {
    width: width,
    height: height * 0.8,
  },
  fullScreenVideo: {
    width: width,
    height: height * 0.8,
  },
  fullScreenDate: {
    color: '#fff',
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
  },
});