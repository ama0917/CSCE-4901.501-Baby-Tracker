// screens/ManageCaregivers.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getAuth } from 'firebase/auth';
import { db } from '../firebaseConfig';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  arrayRemove,
  deleteField,
} from 'firebase/firestore';

const maskUid = (s = '') => (s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s);

async function lookupEmail(uid) {
  // Try 'Users' then 'users'
  const paths = [['Users', uid], ['users', uid]];
  for (const [col, id] of paths) {
    try {
      const usnap = await getDoc(doc(db, col, id));
      if (usnap.exists()) {
        const e = usnap.data()?.email;
        if (e) return e;
      }
    } catch {
      // ignore and try next
    }
  }
  return null;
}

export default function ManageCaregivers({ navigation }) {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]); // [{ childId, childName, caregivers: [{uid,email,status}] }]

  // Load all children owned by this parent
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'children'), where('userId', '==', uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        (async () => {
          const children = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          const assembled = await Promise.all(
            children.map(async (c) => {
              const list = Array.isArray(c.caregivers) ? c.caregivers : [];
              const perms = c.caregiverPerms || {};
              const careRows = await Promise.all(
                list.map(async (cgUid) => {
                  const email = await lookupEmail(cgUid);
                  const status = perms[cgUid] === 'on' || perms[cgUid] === 'log' ? 'on' : 'off';
                  return { uid: cgUid, email, status };
                })
              );
              return {
                childId: c.id,
                childName: c.name || c.childName || 'Unnamed',
                caregivers: careRows,
              };
            })
          );
          setRows(assembled);
          setLoading(false);
        })();
      },
      (err) => {
        console.error(err);
        setLoading(false);
        Alert.alert('Error', 'Failed to load caregivers.');
      }
    );

    return () => unsub();
  }, [uid]);

  const toggleAccess = async (childId, cgUid, next) => {
    try {
      await updateDoc(doc(db, 'children', childId), {
        [`caregiverPerms.${cgUid}`]: next ? 'on' : 'off',
      });
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update access.');
    }
  };

  const removeCaregiver = async (childId, cgUid) => {
    try {
      await updateDoc(doc(db, 'children', childId), {
        caregivers: arrayRemove(cgUid),
        [`caregiverPerms.${cgUid}`]: deleteField(),
      });
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to remove caregiver.');
    }
  };

  const listEmpty = useMemo(
    () => (
      <Text style={{ color: '#7C8B9A', padding: 12 }}>
        No caregivers yet. Use “Invite a caregiver” below.
      </Text>
    ),
    []
  );

  return (
    <LinearGradient colors={['#E3F2FD', '#FFFFFF']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 16 }}>
          {/* Header (lowered + centered title) */}
          <View style={{ marginTop: 28, marginBottom: 20, height: 44, justifyContent: 'center' }}>
            <Text
              style={{
                fontSize: 22,
                fontWeight: '800',
                color: '#2E3A59',
                textAlign: 'center',
              }}
            >
              Manage Caregivers
            </Text>

            {/* Back (left, vertically centered) */}
            <TouchableOpacity
              onPress={() =>
                navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Settings')
              }
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                justifyContent: 'center',
                paddingHorizontal: 12,
              }}
            >
              <Text style={{ color: '#2E3A59', fontWeight: '700' }}>Back</Text>
            </TouchableOpacity>
          </View>

          {/* Quick invite (closer to top, extra breathing room) */}
          <TouchableOpacity
            onPress={() => navigation.navigate('InviteCaregiver')}
            style={{
              backgroundColor: '#81D4FA',
              padding: 15,
              borderRadius: 12,
              alignItems: 'center',
              marginBottom: 20,
            }}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Invite a caregiver</Text>
          </TouchableOpacity>

          {/* Section title */}
          <Text style={{ color: '#7C8B9A', marginBottom: 10 }}>Children you’ve shared</Text>

          {loading ? (
            <ActivityIndicator />
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item) => item.childId}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              ListEmptyComponent={listEmpty}
              renderItem={({ item }) => (
                <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12 }}>
                  <Text style={{ fontWeight: '700', color: '#2E3A59', marginBottom: 8 }}>
                    {item.childName}
                  </Text>

                  {item.caregivers.length === 0 ? (
                    <Text style={{ color: '#7C8B9A' }}>No caregivers assigned.</Text>
                  ) : (
                    item.caregivers.map((cg) => {
                      const isOn = cg.status === 'on';
                      return (
                        <View
                          key={cg.uid}
                          style={{
                            paddingVertical: 8,
                            borderBottomWidth: 1,
                            borderBottomColor: '#ECEFF1',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          {/* Left: email + masked uid */}
                          <View style={{ flexShrink: 1, paddingRight: 8 }}>
                            <Text
                              style={{ color: '#2E3A59', fontWeight: '600' }}
                              numberOfLines={1}
                            >
                              {cg.email || maskUid(cg.uid)}
                            </Text>
                            {!cg.email ? (
                              <Text style={{ color: '#90A4AE', fontSize: 12 }}>
                                {maskUid(cg.uid)}
                              </Text>
                            ) : null}
                          </View>

                          {/* Center: ON/OFF toggle (pastel green when ON) */}
                          <Switch
                            value={isOn}
                            onValueChange={(val) => toggleAccess(item.childId, cg.uid, val)}
                            trackColor={{ false: '#CFD8DC', true: '#A5D6A7' }}
                            thumbColor="#FFFFFF"
                          />

                          {/* Right: Remove */}
                          <TouchableOpacity
                            onPress={() => removeCaregiver(item.childId, cg.uid)}
                            style={{
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              borderRadius: 8,
                              backgroundColor: '#FFCDD2',
                            }}
                          >
                            <Text style={{ color: '#B71C1C', fontWeight: '700' }}>Remove</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            />
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
