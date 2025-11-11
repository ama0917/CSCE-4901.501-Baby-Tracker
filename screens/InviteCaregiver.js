// screens/InviteCaregiver.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getAuth } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { ArrowLeft } from 'lucide-react-native';
import ThemedBackground, { appTheme } from '../screens/ThemedBackground';
import { useDarkMode } from '../screens/DarkMode';

// ---------- helper: owned children (unchanged) ----------
async function fetchOwnedChildren(dbRef, userUid) {
  const resultsMap = new Map(); // id -> row

  const collections = ['children', 'Children']; // includes your actual: 'children'
  const eqOwnerFields = [
    'parentId',
    'createdBy',
    'parentUid',
    'ownerUid',
    'ownerId',
    'userId',
    'ParentUid',
    'ParentID',
  ];
  const arrOwnerFields = ['parents', 'owners', 'caregivers', 'authorized', 'parentIds'];

  const addRows = (snap, coll) => {
    snap.forEach((d) => {
      const data = d.data() || {};
      const row = {
        id: d.id,
        coll,
        name: data.name || data.childName || data.displayName || d.id,
        ...data,
      };
      resultsMap.set(d.id, row); // de-dup
    });
  };

  for (const coll of collections) {
    const colRef = collection(dbRef, coll);

    // Equality matches
    for (const f of eqOwnerFields) {
      try {
        const snap = await getDocs(query(colRef, where(f, '==', userUid)));
        if (!snap.empty) addRows(snap, coll);
      } catch {
        // ignore
      }
    }

    // Array-contains matches
    for (const f of arrOwnerFields) {
      try {
        const snap = await getDocs(query(colRef, where(f, 'array-contains', userUid)));
        if (!snap.empty) addRows(snap, coll);
      } catch {
        // ignore
      }
    }
  }

  return Array.from(resultsMap.values()).sort(
    (a, b) =>
      (a.name || '').localeCompare(b.name || '') ||
      (a.id || '').localeCompare(b.id || '')
  );
}

// ---------- theme resolver (matches ManageCaregivers vibe) ----------
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
    cardBg: colors.card ?? (darkMode ? '#020617' : '#FFFFFF'),
    border: colors.border ?? (darkMode ? '#1E293B' : '#E0E6EA'),
    accent: colors.accent ?? (darkMode ? '#7CC8FF' : '#81D4FA'),
    divider: colors.divider ?? (darkMode ? '#1E293B' : '#E5E7EB'),

    // gradients
    cardGrad:
      t?.gradients?.card ??
      (darkMode ? ['#020617', '#020617'] : ['#FFFFFF', '#EEF5FF']),
    primaryGrad:
      t?.gradients?.primary ??
      (darkMode ? ['#38BDF8', '#6366F1'] : ['#81D4FA', '#81D4FA']),

    // consent banner
    bannerBg: darkMode ? 'rgba(252, 211, 77, 0.10)' : '#FFFDE7',
    bannerBorder: darkMode ? 'rgba(252, 211, 77, 0.45)' : '#FFF59D',
    bannerText: darkMode ? '#FEF9C3' : '#5D4037',

    // input / chips
    inputBg: darkMode ? 'rgba(15,23,42,0.9)' : '#FFFFFF',
    inputBorder: darkMode ? '#1E293B' : '#CFD8DC',
    chipBg: darkMode ? 'rgba(15,23,42,0.9)' : '#E3F2FD',

    // modal
    modalCardBg: darkMode ? '#020617' : '#FFFFFF',
    modalDivider: darkMode ? '#1F2937' : '#ECEFF1',

    // buttons
    dangerBg: darkMode ? '#1F2937' : '#CFD8DC',
    dangerText: darkMode ? '#E5E7EB' : '#2E3A59',
  };
};

