import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';

const BASE_URL = 'http://192.168.1.73:8000'; // Replace with your actual backend URL

// Get new token
const fetchToken = async () => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (user) {
    return await user.getIdToken(true);
  }
  return null;
};

// Axios instance for requests
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject token into every axios request
api.interceptors.request.use(async (config) => {
  const token = await fetchToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    await AsyncStorage.setItem('token', token); // optional
  }
  return config;
}, (error) => Promise.reject(error));

// fetch-based API call for fallback
export const callApi = async (endpoint, method = "GET", body = null) => {
  try {
    const token = await fetchToken();
    const response = await fetch(`${BASE_URL}/${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: body ? JSON.stringify(body) : null
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Request failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
};

// Add child & store returned child ID
export const addChild = async (childData) => {
  const response = await callApi("children/", "POST", childData);
  return response;
};

// Fetch all children
export const getChildren = async () => {
  return await callApi("children/", "GET");
};

// Handle and persist child selection
export const handleAddChild = async (childName, childDOB, setChildId) => {
  try {
    const response = await addChild({ name: childName, dob: childDOB });
    const id = response?.child_id || response?.id;
    if (id) {
      await AsyncStorage.setItem('child_id', id);
      setChildId(id);
    }
  } catch (error) {
    console.error("Error adding child:", error);
  }
};

export default api;