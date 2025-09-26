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

// Robust fetch: equality + array-contains, de-duped
async function fetchOwnedChildren(dbRef, userUid) {
  const resultsMap = new Map(); // id -> row

  const collections = ['children', 'Children']; // includes your actual: 'children'
  const eqOwnerFields = [
    'parentId', 'createdBy', 'parentUid', 'ownerUid', 'ownerId', 'userId', 'ParentUid', 'ParentID'
  ];
  const arrOwnerFields = [
    'parents', 'owners', 'caregivers', 'authorized', 'parentIds'
  ];

  const addRows = (snap, coll) => {
    snap.forEach((d) => {
      const data = d.data() || {};
      const row = {
        id: d.id,
        coll,
        name: data.name || data.childName || data.displayName || d.id,
        ...data,
      };
      // de-dup on id (last write wins)
      resultsMap.set(d.id, row);
    });
  };

  for (const coll of collections) {
    const colRef = collection(dbRef, coll);

    // Equality matches
    for (const f of eqOwnerFields) {
      try {
        const snap = await getDocs(query(colRef, where(f, '==', userUid)));
        if (!snap.empty) addRows(snap, coll);
      } catch (_) {}
    }

    // Array-contains matches
    for (const f of arrOwnerFields) {
      try {
        const snap = await getDocs(query(colRef, where(f, 'array-contains', userUid)));
        if (!snap.empty) addRows(snap, coll);
      } catch (_) {}
    }
  }

  // Return stable, friendly order
  return Array.from(resultsMap.values()).sort((a, b) =>
    (a.name || '').localeCompare(b.name || '') || (a.id || '').localeCompare(b.id || '')
  );
}


export default function InviteCaregiver() {
  const auth = getAuth();

  const [children, setChildren] = useState([]); // [{id, name, coll, ...}]
  const [selectedIds, setSelectedIds] = useState([]); // string[]
  const [pickerOpen, setPickerOpen] = useState(false);

  const [note, setNote] = useState('');
  const [inviteCode, setInviteCode] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load owned children for the signed-in parent
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    (async () => {
      const rows = await fetchOwnedChildren(db, user.uid);
      setChildren(rows);
      // don’t auto-select; let the user pick explicitly
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const selectAll = () => {
    setSelectedIds(children.map((c) => c.id));
  };

  const clearAll = () => {
    setSelectedIds([]);
  };

  const refreshChildren = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const rows = await fetchOwnedChildren(db, user.uid);
    setChildren(rows);
    // keep any selected ids that still exist
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
        childIds: selectedIds, // <— MULTI-CHILD
        note: note.trim() || null,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setInviteCode(docRef.id);
      Alert.alert('Invite created', 'Share this code with your caregiver to accept.');
    } catch (e) {
      Alert.alert('Error', e.message);
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
    <LinearGradient colors={['#E3F2FD', '#FFFFFF']} style={{ flex: 1 }}>
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#2E3A59', marginBottom: 12 }}>
          Invite Caregiver
        </Text>

        {/* Selected children chips */}
        <Text style={{ color: '#7C8B9A', marginBottom: 6 }}>Selected Children</Text>
        {selectedChildren.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {selectedChildren.map((c) => (
              <View
                key={c.id}
                style={{
                  backgroundColor: '#E3F2FD',
                  borderRadius: 16,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                }}
              >
                <Text style={{ color: '#2E3A59' }}>{c.name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: '#B0BEC5', marginBottom: 10 }}>No children selected</Text>
        )}

        {/* Open picker + refresh */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => setPickerOpen(true)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: '#81D4FA',
            }}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Select Children</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={refreshChildren}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: '#CFD8DC',
            }}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#2E3A59', fontWeight: '700' }}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Optional note */}
        <Text style={{ color: '#7C8B9A', marginBottom: 6 }}>Note (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Short message for the caregiver"
          placeholderTextColor="#B0BEC5"
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

        {/* Create Invite */}
        <TouchableOpacity
          onPress={createInvite}
          disabled={isSubmitting}
          style={{
            backgroundColor: '#81D4FA',
            padding: 14,
            borderRadius: 12,
            alignItems: 'center',
            opacity: isSubmitting ? 0.6 : 1,
          }}
          activeOpacity={0.85}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Create Invite</Text>
        </TouchableOpacity>

        {/* Result */}
        {inviteCode ? (
          <View
            style={{
              marginTop: 20,
              padding: 12,
              borderRadius: 12,
              backgroundColor: '#E3F2FD',
            }}
          >
            <Text style={{ color: '#2E3A59', fontWeight: '700', marginBottom: 6 }}>
              Invite Code
            </Text>
            <Text selectable style={{ color: '#2E3A59', fontSize: 12, marginBottom: 12 }}>
              {inviteCode}
            </Text>
            <TouchableOpacity
              onPress={copyCode}
              style={{
                backgroundColor: '#2E3A59',
                padding: 10,
                borderRadius: 10,
                alignItems: 'center',
                alignSelf: 'flex-start',
              }}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Copy Code</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* MULTI-SELECT modal */}
        <Modal visible={pickerOpen} animationType="slide" transparent>
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.25)',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                margin: 20,
                borderRadius: 12,
                backgroundColor: '#fff',
                padding: 12,
                maxHeight: '70%',
              }}
            >
              <Text
                style={{
                  fontWeight: '700',
                  fontSize: 18,
                  color: '#2E3A59',
                  marginBottom: 8,
                }}
              >
                Select Children
              </Text>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                <TouchableOpacity
                  onPress={selectAll}
                  style={{
                    backgroundColor: '#E3F2FD',
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: '#2E3A59', fontWeight: '700' }}>Select All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={clearAll}
                  style={{
                    backgroundColor: '#E3F2FD',
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: '#2E3A59', fontWeight: '700' }}>Clear</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={children}
                keyExtractor={(item) => item.id}
                ItemSeparatorComponent={() => (
                  <View style={{ height: 1, backgroundColor: '#ECEFF1' }} />
                )}
                renderItem={({ item }) => {
                  const checked = selectedIds.includes(item.id);
                  return (
                    <Pressable
                      onPress={() => toggleSelect(item.id)}
                      style={{
                        paddingVertical: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          borderWidth: 2,
                          borderColor: checked ? '#81D4FA' : '#B0BEC5',
                          backgroundColor: checked ? '#81D4FA' : 'transparent',
                        }}
                      />
                      <Text style={{ color: '#2E3A59', flexShrink: 1 }}>{item.name || item.id}</Text>
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <Text style={{ color: '#7C8B9A', paddingVertical: 8 }}>
                    No children found for your account.
                  </Text>
                }
              />

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setPickerOpen(false)}
                  style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                >
                  <Text style={{ color: '#2E3A59', fontWeight: '700' }}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </LinearGradient>
  );
}
