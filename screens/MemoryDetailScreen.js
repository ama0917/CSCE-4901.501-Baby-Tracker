import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, 
  Dimensions, FlatList, StatusBar, Animated, Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import { useDarkMode } from './DarkMode';
import { appTheme } from './ThemedBackground';

const { width, height } = Dimensions.get('window');

const MemoryDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { memory, childName } = route.params;
  const { darkMode } = useDarkMode();
  const theme = darkMode ? appTheme.dark : appTheme.light;
  
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [showUI, setShowUI] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const flatListRef = useRef(null);

  // Handle both old single media and new multi-media formats
  const mediaItems = memory.media 
    ? memory.media.sort((a, b) => a.order - b.order)
    : [{
        mediaUrl: memory.mediaUrl,
        thumbnailUrl: memory.thumbnailUrl,
        mediaType: memory.mediaType,
        order: 0
      }];

  const toggleUI = () => {
    const toValue = showUI ? 0 : 1;
    
    Animated.timing(fadeAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    setShowUI(!showUI);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentMediaIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50
  }).current;

  const renderMediaItem = ({ item }) => (
    <Pressable 
      style={styles.mediaItemContainer}
      onPress={toggleUI}
    >
      {item.mediaType === 'video' ? (
        <Video
          source={{ uri: item.mediaUrl }}
          style={styles.mediaItem}
          useNativeControls
          resizeMode="contain"
          shouldPlay={false}
        />
      ) : (
        <Image 
          source={{ uri: item.mediaUrl }} 
          style={styles.mediaItem}
          resizeMode="contain"
        />
      )}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent />
      
      {/* Media Section - Full Screen */}
      <View style={styles.mediaSection}>
        <FlatList
          ref={flatListRef}
          data={mediaItems}
          renderItem={renderMediaItem}
          keyExtractor={(item, index) => index.toString()}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
        
        {/* Header Overlay - Animated */}
        <Animated.View 
          style={[
            styles.headerOverlay,
            { opacity: fadeAnim }
          ]}
          pointerEvents={showUI ? 'auto' : 'none'}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.8)', 'transparent']}
            style={styles.headerGradient}
          >
            <SafeAreaView edges={['top']}>
              <View style={styles.headerContent}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => navigation.goBack()}
                >
                  <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{childName}</Text>
                <View style={{ width: 40 }} />
              </View>
            </SafeAreaView>
          </LinearGradient>
        </Animated.View>

        {/* Media Counter - Animated */}
        {mediaItems.length > 1 && (
          <Animated.View 
            style={[
              styles.mediaCounter,
              { opacity: fadeAnim }
            ]}
            pointerEvents="none"
          >
            <Text style={styles.mediaCounterText}>
              {currentMediaIndex + 1} / {mediaItems.length}
            </Text>
          </Animated.View>
        )}

        {/* Pagination Dots - Animated */}
        {mediaItems.length > 1 && (
          <Animated.View 
            style={[
              styles.paginationDots,
              { opacity: fadeAnim }
            ]}
            pointerEvents="none"
          >
            {mediaItems.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentMediaIndex && styles.activeDot
                ]}
              />
            ))}
          </Animated.View>
        )}
      </View>

      {/* Content Section - Animated, Swipeable */}
      <Animated.View 
        style={[
          styles.contentSection, 
          { 
            backgroundColor: darkMode ? '#1f1f1f' : '#fff',
            opacity: fadeAnim,
            transform: [{
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [300, 0]
              })
            }]
          }
        ]}
        pointerEvents={showUI ? 'auto' : 'none'}
      >
        {/* Drag Handle */}
        <View style={styles.dragHandle} />

        {/* Date */}
        <View style={styles.dateContainer}>
          <MaterialCommunityIcons name="calendar" size={18} color="#667eea" />
          <Text style={[styles.dateText, { color: theme.textSecondary }]}>
            {memory.date?.toDate().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Text>
        </View>

        {/* Caption */}
        <Text style={[styles.caption, { color: theme.textPrimary }]}>
          {memory.caption}
        </Text>

        {/* Description */}
        {memory.description && (
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {memory.description}
          </Text>
        )}

        {/* Meta Info */}
        <View style={[styles.metaSection, { borderTopColor: darkMode ? '#333' : 'rgba(0,0,0,0.1)' }]}>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons 
              name={mediaItems.length > 1 ? 'image-multiple' : (mediaItems[0].mediaType === 'video' ? 'video' : 'image')} 
              size={16} 
              color={theme.textSecondary} 
            />
            <Text style={[styles.metaText, { color: theme.textSecondary }]}>
              {mediaItems.length > 1 
                ? `${mediaItems.length} items` 
                : (mediaItems[0].mediaType === 'video' ? 'Video' : 'Photo')}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={theme.textSecondary} />
            <Text style={[styles.metaText, { color: theme.textSecondary }]}>
              Added {memory.createdAt?.toDate().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })}
            </Text>
          </View>
        </View>

        {/* Tap to show/hide hint */}
        <Text style={[styles.tapHint, { color: theme.textSecondary }]}>
          Tap screen to {showUI ? 'hide' : 'show'} controls
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mediaSection: {
    flex: 1,
    position: 'relative',
  },
  mediaItemContainer: {
    width: width,
    height: height,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  mediaItem: {
    width: width,
    height: height,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerGradient: {
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  mediaCounter: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  mediaCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  paginationDots: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  activeDot: {
    width: 20,
    backgroundColor: '#fff',
  },
  contentSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: height * 0.4,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '500',
  },
  caption: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 24,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  metaSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
  },
  tapHint: {
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.6,
  },
});

export default MemoryDetailScreen;