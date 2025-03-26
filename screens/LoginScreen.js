import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function LoginScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

 

  return (
    
      <View style={styles.container}>
        <Image source={require('../assets/logo.png')} 
          style={styles.logoImage} />
        <Text style={styles.logo}>Baby Tracker</Text>
        <Text style={styles.title}>LOGIN</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#aaa"
          value={email}
          onChangeText={setEmail} />
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword} />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Text style={styles.showText}>{showPassword ? "Hide" : "Show"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity>
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>
        
        {/*temporary navigation to home after selecting login */}
        <TouchableOpacity style={styles.loginButton}
          onPress={() => navigation.navigate('Home')}>  
          <Text style={styles.loginText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.signupText}>Not a member? Sign up.</Text>
        </TouchableOpacity>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    marginBottom: 20,
  },
  input: {
    width: '80%',
    height: 40,
    backgroundColor: 'white',
    marginBottom: 15,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 5,
    marginBottom: 15,
  },
  passwordInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 10,
  },
  showText: {
    paddingHorizontal: 10,
    color: '#007AFF',
  },
  forgotText: {
    color: '#007AFF',
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 5,
  },
  loginText: {
    fontSize: 18,
  },
  signupText: {
    marginTop: 20,
    color: '#007AFF',
  },
  logoImage: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  
});
