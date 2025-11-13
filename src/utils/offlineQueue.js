import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { uploadMedia, generateMemoryPath, generateVideoThumbnail } from './imageUpload';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
import * as FileSystem from 'expo-file-system';

const OFFLINE_QUEUE_KEY = 'memories_offline_queue';
const LOCAL_MEDIA_DIR = `${FileSystem.documentDirectory}offline_memories/`;

/**
 * Ensure local storage directory exists
 */
const ensureDirectoryExists = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(LOCAL_MEDIA_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(LOCAL_MEDIA_DIR, { intermediates: true });
    }
  } catch (error) {
    console.error('Error creating directory:', error);
  }
};

/**
 * Copy media to local storage
 */
const saveMediaLocally = async (uri, index) => {
  try {
    await ensureDirectoryExists();
    
    // Determine file extension
    let extension = '.jpg';
    if (uri.includes('.mp4') || uri.includes('video')) {
      extension = '.mp4';
    } else if (uri.includes('.mov')) {
      extension = '.mov';
    } else if (uri.includes('.png')) {
      extension = '.png';
    }
    
    const filename = `${Date.now()}_${index}_${Math.random().toString(36).substring(7)}${extension}`;
    const localUri = `${LOCAL_MEDIA_DIR}${filename}`;
    
    // Copy file to local storage
    await FileSystem.copyAsync({
      from: uri,
      to: localUri,
    });
    
    console.log('Saved media locally:', localUri);
    return localUri;
  } catch (error) {
    console.error('Error saving media locally:', error);
    throw error;
  }
};

/**
 * Get offline queue
 */
export const getOfflineQueue = async () => {
  try {
    const queue = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('Error getting offline queue:', error);
    return [];
  }
};

/**
 * Save memory to offline queue
 */
export const saveToOfflineQueue = async (memoryData) => {
  try {
    const queue = await getOfflineQueue();
    
    // Save media files locally
    const localMediaUris = [];
    for (let i = 0; i < memoryData.mediaItems.length; i++) {
      const item = memoryData.mediaItems[i];
      const localUri = await saveMediaLocally(item.uri, i);
      localMediaUris.push(localUri);
    }
    
    const queueItem = {
      id: Date.now().toString(),
      ...memoryData,
      localMediaUris,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };
    
    queue.push(queueItem);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    
    console.log('Saved to offline queue:', queueItem.id);
    return queueItem;
  } catch (error) {
    console.error('Error saving to offline queue:', error);
    throw error;
  }
};

/**
 * Process offline queue
 */
export const processOfflineQueue = async () => {
  try {
    const queue = await getOfflineQueue();
    const db = getFirestore();
    
    if (queue.length === 0) return { processed: 0, failed: 0 };
    
    let processed = 0;
    let failed = 0;
    const remainingQueue = [];
    
    for (const item of queue) {
      try {
        // Upload all media items
        const uploadedMedia = [];
        
        for (let i = 0; i < item.localMediaUris.length; i++) {
          const localUri = item.localMediaUris[i];
          const mediaItem = item.mediaItems[i];
          
          // FIXED: Correct parameter order (path, uri, callback)
          const mediaPath = generateMemoryPath(item.childId, mediaItem.type);
          const mediaUrl = await uploadMedia(mediaPath, localUri);
          
          // Generate thumbnail for videos
          let thumbnailUrl = null;
          if (mediaItem.type === 'video') {
            const thumbnailUri = await generateVideoThumbnail(localUri);
            if (thumbnailUri) {
              const thumbnailPath = generateMemoryPath(item.childId, 'photo');
              thumbnailUrl = await uploadMedia(thumbnailPath, thumbnailUri);
            }
          }
          
          uploadedMedia.push({
            mediaUrl,
            thumbnailUrl,
            mediaType: mediaItem.type,
            order: i,
          });
          
          // Delete local file after successful upload
          await FileSystem.deleteAsync(localUri, { idempotent: true });
        }
        
        // Save to Firestore
        await addDoc(collection(db, 'memories'), {
          childId: item.childId,
          userId: item.userId,
          media: uploadedMedia,
          caption: item.caption,
          description: item.description,
          date: Timestamp.fromDate(new Date(item.memoryDate)),
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date()),
          likes: 0,
          likedBy: [],
        });
        
        processed++;
      } catch (error) {
        console.error('Error processing queue item:', error);
        remainingQueue.push(item);
        failed++;
      }
    }
    
    // Update queue with failed items
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue));
    
    return { processed, failed };
  } catch (error) {
    console.error('Error processing offline queue:', error);
    return { processed: 0, failed: 0 };
  }
};

/**
 * Check network status and process queue if online
 */
export const checkAndProcessQueue = async () => {
  const netInfo = await NetInfo.fetch();
  
  if (netInfo.isConnected) {
    return await processOfflineQueue();
  }
  
  return { processed: 0, failed: 0 };
};

/**
 * Get queue count
 */
export const getQueueCount = async () => {
  const queue = await getOfflineQueue();
  return queue.length;
};

/**
 * Clear all offline queue items
 */
export const clearOfflineQueue = async () => {
  try {
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([]));
    
    // Clean up local files
    const dirInfo = await FileSystem.getInfoAsync(LOCAL_MEDIA_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(LOCAL_MEDIA_DIR, { idempotent: true });
    }
  } catch (error) {
    console.error('Error clearing offline queue:', error);
  }
};