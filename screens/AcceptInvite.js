// screens/AcceptInvite.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { doc, getDoc, setDoc, updateDoc, writeBatch, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';


export default function AcceptInvite({ navigation }) {
  const auth = getAuth();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAccept = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in first.');
      return;
    }
    const trimmed = code.trim();
    if (!trimmed) {
      Alert.alert('Missing code', 'Enter the invite code.');
      return;
    }

    try {
      setSubmitting(true);

      const inviteRef = doc(db, 'invites', trimmed);
      const snap = await getDoc(inviteRef);
      if (!snap.exists()) {
        Alert.alert('Invalid code', 'No invite found for that code.');
        return;
      }

      const invite = snap.data() || {};
      if (invite.status !== 'pending') {
        Alert.alert('Unavailable', `Invite is ${invite.status || 'not pending'}.`);
        return;
      }

      // Support both new (childIds[]) and legacy (childId) formats
      const childIds = Array.isArray(invite.childIds)
        ? invite.childIds
        : invite.childId
        ? [invite.childId]
        : [];

      if (childIds.length === 0) {
        Alert.alert('No children on invite', 'Ask the parent to resend the invite.');
        return;
      }

      const caregiverUid = user.uid;
      const batch = writeBatch(db);

      // Link caregiver to each child with default OFF access (parent must toggle ON)
      for (const cid of childIds) {
        const childRef = doc(db, 'children', cid);
        batch.update(childRef, {
          caregivers: arrayUnion(caregiverUid),
          [`caregiverPerms.${caregiverUid}`]: 'off',
        });
      }

      // Mark invite accepted
      batch.update(inviteRef, {
        status: 'accepted',
        acceptedBy: caregiverUid,
        acceptedAt: serverTimestamp(),
      });

      await batch.commit();
      // Set role if missing (non-destructive)
      try {
        const u = auth.currentUser;
        const userRef = doc(db, 'Users', u.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, { UserType: 'caregiver', email: u.email || null }, { merge: true });
        } else {
          const data = userSnap.data() || {};
          const updates = {};
          if (!data.UserType) updates.UserType = 'caregiver';
          if (!data.email && u.email) updates.email = u.email;
          if (Object.keys(updates).length) await updateDoc(userRef, updates);
        }
      } catch (_) {}

      Alert.alert('Success', 'Invite accepted.');
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] }); // temporary; we can route to a Caregiver Home later
    } catch (e) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to accept invite.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
  <LinearGradient colors={['#E3F2FD', '#FFFFFF']} style={{ flex: 1 }}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
          <View
            style={{
              alignSelf: 'center',
              width: '100%',
              maxWidth: 480,
              backgroundColor: '#fff',
              borderRadius: 12,
              padding: 16,
              // subtle shadow
              shadowColor: '#000',
              shadowOpacity: 0.1,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#2E3A59', marginBottom: 12 }}>
              Accept Invite
            </Text>

            <Text style={{ color: '#7C8B9A', marginBottom: 6 }}>Invite Code</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Enter code"
              placeholderTextColor="#B0BEC5"
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                borderWidth: 1,
                borderColor: '#CFD8DC',
                borderRadius: 10,
                padding: 12,
                marginBottom: 16,
                color: '#2E3A59',
                backgroundColor: '#fff',
              }}
            />

            <TouchableOpacity
              onPress={handleAccept}
              disabled={submitting}
              activeOpacity={0.85}
              style={{
                backgroundColor: '#81D4FA',
                padding: 14,
                borderRadius: 12,
                alignItems: 'center',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Accept</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
              style={{ marginTop: 10, padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#CFD8DC' }}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#2E3A59', fontWeight: '700' }}>Back</Text>
            </TouchableOpacity>

          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  </LinearGradient>
);
}
