import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Image, Alert, RefreshControl, ActivityIndicator, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFirestore, collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDarkMode } from './DarkMode';
import { appTheme } from './ThemedBackground';
import MemoriesConsentModal from '../src/components/MemoriesConsentModal';
import { deleteImage } from '../src/utils/imageUpload';
import { ArrowLeft } from 'lucide-react-native';

const MEMORIES_CONSENT_KEY = 'memories_consent';

const darkModeGradients = {
  card: ['#1f1f1f', '#2c2c2c'],
};

const MemoriesScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { childId, childName } = route.params;
  const { darkMode } = useDarkMode();
  const theme = darkMode ? appTheme.dark : appTheme.light;
  
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  
  const db = getFirestore();
  const auth = getAuth();

  // Check consent on mount
  useEffect(() => {
    checkConsent();
  }, []);

  // Load memories when consent is given
  useFocusEffect(
    React.useCallback(() => {
      if (hasConsent && childId) {
        const unsubscribe = loadMemories();
        return () => unsubscribe && unsubscribe();
      }
    }, [hasConsent, childId])
  );

  const checkConsent = async () => {
    try {
      const consent = await AsyncStorage.getItem(MEMORIES_CONSENT_KEY);
      if (consent === 'true') {
        setHasConsent(true);
      } else {
        setShowConsentModal(true);
      }
    } catch (error) {
      console.error('Error checking consent:', error);
      setShowConsentModal(true);
    }
  };

  const handleConsent = async () => {
    try {
      await AsyncStorage.setItem(MEMORIES_CONSENT_KEY, 'true');
      setHasConsent(true);
      setShowConsentModal(false);
    } catch (error) {
      console.error('Error saving consent:', error);
      Alert.alert('Error', 'Failed to save preference');
    }
  };

  const handleDecline = () => {
    setShowConsentModal(false);
    navigation.goBack();
  };

  const loadMemories = () => {
    try {
      const q = query(
        collection(db, 'memories'),
        where('childId', '==', childId),
        orderBy('date', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const memoriesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMemories(memoriesData);
        setLoading(false);
        setRefreshing(false);
      }, (error) => {
        console.error('Error loading memories:', error);
        setLoading(false);
        setRefreshing(false);
        Alert.alert('Error', 'Failed to load memories');
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up memories listener:', error);
      setLoading(false);
      return null;
    }
  };

  const handleDeleteMemory = (memory) => {
    Alert.alert(
      'Delete Memory',
      'Are you sure you want to delete this memory? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Handle both old single media and new multi-media formats
              if (memory.media && Array.isArray(memory.media)) {
                // Delete all media items
                for (const mediaItem of memory.media) {
                  if (mediaItem.mediaUrl) {
                    await deleteImage(mediaItem.mediaUrl);
                  }
                  if (mediaItem.thumbnailUrl) {
                    await deleteImage(mediaItem.thumbnailUrl);
                  }
                }
              } else {
                // Old format - single media
                if (memory.mediaUrl) {
                  await deleteImage(memory.mediaUrl);
                }
                if (memory.thumbnailUrl) {
                  await deleteImage(memory.thumbnailUrl);
                }
              }
              
              // Delete document
              await deleteDoc(doc(db, 'memories', memory.id));
              
              Alert.alert('Success', 'Memory deleted');
            } catch (error) {
              console.error('Error deleting memory:', error);
              Alert.alert('Error', 'Failed to delete memory');
            }
          }
        }
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    // The listener will automatically update when new data arrives
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderMemoryItem = ({ item }) => {
    // Handle both old single media and new multi-media formats
    const firstMedia = item.media 
      ? item.media.sort((a, b) => a.order - b.order)[0]
      : {
          mediaUrl: item.mediaUrl,
          thumbnailUrl: item.thumbnailUrl,
          mediaType: item.mediaType
        };
    
    const mediaCount = item.media ? item.media.length : 1;

    return (
      <TouchableOpacity
        style={[styles.memoryCard, { backgroundColor: darkMode ? '#2c2c2c' : '#fff' }]}
        onPress={() => navigation.navigate('MemoryDetail', { memory: item, childName })}
        activeOpacity={0.9}
      >
        {/* Media Preview */}
        <View style={styles.mediaContainer}>
          {firstMedia.mediaType === 'video' ? (
            <>
              <Image 
                source={{ uri: firstMedia.thumbnailUrl || firstMedia.mediaUrl }} 
                style={styles.mediaImage}
              />
              <View style={styles.videoOverlay}>
                <MaterialCommunityIcons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
              </View>
            </>
          ) : (
            <Image source={{ uri: firstMedia.mediaUrl }} style={styles.mediaImage} />
          )}
          
          {/* Multi-media indicator */}
          {mediaCount > 1 && (
            <View style={styles.multiMediaBadge}>
              <MaterialCommunityIcons name="image-multiple" size={16} color="#fff" />
              <Text style={styles.multiMediaText}>{mediaCount}</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          <Text style={[styles.caption, { color: theme.textPrimary }]} numberOfLines={2}>
            {item.caption}
          </Text>
          {item.description && (
            <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          <View style={styles.metaContainer}>
            <MaterialCommunityIcons name="calendar" size={14} color={theme.textSecondary} />
            <Text style={[styles.date, { color: theme.textSecondary }]}>
              {item.date?.toDate().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </Text>
          </View>
        </View>

        {/* Delete Button */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteMemory(item)}
        >
          <MaterialCommunityIcons name="delete-outline" size={20} color="#ff5252" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons 
        name="image-multiple" 
        size={80} 
        color={darkMode ? '#555' : '#ccc'} 
      />
      <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
        No Memories Yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Start capturing precious moments with {childName}
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => navigation.navigate('AddMemory', { childId, childName })}
      >
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.emptyButtonGradient}
        >
          <MaterialCommunityIcons name="plus" size={20} color="#fff" />
          <Text style={styles.emptyButtonText}>Create First Memory</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  if (!hasConsent) {
    return (
      <MemoriesConsentModal
        visible={showConsentModal}
        onAccept={handleConsent}
        onDecline={handleDecline}
        darkMode={darkMode}
      />
    );
  }

  if (loading) {
    return (
      <LinearGradient colors={theme.backgroundGradient} style={styles.gradient}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={[styles.loadingText, { color: theme.textPrimary }]}>
              Loading memories...
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
      <LinearGradient colors={theme.backgroundGradient} style={styles.gradient}>
        <SafeAreaView style={styles.container} edges={['top']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()} 
              style={styles.headerButton} 
              activeOpacity={0.7}
            >
              <LinearGradient 
                colors={darkMode ? darkModeGradients.card : ['#fff', '#f5f5f5']} 
                style={styles.headerButtonGradient}
              >
                <ArrowLeft size={20} color={darkMode ? '#fff' : '#2E3A59'} />
                </LinearGradient>
                </TouchableOpacity>
                
                <View style={styles.headerTitleContainer}>
                  <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
                    Memories
                  </Text>
                  <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                    {childName}
                  </Text>
                </View>
                
                {/* Spacer to balance the back button for perfect centering */}
                <View style={styles.headerButtonSpacer} />
          </View>

          {/* Memories List */}
          <FlatList
            data={memories}
            renderItem={renderMemoryItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.textPrimary}
              />
            }
          />

          {/* Floating Add Button (when list has items) */}
          {memories.length > 0 && (
            <TouchableOpacity
              style={styles.floatingButton}
              onPress={() => navigation.navigate('AddMemory', { childId, childName })}
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.floatingGradient}
              >
                <MaterialCommunityIcons name="plus" size={28} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </LinearGradient>
    </>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  memoryCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  mediaContainer: {
    position: 'relative',
  },
  mediaImage: {
    width: '100%',
    aspectRatio: 4/3,
    backgroundColor: '#f0f0f0',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  contentContainer: {
    padding: 16,
  },
  caption: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  date: {
    fontSize: 12,
    marginLeft: 6,
  },
  deleteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  emptyButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerButtonSpacer: {
    width: 44,
    height: 44,
  },
  multiMediaBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  multiMediaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default MemoriesScreen;