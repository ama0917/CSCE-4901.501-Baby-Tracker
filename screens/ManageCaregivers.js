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
  StyleSheet,
  StatusBar,
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
import { useDarkMode } from '../screens/DarkMode';
import ThemedBackground, { appTheme } from '../screens/ThemedBackground';
import { ArrowLeft } from 'lucide-react-native';

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
 const resolveTheme = (darkMode) => {
   const t = typeof appTheme === 'function'
     ? appTheme(darkMode)
     : (darkMode ? appTheme?.dark : appTheme?.light) || appTheme;

   const colors = t?.colors || {};
   return {
     text:        colors.text        ?? (darkMode ? '#FFFFFF' : '#2E3A59'),
     textMuted:   colors.muted       ?? (darkMode ? '#B0BEC5' : '#7C8B9A'),
     textStrong:  colors.textStrong  ?? (darkMode ? '#FFFFFF' : '#2E3A59'),
     cardBg:      colors.card        ?? (darkMode ? '#1c2433' : '#FFFFFF'),
     border:      colors.border      ?? (darkMode ? '#2a3547' : '#ECEFF1'),
     accent:      colors.accent      ?? (darkMode ? '#7CC8FF' : '#81D4FA'),
     divider:     colors.divider     ?? (darkMode ? '#2a3547' : '#E0E6EA'),
     backText:    colors.backText    ?? (darkMode ? '#FFFFFF' : '#2E3A59'),
    // gradient used for the arrow pill (use theme if present)
    cardGrad:    t?.gradients?.card ?? (darkMode ? ['#121a2d', '#182235'] : ['#ffffff', '#f5f5f5']),

     // Buttons
     inviteGrad:  t?.gradients?.primary ?? (darkMode ? ['#3ea2ff', '#6bc1ff'] : ['#81D4FA', '#81D4FA']),
     inviteText:  colors.inviteText  ?? (darkMode ? '#0b1220' : '#FFFFFF'),
     dangerBg:    colors.dangerBg    ?? (darkMode ? '#4A1F27' : '#FFCDD2'),
     dangerText:  colors.dangerText  ?? (darkMode ? '#FF8A80' : '#B71C1C'),

     // Switch
     switchTrackOff: colors.switchTrackOff ?? (darkMode ? '#3a4252' : '#CFD8DC'),
     switchTrackOn:  colors.switchTrackOn  ?? (darkMode ? '#4CAF50' : '#A5D6A7'),
     switchThumb:    colors.switchThumb    ?? (darkMode ? '#E6EEF6' : '#FFFFFF'),
   };
 };

export default function ManageCaregivers({ navigation }) {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;

  const { darkMode } = useDarkMode();
  const C = useMemo(() => resolveTheme(darkMode), [darkMode]);
  
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
      <Text style={{ color: C.textMuted, padding: 12 }}>
        No caregivers yet. Use “Invite a caregiver” below.
      </Text>
    ),
    [C.textMuted]
  );

  return (
      <ThemedBackground>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 16 }}>
          {/* Header (matches Diaper screen with arrow pill) */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() =>
                navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Settings')
              }
              style={styles.headerButton}
              activeOpacity={0.9}
            >
              <LinearGradient colors={C.cardGrad} style={styles.headerButtonGradient}>
                <ArrowLeft size={20} color={darkMode ? '#fff' : C.textStrong} />
              </LinearGradient>
            </TouchableOpacity>

            <Text style={[styles.headerTitle, { color: C.textStrong }]}>
              Manage Caregivers
            </Text>

            {/* Right spacer to balance the arrow width */}
            <View style={{ width: 44 }} />
          </View>

          {/* Quick invite */}
          <TouchableOpacity
            onPress={() => navigation.navigate('InviteCaregiver')}
            activeOpacity={0.9}
            style={{ borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={C.inviteGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ padding: 15, alignItems: 'center' }}
            >
              <Text style={{ color: C.inviteText, fontWeight: '700' }}>
                Invite a caregiver
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Section title */}
          <Text style={{ color: C.textMuted, marginBottom: 10 }}>Children you’ve shared</Text>

          {loading ? (
            <ActivityIndicator size="small" color={C.accent} />
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item) => item.childId}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              ListEmptyComponent={listEmpty}
              renderItem={({ item }) => (
                <View
                  style={{
                    backgroundColor: C.cardBg,
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: darkMode ? 'transparent' : C.border,
                  }}
                >
                  <Text style={{ fontWeight: '700', color: C.textStrong, marginBottom: 8 }}>
                    {item.childName}
                  </Text>

                  {item.caregivers.length === 0 ? (
                    <Text style={{ color: C.textMuted }}>No caregivers assigned.</Text>
                  ) : (
                    item.caregivers.map((cg, idx) => {
                      const isOn = cg.status === 'on';
                      const showDivider = idx < item.caregivers.length - 1;
                      return (
                        <View
                          key={cg.uid}
                          style={{
                            paddingVertical: 8,
                            borderBottomWidth: showDivider ? 1 : 0,
                            borderBottomColor: C.divider,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          {/* Left: email + masked uid */}
                          <View style={{ flexShrink: 1, paddingRight: 8 }}>
                            <Text style={{ color: C.textStrong, fontWeight: '600' }} numberOfLines={1}>
                              {cg.email || maskUid(cg.uid)}
                            </Text>
                            {!cg.email ? (
                              <Text style={{ color: C.textMuted, fontSize: 12 }}>
                                {maskUid(cg.uid)}
                              </Text>
                            ) : null}
                          </View>

                          {/* Center: ON/OFF toggle */}
                          <Switch
                            value={isOn}
                            onValueChange={(val) => toggleAccess(item.childId, cg.uid, val)}
                            trackColor={{ false: C.switchTrackOff, true: C.switchTrackOn }}
                            thumbColor={C.switchThumb}
                          />

                          {/* Right: Remove */}
                          <TouchableOpacity
                            onPress={() => removeCaregiver(item.childId, cg.uid)}
                            style={{
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              borderRadius: 8,
                              backgroundColor: C.dangerBg,
                            }}
                          >
                            <Text style={{ color: C.dangerText, fontWeight: '700' }}>Remove</Text>
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
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: 28,
    marginBottom: 20,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  headerButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 1,
  },
})