// ---------- main screen ----------
export default function InviteCaregiver({ navigation }) {
  const auth = getAuth();
  const { darkMode } = useDarkMode();
  const C = useMemo(() => resolveTheme(darkMode), [darkMode]);

  const [children, setChildren] = useState([]); 
  const [selectedIds, setSelectedIds] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [note, setNote] = useState('');
  const [inviteCode, setInviteCode] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load owned children
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    (async () => {
      const rows = await fetchOwnedChildren(db, user.uid);
      setChildren(rows);
    })();
  }, [auth.currentUser]);

  const selectedChildren = useMemo(
    () => children.filter((c) => selectedIds.includes(c.id)),
    [children, selectedIds]
  );

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedIds(children.map((c) => c.id));
  const clearAll = () => setSelectedIds([]);

  const refreshChildren = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const rows = await fetchOwnedChildren(db, user.uid);
    setChildren(rows);
    setSelectedIds((prev) => prev.filter((id) => rows.some((r) => r.id === id)));
  };

  const createInvite = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in first.');
      return;
    }
    if (!selectedIds.length) {
      Alert.alert('Select children', 'Please select at least one child.');
      return;
    }
    try {
      setIsSubmitting(true);
      const docRef = await addDoc(collection(db, 'invites'), {
        createdBy: user.uid,
        childIds: selectedIds,
        note: note.trim() || null,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      // consent record (non-blocking)
      try {
        await addDoc(collection(db, 'users', user.uid, 'consents'), {
          type: 'caregiver_share',
          version: 'v1',
          consentedAt: serverTimestamp(),
          inviteId: docRef.id,
          childIds: selectedIds,
        });
      } catch (e) {
        console.warn('consent write failed:', e);
      }

      setInviteCode(docRef.id);
      Alert.alert('Invite created', 'Share this code with your caregiver to accept.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not create invite.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyCode = async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    Alert.alert('Copied', 'Invite code copied to clipboard.');
  };

  return (
    <ThemedBackground>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} translucent />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.screenPadding}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() =>
                  navigation?.canGoBack()
                    ? navigation.goBack()
                    : navigation.navigate('ManageCaregivers')
                }
                style={styles.headerButton}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={C.cardGrad}
                  style={styles.headerButtonGradient}
                >
                  <ArrowLeft size={20} color={darkMode ? '#FFFFFF' : C.textStrong} />
                </LinearGradient>
              </TouchableOpacity>

              <Text style={[styles.headerTitle, { color: C.textStrong }]}>
                Invite Caregiver
              </Text>

              <View style={{ width: 44 }} />
            </View>

            {/* Intro */}
            <View style={styles.introBlock}>
              <Text style={[styles.introTitle, { color: C.textStrong }]}>
                Share your baby’s dashboard
              </Text>
              <Text style={[styles.introSubtitle, { color: C.textMuted }]}>
                Create an invite code so trusted caregivers can help log activities.
              </Text>
            </View>

            {/* Consent banner */}
            <View
              style={[
                styles.banner,
                { backgroundColor: C.bannerBg, borderColor: C.bannerBorder },
              ]}
            >
              <Text style={[styles.bannerTitle, { color: C.bannerText }]}>
                Before you continue
              </Text>
              <Text style={[styles.bannerText, { color: C.bannerText }]}>
                By inviting a caregiver, you consent to share your child’s information
                (name and activity you choose to share). You can change or revoke access
                anytime in “Manage Caregivers”.
              </Text>
            </View>

            {/* Selected children chips */}
            <Text style={[styles.label, { color: C.textMuted }]}>Selected children</Text>
            {selectedChildren.length ? (
              <View style={styles.chipsRow}>
                {selectedChildren.map((c) => (
                  <View
                    key={c.id}
                    style={[styles.chip, { backgroundColor: C.chipBg }]}
                  >
                    <Text style={{ color: C.textStrong }}>{c.name}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text
                style={[
                  styles.noSelectionText,
                  { color: C.textMuted },
                ]}
              >
                No children selected yet.
              </Text>
            )}

            {/* Select / refresh buttons */}
            <View style={styles.inlineButtonsRow}>
              <TouchableOpacity
                onPress={() => setPickerOpen(true)}
                style={styles.inlinePrimaryBtn}
                activeOpacity={0.85}
              >
                <Text style={styles.inlinePrimaryText}>Select children</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={refreshChildren}
                style={[
                  styles.inlineSecondaryBtn,
                  { backgroundColor: C.dangerBg },
                ]}
                activeOpacity={0.85}
              >
                <Text style={[styles.inlineSecondaryText, { color: C.dangerText }]}>
                  Refresh list
                </Text>
              </TouchableOpacity>
            </View>

            {/* Note */}
            <Text style={[styles.label, { color: C.textMuted }]}>Note (optional)</Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: C.inputBg,
                  borderColor: C.inputBorder,
                },
              ]}
            >
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Short message for your caregiver"
                placeholderTextColor={C.textMuted}
                style={[styles.input, { color: C.textStrong }]}
                multiline
              />
            </View>

            {/* Create invite button */}
            <TouchableOpacity
              onPress={createInvite}
              disabled={isSubmitting}
              style={[styles.mainButtonWrapper, isSubmitting && { opacity: 0.7 }]}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={C.primaryGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.mainButtonGradient}
              >
                <Text style={styles.mainButtonText}>
                  {isSubmitting ? 'Sending…' : 'I consent and send invite'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Result card */}
            {inviteCode ? (
              <LinearGradient
                colors={C.cardGrad}
                style={styles.resultCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text
                  style={[
                    styles.resultTitle,
                    { color: C.textStrong },
                  ]}
                >
                  Invite code
                </Text>
                <Text
                  selectable
                  style={[
                    styles.resultCode,
                    { color: C.textStrong },
                  ]}
                >
                  {inviteCode}
                </Text>
                <TouchableOpacity
                  onPress={copyCode}
                  style={styles.copyButton}
                  activeOpacity={0.85}
                >
                  <Text style={styles.copyButtonText}>Copy code</Text>
                </TouchableOpacity>
              </LinearGradient>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Child picker modal */}
      <Modal visible={pickerOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: C.modalCardBg },
            ]}
          >
            <Text
              style={[
                styles.modalTitle,
                { color: C.textStrong },
              ]}
            >
              Select children
            </Text>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                onPress={selectAll}
                style={[styles.modalChipBtn, { backgroundColor: C.chipBg }]}
                activeOpacity={0.85}
              >
                <Text style={{ color: C.textStrong, fontWeight: '700' }}>Select all</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={clearAll}
                style={[styles.modalChipBtn, { backgroundColor: C.chipBg }]}
                activeOpacity={0.85}
              >
                <Text style={{ color: C.textStrong, fontWeight: '700' }}>Clear</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={children}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => (
                <View
                  style={{
                    height: 1,
                    backgroundColor: C.modalDivider,
                    marginVertical: 2,
                  }}
                />
              )}
              renderItem={({ item }) => {
                const checked = selectedIds.includes(item.id);
                return (
                  <Pressable
                    onPress={() => toggleSelect(item.id)}
                    style={styles.modalRow}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: checked ? C.accent : C.textMuted,
                          backgroundColor: checked ? C.accent : 'transparent',
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.modalRowText,
                        { color: C.textStrong },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name || item.id}
                    </Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text
                  style={[
                    styles.modalEmptyText,
                    { color: C.textMuted },
                  ]}
                >
                  No children found for your account.
                </Text>
              }
              style={{ marginTop: 6 }}
            />

            <View style={styles.modalFooterRow}>
              <TouchableOpacity
                onPress={() => setPickerOpen(false)}
                style={styles.modalDoneBtn}
              >
                <Text style={{ color: C.accent, fontWeight: '700' }}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedBackground>
  );
}

