import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useDarkMode } from './DarkMode';
import ThemedBackground from './ThemedBackground';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

export default function PediatricianFinder({ navigation }) {
  const { darkMode } = useDarkMode();

  const [pediatricians, setPediatricians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  console.log('==========================================');
  console.log('PediatricianFinder component mounted!');
  console.log('==========================================');

  console.log('Current state:', {
    loading,
    pediatriciansCount: pediatricians.length,
    hasLocation: !!location,
    errorMsg
  });

  useEffect(() => {
    console.log('useEffect triggered!');
    console.log('About to call requestLocationAndSearch...');
    requestLocationAndSearch();
  }, []);

    const requestLocationAndSearch = async () => {
    console.log('🚀 requestLocationAndSearch STARTED');
    
    try {
        setLoading(true);
        console.log('Loading set to true');
        
        // Request location permissions
        console.log('Requesting location permissions...');
        let { status } = await Location.requestForegroundPermissionsAsync();
        console.log('Permission status:', status);
        
        if (status !== 'granted') {
        console.log('❌ Permission denied');
        setErrorMsg('Permission to access location was denied');
        Alert.alert(
            'Location Required',
            'Please enable location services to find nearby pediatricians.',
            [{ text: 'OK' }]
        );
        setLoading(false);
        return;
        }

        console.log('✅ Permission granted, getting location...');
        
        // Get current location
        let currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        });
        
        console.log('📍 Location received:', {
        lat: currentLocation.coords.latitude,
        lng: currentLocation.coords.longitude
        });
        
        setLocation(currentLocation);

        // Search for pediatricians
        console.log('🔍 Calling searchPediatricians...');
        await searchPediatricians(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude
        );
        
        console.log('✅ requestLocationAndSearch COMPLETED');
    } catch (error) {
        console.error('💥 Error in requestLocationAndSearch:', error);
        console.error('Error details:', error.message);
        setErrorMsg('Failed to get location');
        Alert.alert('Error', 'Failed to get your location. Please try again.');
        setLoading(false);
    }
    };

