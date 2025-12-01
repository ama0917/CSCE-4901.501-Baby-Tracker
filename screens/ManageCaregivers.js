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
  Image,
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
import { Ionicons } from '@expo/vector-icons';
import { useDarkMode } from '../screens/DarkMode';
import ThemedBackground, { appTheme } from '../screens/ThemedBackground';
import { ArrowLeft } from 'lucide-react-native';

const PERMISSION_LEVELS = {
  NONE: 'none',
  LOG: 'log',
  PARENT: 'parent'
};

const getPermissionLevel = (perms, cgUid) => {
  const perm = perms[cgUid];
  if (perm === 'parent') return PERMISSION_LEVELS.PARENT;
  if (perm === 'on' || perm === 'log') return PERMISSION_LEVELS.LOG;
  return PERMISSION_LEVELS.NONE;
};

const getNextPermissionLevel = (currentLevel) => {
  switch(currentLevel) {
    case PERMISSION_LEVELS.NONE:
      return PERMISSION_LEVELS.LOG;
    case PERMISSION_LEVELS.LOG:
      return PERMISSION_LEVELS.PARENT;
    case PERMISSION_LEVELS.PARENT:
      return PERMISSION_LEVELS.NONE;
    default:
      return PERMISSION_LEVELS.NONE;
  }
};


const getPermissionLabel = (level) => {
  switch(level) {
    case PERMISSION_LEVELS.NONE:
      return 'No Access';
    case PERMISSION_LEVELS.LOG:
      return 'Can Log';
    case PERMISSION_LEVELS.PARENT:
      return 'Full Parent';
    default:
      return 'Unknown';
  }
};

const getPermissionColor = (level, darkMode) => {
  switch(level) {
    case PERMISSION_LEVELS.NONE:
      return darkMode ? '#666' : '#999';
    case PERMISSION_LEVELS.LOG:
      return '#4CAF50';
    case PERMISSION_LEVELS.PARENT:
      return '#FF9800';
    default:
      return '#999';
  }
};

const getPermissionIcon = (level) => {
  switch(level) {
    case PERMISSION_LEVELS.NONE:
      return 'close-circle';
    case PERMISSION_LEVELS.VIEW:
      return 'eye';
    case PERMISSION_LEVELS.LOG:
      return 'create';
    case PERMISSION_LEVELS.PARENT:
      return 'star';
    default:
      return 'help-circle';
  }
};

const maskUid = (s = '') =>
  s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;

async function lookupEmail(uid) {
  // Try 'Users' then 'users'
  const paths = [
    ['Users', uid],
    ['users', uid],
  ];
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
  const t =
    typeof appTheme === 'function'
      ? appTheme(darkMode)
      : (darkMode ? appTheme?.dark : appTheme?.light) || appTheme;

  const colors = t?.colors || {};
  return {
    text: colors.text ?? (darkMode ? '#FFFFFF' : '#2E3A59'),
    textMuted: colors.muted ?? (darkMode ? '#B0BEC5' : '#7C8B9A'),
    textStrong: colors.textStrong ?? (darkMode ? '#FFFFFF' : '#2E3A59'),
    cardBg: colors.card ?? (darkMode ? '#0F172A' : '#FFFFFF'),
    border: colors.border ?? (darkMode ? '#1E293B' : '#E0E6EA'),
    accent: colors.accent ?? (darkMode ? '#7CC8FF' : '#81D4FA'),
    divider: colors.divider ?? (darkMode ? '#1E293B' : '#E5E7EB'),
    backText: colors.backText ?? (darkMode ? '#FFFFFF' : '#2E3A59'),

    cardGrad:
      t?.gradients?.card ??
      (darkMode ? ['#020617', '#0B1220'] : ['#FFFFFF', '#EEF5FF']),

    inviteGrad:
      t?.gradients?.primary ??
      (darkMode ? ['#38BDF8', '#6366F1'] : ['#81D4FA', '#81D4FA']),
    inviteText: colors.inviteText ?? (darkMode ? '#0B1220' : '#FFFFFF'),

    dangerBg: colors.dangerBg ?? (darkMode ? '#3F1D2B' : '#FFEBEE'),
    dangerText: colors.dangerText ?? (darkMode ? '#FF8A80' : '#C62828'),

    switchTrackOff: colors.switchTrackOff ?? (darkMode ? '#1E293B' : '#CFD8DC'),
    switchTrackOn: colors.switchTrackOn ?? (darkMode ? '#22C55E' : '#A5D6A7'),
    switchThumb: colors.switchThumb ?? (darkMode ? '#E5E7EB' : '#FFFFFF'),
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
    if (!uid) {
      setRows([]);
      setLoading(false);
      return;
    }
    
    const q = query(collection(db, 'children'), where('userId', '==', uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        (async () => {
          const children = snap.docs.map((d) => ({ 
            id: d.id, 
            ...d.data() 
          }));
          
          const assembled = await Promise.all(
            children.map(async (c) => {
              const list = Array.isArray(c.caregivers) ? c.caregivers : [];
              const perms = c.caregiverPerms || {};
              
              const careRows = await Promise.all(
                list.map(async (cgUid) => {
                  const email = await lookupEmail(cgUid);
                  
                  // Determine permission level
                  const perm = perms[cgUid];
                  let status = 'none';
                  if (perm === 'parent') status = 'parent';
                  else if (perm === 'on' || perm === 'log') status = 'log';
                  else if (perm === 'view') status = 'log';
                  else status = 'none';
                  
                  return { uid: cgUid, email, status };
                })
              );
              
              const profileImage = c.image || c.profileImage || c.photoURL || null;

              return {
                childId: c.id,
                childName: c.name || c.childName || 'Unnamed',
                profileImage,
                caregivers: careRows,
                child: c, // Include full child data for permissions
              };
            })
          );
          
          setRows(assembled);
          setLoading(false);
        })().catch((e) => {
          console.error('assemble children error', e);
          setLoading(false);
          Alert.alert('Error', 'Failed to load caregivers.');
        });
      },
      (err) => {
        console.error(err);
        setLoading(false);
        Alert.alert('Error', 'Failed to load caregivers.');
      }
    );

    return () => unsub();
  }, [uid]);