// ---------- styles ----------
const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  screenPadding: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
  },

  // header
  header: {
    height: 44,
    marginBottom: 18,
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

  // intro
  introBlock: {
    marginBottom: 12,
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

  // consent banner
  banner: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  bannerTitle: {
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  bannerText: {
    fontSize: 13,
    lineHeight: 18,
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.2,
  },

  // chips
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  noSelectionText: {
    fontSize: 13,
    marginBottom: 12,
  },

  // inline buttons
  inlineButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  inlinePrimaryBtn: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#00000000',
    borderWidth: 0,
  },
  inlinePrimaryText: {
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 14,
    color: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#81D4FA',
  },
  inlineSecondaryBtn: {
    borderRadius: 14,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  inlineSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // note input
  inputWrapper: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
  },
  input: {
    fontSize: 14,
    minHeight: 40,
  },

  // main button
  mainButtonWrapper: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 18,
  },
  mainButtonGradient: {
    paddingVertical: 16,
    borderRadius: 22,
    alignItems: 'center',
  },
  mainButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.3,
  },

  // result
  resultCard: {
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  resultCode: {
    fontSize: 12,
    marginBottom: 10,
  },
  copyButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  // modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    borderRadius: 18,
    padding: 14,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  modalChipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  modalRow: {
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
  },
  modalRowText: {
    flexShrink: 1,
    fontSize: 14,
  },
  modalEmptyText: {
    fontSize: 13,
    paddingVertical: 8,
  },
  modalFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  modalDoneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});