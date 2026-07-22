import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AuroraBackground from '@/components/AuroraBackground';
import { useApp } from '@/context/AppContext';
import { AppMessage } from '@/data/mockData';

export default function MessagesScreen() {
  const { messages, unreadCount, markRead, sendMessage } = useApp();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');
  const [selected, setSelected] = useState<AppMessage | null>(null);
  const [composing, setComposing] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const filtered = messages.filter(m => (tab === 'inbox') === m.isInbox);

  const openMessage = (m: AppMessage) => {
    setSelected(m);
    if (m.isInbox && !m.isRead) markRead(m.id);
  };

  const doSend = () => {
    if (!composeSubject.trim() || !composeBody.trim()) return;
    sendMessage({
      senderId: 'parent1', senderName: 'You',
      recipientId: 'teacher1', recipientName: 'Ms. Johnson',
      subject: composeSubject.trim(), body: composeBody.trim(),
      isInbox: false,
    });
    setComposing(false);
    setComposeSubject('');
    setComposeBody('');
    setTab('sent');
  };

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <Text style={styles.headerTitle}>Messages</Text>
          <TouchableOpacity style={styles.composeBtn} onPress={() => setComposing(true)} activeOpacity={0.8}>
            <LinearGradient colors={['#3D5AFE', '#00BCD4']} style={styles.composeBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name="create-outline" size={18} color="#FFF" />
              <Text style={styles.composeBtnText}>Compose</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tabBtn, tab === 'inbox' && styles.tabBtnActive]} onPress={() => setTab('inbox')} activeOpacity={0.8}>
            <Text style={[styles.tabText, tab === 'inbox' && styles.tabTextActive]}>
              Inbox {unreadCount > 0 && <Text style={styles.tabBadge}> {unreadCount}</Text>}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, tab === 'sent' && styles.tabBtnActive]} onPress={() => setTab('sent')} activeOpacity={0.8}>
            <Text style={[styles.tabText, tab === 'sent' && styles.tabTextActive]}>Sent</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={m => m.id}
          contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 + 84 : 100 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.msgRow, !item.isRead && item.isInbox && styles.msgRowUnread]} onPress={() => openMessage(item)} activeOpacity={0.8}>
              <View style={styles.senderAvatar}>
                <Text style={styles.senderInitial}>{item.isInbox ? item.senderName[0] : item.recipientName[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.msgMeta}>
                  <Text style={[styles.senderName, !item.isRead && item.isInbox && { color: '#FFFFFF' }]}>
                    {item.isInbox ? item.senderName : `To: ${item.recipientName}`}
                  </Text>
                  <Text style={styles.msgDate}>
                    {new Date(item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <Text style={[styles.msgSubject, !item.isRead && item.isInbox && { color: '#FFFFFF' }]}>{item.subject}</Text>
                <Text style={styles.msgPreview} numberOfLines={1}>{item.body}</Text>
              </View>
              {!item.isRead && item.isInbox && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          )}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="mail-open-outline" size={48} color="#4A5080" /><Text style={styles.emptyText}>No messages here</Text></View>}
        />

        <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
          <View style={{ flex: 1, backgroundColor: '#0B1026' }}>
            <View style={[styles.modalHeader, { paddingTop: insets.top + 12 }]}>
              <TouchableOpacity onPress={() => setSelected(null)}><Ionicons name="close" size={24} color="#FFFFFF" /></TouchableOpacity>
              <Text style={styles.modalTitle} numberOfLines={1}>{selected?.subject}</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <View style={styles.modalMeta}>
                <Text style={styles.modalFrom}>From: <Text style={{ color: '#FFFFFF' }}>{selected?.senderName}</Text></Text>
                <Text style={styles.modalDate}>{selected ? new Date(selected.createdAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}</Text>
              </View>
              <Text style={styles.modalBodyText}>{selected?.body}</Text>
            </ScrollView>
          </View>
        </Modal>

        <Modal visible={composing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setComposing(false)}>
          <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0B1026' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[styles.modalHeader, { paddingTop: insets.top + 12 }]}>
              <TouchableOpacity onPress={() => setComposing(false)}><Text style={{ color: '#8892B0', fontSize: 15 }}>Cancel</Text></TouchableOpacity>
              <Text style={styles.modalTitle}>New Message</Text>
              <TouchableOpacity onPress={doSend}><Text style={{ color: '#3D5AFE', fontSize: 15, fontWeight: '700' }}>Send</Text></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.composeLabel}>To</Text>
              <View style={styles.composeInput}><Text style={{ color: '#8892B0' }}>Ms. Johnson (Class Teacher)</Text></View>
              <Text style={styles.composeLabel}>Subject</Text>
              <TextInput style={styles.composeTextInput} value={composeSubject} onChangeText={setComposeSubject} placeholder="Enter subject…" placeholderTextColor="#4A5080" />
              <Text style={styles.composeLabel}>Message</Text>
              <TextInput style={[styles.composeTextInput, { height: 160, textAlignVertical: 'top' }]} value={composeBody} onChangeText={setComposeBody} placeholder="Write your message…" placeholderTextColor="#4A5080" multiline />
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  composeBtn: { borderRadius: 20, overflow: 'hidden' },
  composeBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  composeBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  tabs: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 12 },
  tabBtnActive: { backgroundColor: '#3D5AFE' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#8892B0' },
  tabTextActive: { color: '#FFFFFF' },
  tabBadge: { color: '#FF5370', fontWeight: '800' },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  msgRowUnread: { backgroundColor: 'rgba(61,90,254,0.05)' },
  senderAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(61,90,254,0.3)', alignItems: 'center', justifyContent: 'center' },
  senderInitial: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  msgMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  senderName: { fontSize: 13, fontWeight: '600', color: '#8892B0' },
  msgDate: { fontSize: 11, color: '#4A5080' },
  msgSubject: { fontSize: 14, fontWeight: '600', color: '#CCCCCC', marginVertical: 2 },
  msgPreview: { fontSize: 12, color: '#4A5080' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3D5AFE' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: '#4A5080', fontSize: 15 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', flex: 1, textAlign: 'center', marginHorizontal: 10 },
  modalBody: { padding: 20 },
  modalMeta: { marginBottom: 20, gap: 4 },
  modalFrom: { fontSize: 13, color: '#8892B0' },
  modalDate: { fontSize: 12, color: '#4A5080' },
  modalBodyText: { fontSize: 15, color: '#CCCCCC', lineHeight: 24 },
  composeLabel: { fontSize: 12, color: '#8892B0', fontWeight: '600', letterSpacing: 0.5, marginTop: 16, marginBottom: 6 },
  composeInput: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  composeTextInput: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF', fontSize: 15 },
});
