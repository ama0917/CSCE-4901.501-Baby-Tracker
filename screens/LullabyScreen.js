import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  Animated,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDarkMode } from './DarkMode';
import { appTheme } from './ThemedBackground';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// Built-in lullabies with working royalty-free URLs
const BUILT_IN_LULLABIES = [
  {
    id: '1',
    title: 'Twinkle Twinkle Little Star',
    artist: 'Lullaby Ensemble',
    duration: 180,
    uri: 'https://cdn.pixabay.com/download/audio/2021/10/20/audio_7b87bb8f9a.mp3?filename=twinkle-twinkle-little-star-116129.mp3',
  },
  {
    id: '2',
    title: 'Brahms Lullaby',
    artist: 'Classical Baby',
    duration: 240,
    uri: 'https://cdn.pixabay.com/download/audio/2022/11/25/audio_12c0d3f4cd.mp3?filename=brahms-lullaby-128206.mp3',
  },
  {
    id: '3',
    title: 'Peaceful Piano',
    artist: 'Sleepy Sounds',
    duration: 200,
    uri: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_4017969e99.mp3?filename=calm-peaceful-ambient-piano-113874.mp3',
  },
  {
    id: '4',
    title: 'Soft Music Box',
    artist: 'Lullaby Dreams',
    duration: 190,
    uri: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=music-box-lullaby-116127.mp3',
  },
];

// Spotify Configuration
const SPOTIFY_CLIENT_ID = 'c0e6b717cf1a45d78fec1a086960ee46';
// For development with Expo Go, use exp://localhost:8081
// For standalone/production builds, use your custom scheme
const SPOTIFY_REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: 'babytracker', // Must match app.json scheme
  // Leave path empty or use 'redirect' - both work
});

const LullabyScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { childId, name } = route.params || {};
  const { darkMode } = useDarkMode();
  const theme = darkMode ? appTheme.dark : appTheme.light;

  // State
  const [mode, setMode] = useState('builtin');
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [spotifyToken, setSpotifyToken] = useState(null);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);

  // Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Spotify Auth Request Hook (must be at top level)
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: SPOTIFY_CLIENT_ID,
      scopes: [
        'user-read-email',
        'playlist-read-private',
        'playlist-read-collaborative',
        'streaming'
      ],
      usePKCE: false,
      redirectUri: SPOTIFY_REDIRECT_URI,
      responseType: AuthSession.ResponseType.Token,
    },
    {
      authorizationEndpoint: 'https://accounts.spotify.com/authorize',
    }
  );

  // Handle Spotify authentication response
  useEffect(() => {
    if (response?.type === 'success') {
      const { access_token } = response.params;
      setSpotifyToken(access_token);
      AsyncStorage.setItem('spotifyAccessToken', access_token);
      fetchSpotifyPlaylists(access_token);
    }
  }, [response]);

  useEffect(() => {
    setupAudio();
    loadSpotifyToken();
    
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    if (isPlaying) {
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Rotate animation
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 10000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    }
  }, [isPlaying]);

  const setupAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Error setting up audio:', error);
    }
  };

  const loadSpotifyToken = async () => {
    try {
      const token = await AsyncStorage.getItem('spotifyAccessToken');
      if (token) {
        setSpotifyToken(token);
        fetchSpotifyPlaylists(token);
      }
    } catch (error) {
      console.error('Error loading Spotify token:', error);
    }
  };

  const authenticateSpotify = async () => {
    try {
      await promptAsync();
    } catch (error) {
      console.error('Spotify auth error:', error);
      Alert.alert('Error', 'Failed to authenticate with Spotify');
    }
  };

  const fetchSpotifyPlaylists = async (token) => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me/playlists', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSpotifyPlaylists(data.items || []);
      } else if (response.status === 401) {
        // Token expired
        setSpotifyToken(null);
        await AsyncStorage.removeItem('spotifyAccessToken');
      }
    } catch (error) {
      console.error('Error fetching Spotify playlists:', error);
    }
  };

  const playBuiltInTrack = async (track) => {
    try {
      setIsLoading(true);

      // Stop current sound if playing
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }
      
      // Load and play new sound
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: track.uri },
        { 
          shouldPlay: true, 
          isLooping: true,
          volume: 1.0,
        },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      setCurrentTrack(track);
      setIsPlaying(true);
    } catch (error) {
      console.error('Error playing track:', error);
      Alert.alert(
        'Playback Error', 
        'Failed to play this lullaby. Please check your internet connection and try another one.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis || 0);
      setDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying || false);
      
      if (status.didJustFinish && !status.isLooping) {
        setIsPlaying(false);
      }
    } else if (status.error) {
      console.error('Playback error:', status.error);
      Alert.alert('Error', 'An error occurred during playback');
      setIsPlaying(false);
    }
  };

  const togglePlayPause = async () => {
    if (!sound) return;

    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  };

  const stopPlayback = async () => {
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch (error) {
        console.error('Error stopping playback:', error);
      }
      setSound(null);
      setCurrentTrack(null);
      setIsPlaying(false);
      setPosition(0);
      setDuration(0);
    }
  };

  const formatTime = (millis) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const renderBuiltInMode = () => (
    <View style={styles.modeContainer}>
      <Text style={[styles.modeTitle, { color: theme.textPrimary }]}>
        Built-in Lullabies
      </Text>
      <Text style={[styles.modeSubtitle, { color: theme.textSecondary }]}>
        Soothing sounds to help {name || 'baby'} sleep
      </Text>

      <ScrollView style={styles.tracksList} showsVerticalScrollIndicator={false}>
        {BUILT_IN_LULLABIES.map((track) => (
          <TouchableOpacity
            key={track.id}
            style={[
              styles.trackItem,
              {
                backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa',
                borderColor: currentTrack?.id === track.id ? '#667eea' : 'transparent',
              },
            ]}
            onPress={() => playBuiltInTrack(track)}
            activeOpacity={0.7}
          >
            <View style={styles.trackImageContainer}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.trackImageGradient}
              >
                <Ionicons name="musical-notes" size={24} color="#fff" />
              </LinearGradient>
            </View>

            <View style={styles.trackInfo}>
              <Text style={[styles.trackTitle, { color: theme.textPrimary }]}>
                {track.title}
              </Text>
              <Text style={[styles.trackArtist, { color: theme.textSecondary }]}>
                {track.artist}
              </Text>
            </View>

            {currentTrack?.id === track.id && isPlaying && (
              <View style={styles.playingIndicator}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <Ionicons name="radio" size={20} color="#667eea" />
                </Animated.View>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderSpotifyMode = () => (
    <View style={styles.modeContainer}>
      <Text style={[styles.modeTitle, { color: theme.textPrimary }]}>
        Spotify Playlists
      </Text>

      {!spotifyToken ? (
        <View style={styles.spotifyConnect}>
          <Ionicons name="logo-spotify" size={64} color="#1DB954" />
          <Text style={[styles.spotifyConnectTitle, { color: theme.textPrimary }]}>
            Connect to Spotify
          </Text>
          <Text style={[styles.spotifyConnectSubtitle, { color: theme.textSecondary }]}>
            Access your personal lullaby playlists
          </Text>

          <TouchableOpacity
            style={styles.spotifyButton}
            onPress={authenticateSpotify}
            activeOpacity={0.8}
            disabled={!request}
          >
            <LinearGradient
              colors={['#1DB954', '#1ed760']}
              style={styles.spotifyButtonGradient}
            >
              <Ionicons name="logo-spotify" size={20} color="#fff" />
              <Text style={styles.spotifyButtonText}>
                {request ? 'Connect Spotify' : 'Loading...'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.spotifyPlaylists}>
          {spotifyPlaylists.length > 0 ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {spotifyPlaylists.map((playlist) => (
                <TouchableOpacity
                  key={playlist.id}
                  style={[
                    styles.trackItem,
                    {
                      backgroundColor: darkMode ? '#2c2c2c' : '#f8f9fa',
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={styles.trackImageContainer}>
                    <LinearGradient
                      colors={['#1DB954', '#1ed760']}
                      style={styles.trackImageGradient}
                    >
                      <Ionicons name="list" size={24} color="#fff" />
                    </LinearGradient>
                  </View>

                  <View style={styles.trackInfo}>
                    <Text style={[styles.trackTitle, { color: theme.textPrimary }]}>
                      {playlist.name}
                    </Text>
                    <Text style={[styles.trackArtist, { color: theme.textSecondary }]}>
                      {playlist.tracks?.total || 0} tracks
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={[styles.comingSoonText, { color: theme.textSecondary }]}>
              No playlists found. Full Spotify playback coming soon!
            </Text>
          )}
        </View>
      )}
    </View>
  );

  const renderNowPlaying = () => {
    if (!currentTrack) return null;

    return (
      <View style={[styles.nowPlaying, { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }]}>
        <View style={styles.nowPlayingHeader}>
          <Text style={[styles.nowPlayingLabel, { color: theme.textSecondary }]}>
            Now Playing
          </Text>
          <TouchableOpacity onPress={stopPlayback} style={styles.stopButton}>
            <Ionicons name="close-circle" size={24} color="#EF5350" />
          </TouchableOpacity>
        </View>

        <View style={styles.nowPlayingContent}>
          <Animated.View
            style={[
              styles.nowPlayingImage,
              { transform: [{ rotate: spin }] },
            ]}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.nowPlayingImageGradient}
            >
              <Ionicons name="musical-notes" size={32} color="#fff" />
            </LinearGradient>
          </Animated.View>

          <View style={styles.nowPlayingInfo}>
            <Text style={[styles.nowPlayingTitle, { color: theme.textPrimary }]}>
              {currentTrack.title}
            </Text>
            <Text style={[styles.nowPlayingArtist, { color: theme.textSecondary }]}>
              {currentTrack.artist}
            </Text>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View
                style={[
                  styles.progressBar,
                  { backgroundColor: darkMode ? '#3c3c3c' : '#e0e0e0' },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: duration > 0 ? `${(position / duration) * 100}%` : '0%',
                      backgroundColor: '#667eea',
                    },
                  ]}
                />
              </View>
              <View style={styles.progressTime}>
                <Text style={[styles.progressTimeText, { color: theme.textSecondary }]}>
                  {formatTime(position)}
                </Text>
                <Text style={[styles.progressTimeText, { color: theme.textSecondary }]}>
                  {formatTime(duration)}
                </Text>
              </View>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={togglePlayPause}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.controlButtonGradient}
                >
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={32}
                    color="#fff"
                  />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: darkMode ? '#2c2c2c' : '#fff' }]}
          >
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerTitle}>
            <Ionicons name="moon" size={24} color={theme.textPrimary} />
            <Text style={[styles.headerTitleText, { color: theme.textPrimary }]}>
              Lullabies
            </Text>
          </View>

          <View style={{ width: 44 }} />
        </View>

        {/* Mode Switcher */}
        <View style={styles.modeSwitcher}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              {
                backgroundColor: mode === 'builtin' 
                  ? '#667eea'
                  : (darkMode ? '#2c2c2c' : '#f8f9fa'),
              },
            ]}
            onPress={() => setMode('builtin')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="musical-notes"
              size={20}
              color={mode === 'builtin' ? '#fff' : theme.textSecondary}
            />
            <Text
              style={[
                styles.modeButtonText,
                { color: mode === 'builtin' ? '#fff' : theme.textSecondary },
              ]}
            >
              Built-in
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeButton,
              {
                backgroundColor: mode === 'spotify'
                  ? '#1DB954'
                  : (darkMode ? '#2c2c2c' : '#f8f9fa'),
              },
            ]}
            onPress={() => setMode('spotify')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="logo-spotify"
              size={20}
              color={mode === 'spotify' ? '#fff' : theme.textSecondary}
            />
            <Text
              style={[
                styles.modeButtonText,
                { color: mode === 'spotify' ? '#fff' : theme.textSecondary },
              ]}
            >
              Spotify
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {mode === 'builtin' ? renderBuiltInMode() : renderSpotifyMode()}
        </ScrollView>

        {/* Now Playing */}
        {renderNowPlaying()}

        {/* Loading Indicator */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={[styles.loadingText, { color: '#fff' }]}>
              Loading lullaby...
            </Text>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitleText: {
    fontSize: 20,
    fontWeight: '700',
  },
  modeSwitcher: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
    gap: 10,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 200,
  },
  modeContainer: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 5,
  },
  modeSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  tracksList: {
    flex: 1,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
  },
  trackImageContainer: {
    marginRight: 12,
  },
  trackImageGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  trackArtist: {
    fontSize: 14,
  },
  playingIndicator: {
    marginLeft: 10,
  },
  spotifyConnect: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  spotifyConnectTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  spotifyConnectSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  spotifyButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  spotifyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 30,
    gap: 10,
  },
  spotifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  spotifyPlaylists: {
    flex: 1,
    paddingTop: 20,
  },
  comingSoonText: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  nowPlaying: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  nowPlayingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  nowPlayingLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stopButton: {
    padding: 4,
  },
  nowPlayingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nowPlayingImage: {
    marginRight: 15,
  },
  nowPlayingImageGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowPlayingInfo: {
    flex: 1,
  },
  nowPlayingTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  nowPlayingArtist: {
    fontSize: 14,
    marginBottom: 10,
  },
  progressContainer: {
    marginBottom: 10,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressTime: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressTimeText: {
    fontSize: 11,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  controlButton: {
    borderRadius: 30,
    overflow: 'hidden',
  },
  controlButtonGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LullabyScreen;