import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
  Alert, StatusBar, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import { useDarkMode } from './DarkMode';
import { appTheme } from './ThemedBackground';

const { width } = Dimensions.get('window');

const MemoryDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { memory, childName } = route.params;
  const { darkMode } = useDarkMode();
  const theme = darkMode ? appTheme.dark : appTheme.light;
  
  const [videoStatus, setVideoStatus] = useState({});

  return (
    <>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient
          colors={['rgba(0,0,0,0.8)', 'transparent']}
          style={styles.header}
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

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Media */}
          <View style={styles.mediaSection}>
            {memory.mediaType === 'video' ? (
              <Video
                source={{ uri: memory.mediaUrl }}
                style={styles.media}
                useNativeControls
                resizeMode="contain"
                shouldPlay={false}
                onPlaybackStatusUpdate={status => setVideoStatus(status)}
              />
            ) : (
              <Image source={{ uri: memory.mediaUrl }} style={styles.media} />
            )}
          </View>

          {/* Content */}
          <View style={[styles.contentSection, { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }]}>
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
            <View style={styles.metaSection}>
              <View style={styles.metaItem}>
                <MaterialCommunityIcons 
                  name={memory.mediaType === 'video' ? 'video' : 'image'} 
                  size={16} 
                  color={theme.textSecondary} 
                />
                <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                  {memory.mediaType === 'video' ? 'Video' : 'Photo'}
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
          </View>
        </ScrollView>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
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
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  mediaSection: {
    width: width,
    aspectRatio: 4/3,
    backgroundColor: '#000',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  contentSection: {
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '500',
  },
  caption: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    lineHeight: 30,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  metaSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
  },
});

export default MemoryDetailScreen;