const toggleAccess = async (childId, cgUid, currentLevel) => {
  const nextLevel = getNextPermissionLevel(currentLevel);
  
  // Show confirmation for parent privileges
  if (nextLevel === PERMISSION_LEVELS.PARENT) {
    Alert.alert(
      'Grant Full Parent Privileges?',
      'This caregiver will have the same access as you, including:\n\n• Managing other caregivers\n• Editing child profiles\n• Deleting data\n• Viewing reports\n\nAre you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Grant Access',
          style: 'default',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'children', childId), {
                [`caregiverPerms.${cgUid}`]: 'parent',
              });
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to update permissions.');
            }
          }
        }
      ]
    );
    return;
  }
  
  // Show confirmation for revoking all access
  if (nextLevel === PERMISSION_LEVELS.NONE) {
    Alert.alert(
      'Revoke All Access?',
      'This caregiver will no longer be able to view or log activities for this child.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'children', childId), {
                [`caregiverPerms.${cgUid}`]: 'none',
              });
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to update permissions.');
            }
          }
        }
      ]
    );
    return;
  }
  
  // For view and log, just update directly
  try {
    await updateDoc(doc(db, 'children', childId), {
      [`caregiverPerms.${cgUid}`]: nextLevel,
    });
  } catch (e) {
    Alert.alert('Error', e.message || 'Failed to update permissions.');
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
      <View style={styles.emptyState}>
        <Text style={[styles.emptyTitle, { color: C.textStrong }]}>
          No caregivers yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: C.textMuted }]}>
          Invite trusted family members or caregivers to help keep your baby’s
          log up to date.
        </Text>
      </View>
    ),
    [C.textStrong, C.textMuted]
  );
  

  return (
    <ThemedBackground>
      <StatusBar
        barStyle={darkMode ? 'light-content' : 'dark-content'}
        translucent
      />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.screenPadding}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() =>
                navigation.canGoBack()
                  ? navigation.goBack()
                  : navigation.navigate('Settings')
              }
              style={styles.headerButton}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={C.cardGrad}
                style={styles.headerButtonGradient}
              >
                <ArrowLeft size={20} color={darkMode ? '#FFFFFF' : '#2E3A59'} />
              </LinearGradient>
            </TouchableOpacity>

            <Text style={[styles.headerTitle, { color: C.textStrong }]}>
              Manage Caregivers
            </Text>

            {/* Right spacer */}
            <View style={{ width: 44 }} />
          </View>

          {/* Intro text */}
          <View style={styles.introBlock}>
            <Text style={[styles.introTitle, { color: C.textStrong }]}>
              Share your baby’s dashboard
            </Text>
            <Text style={[styles.introSubtitle, { color: C.textMuted }]}>
              Control who can view and log activities for each child.
            </Text>
          </View>

          {/* Invite button */}
          <TouchableOpacity
            onPress={() => navigation.navigate('InviteCaregiver')}
            activeOpacity={0.9}
            style={styles.inviteWrapper}
          >
            <LinearGradient
              colors={C.inviteGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.inviteGradient}
            >
              <Text style={[styles.inviteText, { color: C.inviteText }]}>
                Invite a caregiver
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Section label */}
          <Text style={[styles.sectionLabel, { color: C.textMuted }]}>
            Children you’ve shared
          </Text>

          {loading ? (
            <ActivityIndicator size="small" color={C.accent} />
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item) => item.childId}
              ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
              ListEmptyComponent={listEmpty}
              contentContainerStyle={{ paddingBottom: 32 }}
              renderItem={({ item }) => (
                <LinearGradient
                  colors={C.cardGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.childCard}
                >
                  <View style={styles.childHeaderRow}>
                  {item.profileImage ? (
                    <Image
                      source={{ uri: item.profileImage }}
                      style={styles.childAvatarImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.childAvatar}>
                      <Text style={styles.childAvatarText}>
                        {item.childName?.[0]?.toUpperCase?.() || '?'}
                      </Text>
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.childName, { color: C.textStrong }]}
                      numberOfLines={1}
                    >
                      {item.childName}
                    </Text>
                    <Text
                      style={[styles.childSubtitle, { color: C.textMuted }]}
                    >
                      {item.caregivers.length} caregiver
                      {item.caregivers.length === 1 ? '' : 's'} connected
                    </Text>
                  </View>
                </View>

                {item.caregivers.length === 0 ? (
                  <Text style={[styles.noCaregiverText, { color: C.textMuted }]}>
                    No caregivers assigned yet.
                  </Text>
                ) : (
                  item.caregivers.map((cg, idx) => {
                    const permLevel = getPermissionLevel(
                      item.child?.caregiverPerms || {},
                      cg.uid
                    );
                    const showDivider = idx < item.caregivers.length - 1;

                    return (
                      <View
                        key={cg.uid}
                        style={[
                          styles.caregiverRow,
                          showDivider && {
                            borderBottomWidth: 1,
                            borderBottomColor: C.divider,
                          },
                        ]}
                      >
                        {/* Email + uid */}
                        <View style={styles.caregiverInfo}>
                          <Text
                            style={[styles.caregiverEmail, { color: C.textStrong }]}
                            numberOfLines={1}
                          >
                            {cg.email || maskUid(cg.uid)}
                          </Text>
                          {!cg.email ? (
                            <Text
                              style={[styles.caregiverUid, { color: C.textMuted }]}
                              numberOfLines={1}
                            >
                              {maskUid(cg.uid)}
                            </Text>
                          ) : null}
                        </View>

                        {/* Triple Toggle Permission Button */}
                        <TouchableOpacity
                          onPress={() => toggleAccess(item.childId, cg.uid, permLevel)}
                          style={[
                            styles.permissionButton,
                            {
                              backgroundColor: getPermissionColor(permLevel, darkMode) + '20',
                              borderColor: getPermissionColor(permLevel, darkMode),
                            }
                          ]}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={getPermissionIcon(permLevel)}
                            size={16}
                            color={getPermissionColor(permLevel, darkMode)}
                          />
                          <Text
                            style={[
                              styles.permissionText,
                              { color: getPermissionColor(permLevel, darkMode) }
                            ]}
                          >
                            {getPermissionLabel(permLevel)}
                          </Text>
                          <Ionicons
                            name="chevron-forward"
                            size={14}
                            color={getPermissionColor(permLevel, darkMode)}
                          />
                        </TouchableOpacity>

                        {/* Permission Description */}
                        <Text
                          style={[
                            styles.permissionDescription,
                            { color: C.textMuted }
                          ]}
                        >
                          {permLevel === PERMISSION_LEVELS.NONE && 'No access to this child'}
                          {permLevel === PERMISSION_LEVELS.LOG && 'Can view and log activities'}
                          {permLevel === PERMISSION_LEVELS.PARENT && 'Full parent access'}
                        </Text>

                        {/* Remove button */}
                      <TouchableOpacity
                        onPress={() => removeCaregiver(item.childId, cg.uid)}
                        style={[
                          styles.removeButton,
                          { backgroundColor: C.dangerBg, flexDirection: 'row', alignItems: 'center' },
                        ]}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="trash-outline" size={14} color={C.dangerText} />
                        <Text style={[styles.removeText, { color: C.dangerText, marginLeft: 5 }]}>
                          Remove
                        </Text>
                      </TouchableOpacity>
                      </View>
                    );
                  })
                )}
                </LinearGradient>
              )}
            />
          )}
        </View>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  screenPadding: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },

  // Header
  header: {
    marginTop: 20,
    marginBottom: 18,
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

  // Intro
  introBlock: {
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  introSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Invite
  inviteWrapper: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 14,
  },
  inviteGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  inviteText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: 0.2,
  },

  // Empty state
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Child card
  childCard: {
    borderRadius: 22,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  childHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    columnGap: 12,
  },
  childAvatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12, 
    backgroundColor: 'rgba(129,212,250,0.35)', 
  },
  childAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: 'rgba(129,212,250,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  childAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  childName: {
    fontSize: 16,
    fontWeight: '700',
  },
  childSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  noCaregiverText: {
    fontSize: 13,
    marginTop: 6,
  },

  // Caregiver rows
  caregiverRow: {
    paddingVertical: 10,
  },
  caregiverInfo: {
    marginBottom: 6,
  },
  caregiverEmail: {
    fontSize: 14,
    fontWeight: '600',
  },
  caregiverUid: {
    fontSize: 12,
    marginTop: 2,
  },
  accessBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  accessPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 8,
  },
  accessPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  removeButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 2,
  },
  removeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    gap: 6,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  permissionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  permissionDescription: {
    fontSize: 12,
    marginBottom: 10,
    fontStyle: 'italic',
  },
});