import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  Alert, ScrollView, Platform, ActivityIndicator, StatusBar, FlatList,
  KeyboardAvoidingView, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Video } from 'expo-av';
import NetInfo from '@react-native-community/netinfo';
import { useDarkMode } from './DarkMode';
import { appTheme } from './ThemedBackground';
import MilestoneSelector from './MilestoneSelector';
import { 
  uploadMedia, 
  generateMemoryPath, 
  generateVideoThumbnail 
} from '../src/utils/imageUpload';
import { 
  saveToOfflineQueue, 
  checkAndProcessQueue 
} from '../src/utils/offlineQueue';

const MAX_MEDIA_ITEMS = 3;

const AddMemoryScreen = () => {
  const INPUT_ACCESSORY_VIEW_ID = 'memoryInputAccessory';
  const navigation = useNavigation();
  const route = useRoute();
  const { childId, childName } = route.params;
  const { darkMode } = useDarkMode();
  const theme = darkMode ? appTheme.dark : appTheme.light;
  const [milestone, setMilestone] = useState(null);
  const [showMilestoneSelector, setShowMilestoneSelector] = useState(false);

  const [mediaItems, setMediaItems] = useState([]); // Array of {uri, type: 'photo'|'video'}
  const [caption, setCaption] = useState('');
  const [description, setDescription] = useState('');
  const [memoryDate, setMemoryDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  
  const scrollViewRef = useRef(null);
  const descriptionInputRef = useRef(null);
  
  const db = getFirestore();
  const auth = getAuth();

  const pickMedia = async (type, useCamera = false) => {
      if (mediaItems.length >= MAX_MEDIA_ITEMS) {
        Alert.alert(
          'Maximum Reached',
          `You can only add up to ${MAX_MEDIA_ITEMS} photos or videos per memory.`
        );
        return;
      }

      try {
        // Request appropriate permissions
        const permissionResult = useCamera 
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
          
        if (!permissionResult.granted) {
          Alert.alert(
            'Permission Required', 
            `Please grant ${useCamera ? 'camera' : 'media library'} permissions.`
          );
          return;
        }

        const options = {
          mediaTypes: type === 'photo' 
            ? ImagePicker.MediaTypeOptions.Images 
            : ImagePicker.MediaTypeOptions.Videos,
          allowsEditing: true,
          quality: 0.8,
        };

        if (type === 'photo') {
          options.aspect = [4, 3];
        }

        if (type === 'video') {
          options.videoMaxDuration = 120;
        }

        const result = useCamera
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

        if (!result.canceled) {
          const asset = result.assets[0];
          
          // Validate video duration
          if (type === 'video' && asset.duration) {
            const durationInSeconds = asset.duration / 1000;
            
            if (durationInSeconds > 120) {
              Alert.alert(
                'Video Too Long',
                `Please select a video that is 2 minutes or shorter.\n\nSelected: ${Math.round(durationInSeconds)} seconds`
              );
              return;
            }
          }
          
          setMediaItems([...mediaItems, { uri: asset.uri, type }]);
        }
      } catch (error) {
        console.error('Error picking media:', error);
        Alert.alert('Error', 'Failed to pick media. Please try again.');
      }
    };


  const showMediaOptions = (type) => {
    Alert.alert(
      `Add ${type === 'photo' ? 'Photo' : 'Video'}`,
      'Choose source',
      [
        {
          text: 'Take Now',
          onPress: () => pickMedia(type, true)
        },
        {
          text: 'Choose from Library',
          onPress: () => pickMedia(type, false)
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };  

  const removeMedia = (index) => {
    setMediaItems(mediaItems.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (mediaItems.length === 0) {
      Alert.alert('Missing Media', 'Please add at least one photo or video.');
      return;
    }

    if (!caption.trim()) {
      Alert.alert('Missing Caption', 'Please add a caption for this memory.');
      return;
    }

    // Check network status
    const netInfo = await NetInfo.fetch();
    setIsOffline(!netInfo.isConnected);

    if (!netInfo.isConnected) {
      // Save to offline queue
      Alert.alert(
        'No Internet Connection',
        'Your memory will be saved locally and uploaded when you reconnect to the internet.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save Offline',
            onPress: async () => {
              try {
                setUploading(true);
                const currentUser = auth.currentUser;

                await saveToOfflineQueue({
                  childId,
                  userId: currentUser.uid,
                  mediaItems,
                  caption: caption.trim(),
                  description: description.trim(),
                  memoryDate: memoryDate.toISOString(),
                });

                Alert.alert(
                  'Saved Offline',
                  'Your memory has been saved and will upload automatically when you reconnect.',
                  [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
              } catch (error) {
                console.error('Error saving offline:', error);
                Alert.alert('Error', 'Failed to save memory offline.');
              } finally {
                setUploading(false);
              }
            }
          }
        ]
      );
      return;
    }

    // Upload normally if online
    try {
      setUploading(true);
      const currentUser = auth.currentUser;

      // Upload all media items
      const uploadedMedia = [];
      let totalProgress = 0;
      
      for (let i = 0; i < mediaItems.length; i++) {
        const item = mediaItems[i];
        const baseProgress = (i / mediaItems.length) * 100;
        
        // Upload media
        const mediaPath = generateMemoryPath(childId, item.type);
        const mediaUrl = await uploadMedia(mediaPath, item.uri, (progress) => {
          const itemProgress = (progress / mediaItems.length);
          setUploadProgress(baseProgress + itemProgress);
        });

        // Generate thumbnail for videos
        let thumbnailUrl = null;
        if (item.type === 'video') {
          const thumbnailUri = await generateVideoThumbnail(item.uri);
          if (thumbnailUri) {
            const thumbnailPath = generateMemoryPath(childId, 'photo');
            thumbnailUrl = await uploadMedia(thumbnailPath, thumbnailUri);
          }
        }

        uploadedMedia.push({
          mediaUrl,
          thumbnailUrl,
          mediaType: item.type,
          order: i,
        });
      }

      // Save to Firestore
      await addDoc(collection(db, 'memories'), {
        childId,
        userId: currentUser.uid,
        media: uploadedMedia,
        caption: caption.trim(),
        description: description.trim(),
        date: Timestamp.fromDate(memoryDate),
        milestone: milestone ? {
          id: milestone.id,
          label: milestone.label,
          icon: milestone.icon
        } : null,
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

  const renderMediaItem = ({ item, index }) => (
    <View style={styles.mediaItemContainer}>
      {item.type === 'photo' ? (
        <Image source={{ uri: item.uri }} style={styles.mediaItemPreview} />
      ) : (
        <View style={styles.videoItemContainer}>
          <Video
            source={{ uri: item.uri }}
            style={styles.mediaItemPreview}
            resizeMode="cover"
            shouldPlay={false}
          />
          <View style={styles.videoIndicator}>
            <MaterialCommunityIcons name="play-circle" size={32} color="#fff" />
          </View>
        </View>
      )}
      <TouchableOpacity
        style={styles.removeMediaButton}
        onPress={() => removeMedia(index)}
      >
        <MaterialCommunityIcons name="close-circle" size={24} color="#fff" />
      </TouchableOpacity>
      <View style={styles.mediaIndexBadge}>
        <Text style={styles.mediaIndexText}>{index + 1}</Text>
      </View>
    </View>
  );

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
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                <ScrollView 
                    ref={scrollViewRef}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    onScrollBeginDrag={() => Keyboard.dismiss()}
                >
              {/* Media Picker/Gallery */}
              {mediaItems.length === 0 ? (
                <View style={styles.mediaPickerContainer}>
                  <TouchableOpacity
                    style={[styles.mediaOption, { backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa' }]}
                    onPress={() => showMediaOptions('photo')}
                  >
                    <MaterialCommunityIcons name="camera" size={40} color="#667eea" />
                    <Text style={[styles.mediaOptionText, { color: theme.textPrimary }]}>
                      Add Photo
                    </Text>
                    <Text style={[styles.videoHint, { color: theme.textSecondary }]}>
                      Camera or Library
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.mediaOption, { backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa' }]}
                    onPress={() => showMediaOptions('video')}
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
                <View style={styles.mediaGalleryContainer}>
                  <FlatList
                    data={mediaItems}
                    renderItem={renderMediaItem}
                    keyExtractor={(item, index) => index.toString()}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.mediaGallery}
                  />
                  
                  {mediaItems.length < MAX_MEDIA_ITEMS && (
                    <View style={styles.addMoreContainer}>
                      <TouchableOpacity
                        style={[styles.addMoreButton, { backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa' }]}
                        onPress={() => showMediaOptions('photo')}
                      >
                        <MaterialCommunityIcons name="camera-plus" size={24} color="#667eea" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.addMoreButton, { backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa' }]}
                        onPress={() => showMediaOptions('video')}
                      >
                        <MaterialCommunityIcons name="video-plus" size={24} color="#667eea" />
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  <Text style={[styles.mediaCountText, { color: theme.textSecondary }]}>
                    {mediaItems.length} / {MAX_MEDIA_ITEMS} items
                  </Text>
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
                    returnKeyType="Return"
                    onSubmitEditing={() => descriptionInputRef.current?.focus()}
                    />
                  <Text style={styles.charCount}>{caption.length}/100</Text>
                </View>

                {/* Milestone */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Milestone (Optional)
                  </Text>
                  <TouchableOpacity
                    style={[styles.milestoneButton, { 
                      backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa',
                      borderColor: milestone ? '#667eea' : (darkMode ? '#444' : '#e9ecef')
                    }]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setShowMilestoneSelector(true);
                    }}
                  >
                    {milestone ? (
                      <>
                        <MaterialCommunityIcons name={milestone.icon} size={20} color="#667eea" />
                        <Text style={[styles.milestoneText, { color: theme.textPrimary }]}>
                          {milestone.label}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setMilestone(null)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <MaterialCommunityIcons name="close-circle" size={20} color="#999" />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <MaterialCommunityIcons name="star-outline" size={20} color="#667eea" />
                        <Text style={[styles.milestonePlaceholder, { color: theme.textSecondary }]}>
                          Add a milestone
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
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
                    returnKeyType="Return"
                    blurOnSubmit={true}
                    onSubmitEditing={() => Keyboard.dismiss()}
                    onFocus={() => {
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
                        {isOffline ? 'Saving...' : `Uploading... ${Math.round(uploadProgress)}%`}
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

              {/* Milestone Selector Modal */}
              <MilestoneSelector
                visible={showMilestoneSelector}
                onClose={() => setShowMilestoneSelector(false)}
                onSelect={setMilestone}
                darkMode={darkMode}
              />
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
  videoHint: {
    fontSize: 11,
    marginTop: 4,
  },
  mediaGalleryContainer: {
    marginBottom: 20,
  },
  mediaGallery: {
    gap: 12,
    paddingVertical: 8,
  },
  mediaItemContainer: {
    position: 'relative',
    width: 200,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mediaItemPreview: {
    width: '100%',
    height: '100%',
  },
  videoItemContainer: {
    position: 'relative',
  },
  videoIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  removeMediaButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
  },
  mediaIndexBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#667eea',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaIndexText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  addMoreContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  addMoreButton: {
    width: 60,
    height: 60,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  mediaCountText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
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
  milestoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  milestoneText: {
    fontSize: 16,
    flex: 1,
  },
  milestonePlaceholder: {
    fontSize: 16,
    flex: 1,
  },
});

export default AddMemoryScreen;