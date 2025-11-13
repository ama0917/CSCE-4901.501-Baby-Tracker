import { ref, uploadBytesResumable, getStorage, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../../firebaseConfig';
import * as VideoThumbnails from 'expo-video-thumbnails';

/**
 * Upload image to Firebase Storage
 * @param {string} uri - Local image URI
 * @param {string} path - Storage path (e.g., 'children/profiles/childId')
 * @returns {Promise<string>} - Download URL
 */
export const uploadImage = async (uri, path) => {
  try {
    // Fetch the image as a blob
    const response = await fetch(uri);
    const blob = await response.blob();
    
    // Create a reference to the storage location
    const storageRef = ref(storage, path);
    
    // Upload the blob
    await uploadBytes(storageRef, blob);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

/**
 * Delete image from Firebase Storage
 * @param {string} imageUrl - Full download URL of the image
 */
export const deleteImage = async (imageUrl) => {
  try {
    if (!imageUrl || !imageUrl.includes('firebasestorage.googleapis.com')) {
      return; // Not a Firebase Storage URL
    }
    
    // Extract the path from the URL
    const decodedUrl = decodeURIComponent(imageUrl);
    const pathMatch = decodedUrl.match(/\/o\/(.*?)\?/);
    
    if (pathMatch && pathMatch[1]) {
      const imagePath = pathMatch[1];
      const imageRef = ref(storage, imagePath);
      await deleteObject(imageRef);
      console.log('Image deleted successfully');
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    // Don't throw - deletion failures shouldn't block operations
  }
};

/**
 * Generate unique filename with timestamp
 * @param {string} childId
 * @returns {string}
 */
export const generateImagePath = (childId) => {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  return `children/profiles/${childId}/${timestamp}_${randomId}.jpg`;
};

/**
 * Upload media (image or video) with progress tracking
 */
export const uploadMedia = async (uri, path, onProgress) => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, blob);
    
    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => {
          console.error('Upload error:', error);
          reject(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        }
      );
    });
  } catch (error) {
    console.error('Error uploading media:', error);
    throw error;
  }
};

/**
 * Generate video thumbnail
 */
export const generateVideoThumbnail = async (videoUri) => {
  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time: 1000, // 1 second into video
      quality: 0.7,
    });
    return uri;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return null;
  }
};

/**
 * Generate unique filename for memories
 */
export const generateMemoryPath = (childId, mediaType) => {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  const extension = mediaType === 'video' ? 'mp4' : 'jpg';
  return `children/memories/${childId}/${timestamp}_${randomId}.${extension}`;
};