const searchPediatricians = async (latitude, longitude) => {
  try {
    console.log('=== SEARCH DEBUG ===');
    console.log('Location:', latitude, longitude);
    console.log('API Key exists:', !!GOOGLE_PLACES_API_KEY);
    console.log('API Key preview:', GOOGLE_PLACES_API_KEY?.substring(0, 20) + '...');

    // Google Places API Nearby Search
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=5000&type=doctor&keyword=pediatrician&key=${GOOGLE_PLACES_API_KEY}`;
    
    console.log('Making API request...');
    const response = await fetch(url);
    console.log('Response received, status:', response.status);
    
    const data = await response.json();
    console.log('API Response Status:', data.status);
    console.log('Results count:', data.results?.length || 0);
    
    if (data.error_message) {
      console.log('❌ API Error Message:', data.error_message);
    }

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      console.log('✅ Found', data.results.length, 'results');
      
      // Get detailed info for each place
      const detailedPediatricians = await Promise.all(
        data.results.slice(0, 20).map(async (place) => {
          const details = await getPlaceDetails(place.place_id);
          return {
            id: place.place_id,
            name: place.name,
            address: place.vicinity,
            rating: place.rating || 'N/A',
            userRatingsTotal: place.user_ratings_total || 0,
            isOpen: place.opening_hours?.open_now,
            location: place.geometry.location,
            ...details,
          };
        })
      );

      console.log('✅ Processed', detailedPediatricians.length, 'pediatricians');
      setPediatricians(detailedPediatricians);
    } else if (data.status === 'ZERO_RESULTS') {
      console.log('⚠️ ZERO_RESULTS - trying backup search...');
      await searchPediatriciansBackup(latitude, longitude);
    } else if (data.status === 'REQUEST_DENIED') {
      console.log('❌ REQUEST_DENIED - API key issue!');
      Alert.alert(
        'API Error',
        'Google Places API access denied. Please check your API key configuration.\n\nError: ' + (data.error_message || 'Request denied')
      );
    } else {
      console.log('❌ Unexpected status:', data.status);
      console.log('Full response:', JSON.stringify(data, null, 2));
      Alert.alert('No Results', 'No pediatricians found nearby.');
    }
  } catch (error) {
    console.error('💥 Error in searchPediatricians:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    Alert.alert('Error', 'Failed to search for pediatricians: ' + error.message);
  } finally {
    setLoading(false);
  }
};

  const searchPediatriciansBackup = async (latitude, longitude) => {
    try {
        console.log('=== TRYING BACKUP SEARCH ===');
        
        // Try multiple search strategies
        const searches = [
        // Strategy 1: Just "pediatrician" with larger radius
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=10000&keyword=pediatrician&key=${GOOGLE_PLACES_API_KEY}`,
        
        // Strategy 2: "pediatric" instead
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=10000&keyword=pediatric&key=${GOOGLE_PLACES_API_KEY}`,
        
        // Strategy 3: Just doctors, no keyword
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=10000&type=doctor&key=${GOOGLE_PLACES_API_KEY}`,
        
        // Strategy 4: Health category
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=10000&type=health&keyword=children&key=${GOOGLE_PLACES_API_KEY}`,
        ];

        for (let i = 0; i < searches.length; i++) {
        console.log(`Trying search strategy ${i + 1}...`);
        const response = await fetch(searches[i]);
        const data = await response.json();
        
        console.log(`Strategy ${i + 1} status:`, data.status);
        console.log(`Strategy ${i + 1} results:`, data.results?.length || 0);

        if (data.status === 'OK' && data.results && data.results.length > 0) {
            console.log(`✓ Strategy ${i + 1} succeeded!`);
            
            const detailedPediatricians = await Promise.all(
            data.results.slice(0, 20).map(async (place) => {
                const details = await getPlaceDetails(place.place_id);
                return {
                id: place.place_id,
                name: place.name,
                address: place.vicinity,
                rating: place.rating || 'N/A',
                userRatingsTotal: place.user_ratings_total || 0,
                isOpen: place.opening_hours?.open_now,
                location: place.geometry.location,
                ...details,
                };
            })
            );

            setPediatricians(detailedPediatricians);
            return; // Exit after first successful search
        }
        }

        // If all strategies failed
        Alert.alert(
        'No Results', 
        'No pediatricians found in your area. Try:\n\n1. Enabling location services\n2. Moving to a different area\n3. Checking your internet connection'
        );
    } catch (error) {
        console.error('Backup search error:', error);
    }
  };

  const getPlaceDetails = async (placeId) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,website,opening_hours&key=${GOOGLE_PLACES_API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      console.log(`Details for ${placeId}:`, data.status);

      if (data.status === 'OK') {
        return {
          phone: data.result.formatted_phone_number,
          website: data.result.website,
          hours: data.result.opening_hours?.weekday_text,
        };
      }
      return {};
    } catch (error) {
      console.error('Error getting place details:', error);
      return {};
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance.toFixed(1);
  };

  const openDirections = (lat, lng, name) => {
    const scheme = Platform.select({
      ios: 'maps:0,0?q=',
      android: 'geo:0,0?q=',
    });
    const latLng = `${lat},${lng}`;
    const label = name;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    Linking.openURL(url);
  };

  const openWebsite = (website) => {
    if (website) {
      Linking.openURL(website);
    } else {
      Alert.alert('No Website', 'This pediatrician does not have a website listed.');
    }
  };

  const callPhone = (phone) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert('No Phone', 'This pediatrician does not have a phone number listed.');
    }
  };

  const renderPediatrician = ({ item }) => {
    const distance = location
      ? calculateDistance(
          location.coords.latitude,
          location.coords.longitude,
          item.location.lat,
          item.location.lng
        )
      : null;

    return (
      <View style={[styles.card, { backgroundColor: darkMode ? '#1f1f1f' : '#fff' }]}>
        <View style={styles.cardHeader}>
          <View style={styles.nameContainer}>
            <Text style={[styles.name, { color: darkMode ? '#fff' : '#2E3A59' }]}>
              {item.name}
            </Text>
            {item.isOpen !== undefined && (
              <View style={[styles.statusBadge, { backgroundColor: item.isOpen ? '#4CAF50' : '#F44336' }]}>
                <Text style={styles.statusText}>
                  {item.isOpen ? 'Open' : 'Closed'}
                </Text>
              </View>
            )}
          </View>
          
          {item.rating !== 'N/A' && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={16} color="#FFC107" />
              <Text style={[styles.rating, { color: darkMode ? '#fff' : '#333' }]}>
                {item.rating}
              </Text>
              <Text style={[styles.ratingsCount, { color: darkMode ? '#aaa' : '#666' }]}>
                ({item.userRatingsTotal})
              </Text>
            </View>
          )}
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color={darkMode ? '#64b5f6' : '#1976d2'} />
          <Text style={[styles.address, { color: darkMode ? '#ccc' : '#666' }]}>
            {item.address}
          </Text>
        </View>

        {distance && (
          <View style={styles.infoRow}>
            <Ionicons name="navigate-outline" size={16} color={darkMode ? '#64b5f6' : '#1976d2'} />
            <Text style={[styles.distance, { color: darkMode ? '#ccc' : '#666' }]}>
              {distance} miles away
            </Text>
          </View>
        )}

        {item.phone && (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={16} color={darkMode ? '#64b5f6' : '#1976d2'} />
            <Text style={[styles.phone, { color: darkMode ? '#ccc' : '#666' }]}>
              {item.phone}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.directionsButton]}
            onPress={() => openDirections(item.location.lat, item.location.lng, item.name)}
          >
            <Ionicons name="navigate" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Directions</Text>
          </TouchableOpacity>

          {item.phone && (
            <TouchableOpacity
              style={[styles.actionButton, styles.callButton]}
              onPress={() => callPhone(item.phone)}
            >
              <Ionicons name="call" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Call</Text>
            </TouchableOpacity>
          )}

          {item.website && (
            <TouchableOpacity
              style={[styles.actionButton, styles.websiteButton]}
              onPress={() => openWebsite(item.website)}
            >
              <Ionicons name="globe" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Website</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <ThemedBackground>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <LinearGradient
              colors={darkMode ? ['#1f1f1f', '#2c2c2c'] : ['#fff', '#f5f5f5']}
              style={styles.backButtonGradient}
            >
              <Ionicons name="arrow-back" size={20} color={darkMode ? '#fff' : '#2E3A59'} />
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[styles.title, { color: darkMode ? '#fff' : '#2E3A59' }]}>
            Find Pediatricians
          </Text>

          <TouchableOpacity
            onPress={requestLocationAndSearch}
            style={styles.refreshButton}
          >
            <LinearGradient
              colors={darkMode ? ['#1f1f1f', '#2c2c2c'] : ['#fff', '#f5f5f5']}
              style={styles.backButtonGradient}
            >
              <Ionicons name="refresh" size={20} color={darkMode ? '#fff' : '#2E3A59'} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={darkMode ? '#64b5f6' : '#1976d2'} />
            <Text style={[styles.loadingText, { color: darkMode ? '#ccc' : '#666' }]}>
              Finding nearby pediatricians...
            </Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={60} color="#F44336" />
            <Text style={[styles.errorText, { color: darkMode ? '#ccc' : '#666' }]}>
              {errorMsg}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={requestLocationAndSearch}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={pediatricians}
            renderItem={renderPediatrician}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="medical-outline" size={60} color={darkMode ? '#555' : '#ccc'} />
                <Text style={[styles.emptyText, { color: darkMode ? '#ccc' : '#666' }]}>
                  No pediatricians found nearby
                </Text>
              </View>
            }
          />
        )}
      </View>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backButton: {
    borderRadius: 16,
    elevation: 5,
  },
  refreshButton: {
    borderRadius: 16,
    elevation: 5,
  },
  backButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
  },
  loadingText: {
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    marginBottom: 12,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  rating: {
    fontSize: 16,
    fontWeight: '600',
  },
  ratingsCount: {
    fontSize: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  address: {
    fontSize: 14,
    flex: 1,
  },
  distance: {
    fontSize: 14,
    fontWeight: '500',
  },
  phone: {
    fontSize: 14,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
    flex: 1,
    minWidth: 100,
  },
  directionsButton: {
    backgroundColor: '#1976d2',
  },
  callButton: {
    backgroundColor: '#4CAF50',
  },
  websiteButton: {
    backgroundColor: '#FF9800',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 15,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});