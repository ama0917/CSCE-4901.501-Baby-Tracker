import axios from "axios";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';

const BASE_URL = "http://192.168.4.67:8000"; // Replace with your backend URL

// Function to fetch a new token
const fetchToken = async () => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (user) {
    return await user.getIdToken(true); // Force refresh
  }
  return null;
};

// Set up an Axios instance
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add an interceptor to include the Firebase token in requests
api.interceptors.request.use(async (config) => {
  const token = await fetchToken(); // Fetch a new token on every request
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    // Optionally store the refreshed token in AsyncStorage
    await AsyncStorage.setItem('token', token);
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Function to call API using fetch
export const callApi = async (endpoint, method = "GET", body = null) => {
  const token = await fetchToken(); // Fetch a new token for fetch requests
  const response = await fetch(`${BASE_URL}/${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: body ? JSON.stringify(body) : null
  });
  return response.json();
};

// Add a child
export const addChild = async (childData) => {
  return await callApi("children/", "POST", childData);
};

// Get all children
export const getChildren = async () => {
  return await callApi("children/", "GET");
};

export default api;