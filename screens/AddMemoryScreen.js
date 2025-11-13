import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  Alert, ScrollView, Platform, ActivityIndicator, StatusBar,
  KeyboardAvoidingView, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Video } from 'expo-av';
import { useDarkMode } from './DarkMode';
import { appTheme } from './ThemedBackground';
import { uploadMedia, generateMemoryPath, generateVideoThumbnail } from '../src/utils/imageUpload';

const AddMemoryScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { childId, childName } = route.params;
    const { darkMode } = useDarkMode();
    const theme = darkMode ? appTheme.dark : appTheme.light;
    
    const scrollViewRef = useRef(null);
    const descriptionInputRef = useRef(null);

    const [mediaUri, setMediaUri] = useState(null);
    const [mediaType, setMediaType] = useState(null); // 'photo' or 'video'
    const [caption, setCaption] = useState('');
    const [description, setDescription] = useState('');
    const [memoryDate, setMemoryDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    
    const db = getFirestore();
    const auth = getAuth();

    const pickMedia = async (type) => {
        try {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
            Alert.alert('Permission Required', 'Please grant media library permissions.');
            return;
        }

        const options = {
            mediaTypes: type === 'photo' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: true,
            quality: 0.8,
            videoMaxDuration: 120, // 2 minutes max (increased from 60)
        };

        if (type === 'photo') {
            options.aspect = [4, 3];
        }

        const result = await ImagePicker.launchImageLibraryAsync(options);

        if (!result.canceled) {
            const asset = result.assets[0];
            
            // Check video duration
            if (type === 'video' && asset.duration) {
            const durationInSeconds = asset.duration / 1000;
            if (durationInSeconds > 120) {
                Alert.alert(
                'Video Too Long',
                'Please select a video that is 2 minutes or shorter.',
                [{ text: 'OK' }]
                );
                return;
            }
            }
            
            setMediaUri(asset.uri);
            setMediaType(type);
        }
        } catch (error) {
        console.error('Error picking media:', error);
        Alert.alert('Error', 'Failed to pick media. Please try again.');
        }
    };

  const handleSave = async () => {
    if (!mediaUri) {
      Alert.alert('Missing Media', 'Please add a photo or video first.');
      return;
    }

    if (!caption.trim()) {
      Alert.alert('Missing Caption', 'Please add a caption for this memory.');
      return;
    }

    try {
      setUploading(true);
      const currentUser = auth.currentUser;

      // Upload media
      const mediaPath = generateMemoryPath(childId, mediaType);
      const mediaUrl = await uploadMedia(mediaUri, mediaPath, (progress) => {
        setUploadProgress(progress);
      });

      // Generate thumbnail for videos
      let thumbnailUrl = null;
      if (mediaType === 'video') {
        const thumbnailUri = await generateVideoThumbnail(mediaUri);
        if (thumbnailUri) {
          const thumbnailPath = generateMemoryPath(childId, 'photo');
          thumbnailUrl = await uploadMedia(thumbnailUri, thumbnailPath);
        }
      }

      // Save to Firestore
      await addDoc(collection(db, 'memories'), {
        childId,
        userId: currentUser.uid,
        mediaType,
        mediaUrl,
        thumbnailUrl,
        caption: caption.trim(),
        description: description.trim(),
        date: Timestamp.fromDate(memoryDate),
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
        likes: 0,
        likedBy: [],
      });

      Alert.alert('Success', 'Memory saved successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error saving memory:', error);
      Alert.alert('Error', 'Failed to save memory. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
      <LinearGradient 
        colors={theme.backgroundGradient}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.container} edges={['top']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
              New Memory
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: 'transparent' }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
            <ScrollView 
              ref={scrollViewRef}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Media Picker */}
              {!mediaUri ? (
                <View style={styles.mediaPickerContainer}>
                  <TouchableOpacity
                    style={[styles.mediaOption, { backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa' }]}
                    onPress={() => pickMedia('photo')}
                  >
                    <MaterialCommunityIcons name="camera" size={40} color="#667eea" />
                    <Text style={[styles.mediaOptionText, { color: theme.textPrimary }]}>
                      Add Photo
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.mediaOption, { backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa' }]}
                    onPress={() => pickMedia('video')}
                  >
                    <MaterialCommunityIcons name="video" size={40} color="#667eea" />
                    <Text style={[styles.mediaOptionText, { color: theme.textPrimary }]}>
                      Add Video
                    </Text>
                    <Text style={[styles.videoHint, { color: theme.textSecondary }]}>
                      Max 2 minutes
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.mediaPreviewContainer}>
                  {mediaType === 'photo' ? (
                    <Image source={{ uri: mediaUri }} style={styles.mediaPreview} />
                  ) : (
                    <Video
                      source={{ uri: mediaUri }}
                      style={styles.mediaPreview}
                      useNativeControls
                      resizeMode="contain"
                      isLooping
                    />
                  )}
                  <TouchableOpacity
                    style={styles.changeMediaButton}
                    onPress={() => {
                      setMediaUri(null);
                      setMediaType(null);
                    }}
                  >
                    <MaterialCommunityIcons name="close-circle" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Form Fields */}
              <View style={[styles.formContainer, { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }]}>
                {/* Caption */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Caption *</Text>
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa',
                      borderColor: darkMode ? '#444' : '#e9ecef',
                      color: theme.textPrimary
                    }]}
                    placeholder="Add a caption..."
                    placeholderTextColor={darkMode ? '#888' : '#999'}
                    value={caption}
                    onChangeText={setCaption}
                    maxLength={100}
                    returnKeyType="next"
                    onSubmitEditing={() => descriptionInputRef.current?.focus()}
                  />
                  <Text style={styles.charCount}>{caption.length}/100</Text>
                </View>

                {/* Description */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Description</Text>
                  <TextInput
                    ref={descriptionInputRef}
                    style={[styles.textArea, { 
                      backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa',
                      borderColor: darkMode ? '#444' : '#e9ecef',
                      color: theme.textPrimary
                    }]}
                    placeholder="Tell the story behind this moment..."
                    placeholderTextColor={darkMode ? '#888' : '#999'}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={4}
                    maxLength={500}
                    textAlignVertical="top"
                    onFocus={() => {
                      // Scroll to description field when focused
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 100);
                    }}
                  />
                  <Text style={styles.charCount}>{description.length}/500</Text>
                </View>

                {/* Date */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Date</Text>
                  <TouchableOpacity
                    style={[styles.dateButton, { 
                      backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa',
                      borderColor: darkMode ? '#444' : '#e9ecef'
                    }]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setShowDatePicker(true);
                    }}
                  >
                    <MaterialCommunityIcons name="calendar" size={20} color="#667eea" />
                    <Text style={[styles.dateText, { color: theme.textPrimary }]}>
                      {memoryDate.toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>

                {showDatePicker && (
                  <View style={{ marginBottom: 20 }}>
                    <DateTimePicker
                      value={memoryDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, selectedDate) => {
                        setShowDatePicker(Platform.OS === 'ios');
                        if (selectedDate) {
                          setMemoryDate(selectedDate);
                        }
                      }}
                      maximumDate={new Date()}
                      textColor={theme.textPrimary}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={styles.dateConfirmButton}
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={styles.dateConfirmText}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveButton, uploading && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={uploading}
              >
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveGradient}
                >
                  {uploading ? (
                    <View style={styles.uploadingContainer}>
                      <ActivityIndicator color="#fff" />
                      <Text style={styles.saveButtonText}>
                        Uploading... {Math.round(uploadProgress)}%
                      </Text>
                    </View>
                  ) : (
                    <>
                      <MaterialCommunityIcons name="check" size={20} color="#fff" />
                      <Text style={styles.saveButtonText}>Save Memory</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  mediaPickerContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  mediaOption: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  mediaOptionText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  mediaPreviewContainer: {
    position: 'relative',
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mediaPreview: {
    width: '100%',
    aspectRatio: 4/3,
    borderRadius: 16,
  },
  changeMediaButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
  },
  formContainer: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateText: {
    fontSize: 16,
    marginLeft: 12,
  },
    videoHint: {
    fontSize: 11,
    marginTop: 4,
  },
  dateConfirmButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 12,
  },
  dateConfirmText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});

export default AddMemoryScreen;