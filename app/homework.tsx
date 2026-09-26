import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AuroraBackground from '@/components/AuroraBackground';
import TopBar from '@/components/TopBar';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { HomeworkItem } from '@/data/mockData';

const STATUS_COLORS = { pending: '#C47F0B', submitted: '#3D5AFE', graded: '#1F9D55' } as const;
const STATUS_ICONS = { pending: 'time-outline', submitted: 'cloud-upload-outline', graded: 'checkmark-circle-outline' } as const;

export default function HomeworkScreen() {
  const { homework, students } = useApp();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted' | 'graded'>('all');
  const [selectedHw, setSelectedHw] = useState<HomeworkItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filtered = filter === 'all' ? homework : homework.filter(h => h.status === filter);

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <TopBar title="Homework" />

        <View style={styles.filterRow}>
          {(['all', 'pending', 'submitted', 'graded'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterBtn,
                { backgroundColor: filter === f ? c.primary : c.card, borderColor: filter === f ? c.primary : c.border },
              ]}
              onPress={() => setFilter(f)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterText, { color: filter === f ? '#FFFFFF' : c.foreground }]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={h => h.id}
          contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 : 20, paddingHorizontal: 20 }}
          renderItem={({ item }) => <HomeworkCard item={item} students={students} onPress={() => setSelectedHw(item)} />}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="book-outline" size={48} color={c.mutedForeground} /><Text style={[styles.emptyText, { color: c.mutedForeground }]}>No homework found</Text></View>}
        />

        <Modal visible={!!selectedHw} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedHw(null)}>
          <View style={{ flex: 1, backgroundColor: c.background }}>
            <View style={[styles.modalHeader, { paddingTop: insets.top + 12, borderBottomColor: c.border }]}>
              <TouchableOpacity onPress={() => setSelectedHw(null)}><Ionicons name="close" size={24} color={c.foreground} /></TouchableOpacity>
              <Text style={[styles.modalTitle, { color: c.foreground }]} numberOfLines={1}>Homework Details</Text>
              <View style={{ width: 24 }} />
            </View>
            {selectedHw && (
              <ScrollView contentContainerStyle={styles.modalBody}>
                <View style={styles.detailSubjectRow}>
                  <View style={[styles.detailSubjectDot, { backgroundColor: `${STATUS_COLORS[selectedHw.status]}22`, borderColor: `${STATUS_COLORS[selectedHw.status]}44` }]}>
                    <Text style={[styles.detailSubjectText, { color: STATUS_COLORS[selectedHw.status] }]}>{selectedHw.subject}</Text>
                  </View>
                  <View style={[styles.detailStatus, { backgroundColor: `${STATUS_COLORS[selectedHw.status]}22` }]}>
                    <Ionicons name={STATUS_ICONS[selectedHw.status]} size={14} color={STATUS_COLORS[selectedHw.status]} />
                    <Text style={[styles.detailStatusText, { color: STATUS_COLORS[selectedHw.status] }]}>{selectedHw.status}</Text>
                  </View>
                </View>

                <Text style={[styles.detailTitle, { color: c.foreground }]}>{selectedHw.title}</Text>
                <Text style={[styles.detailDesc, { color: c.mutedForeground }]}>{selectedHw.description}</Text>

                <View style={[styles.detailInfoGrid, { backgroundColor: c.muted }]}>
                  {(() => {
                    const student = students.find(s => s.id === selectedHw.studentId);
                    const due = new Date(selectedHw.dueDate);
                    const overdue = selectedHw.status === 'pending' && due < new Date();
                    return (
                      <>
                        <View style={styles.detailInfoRow}>
                          <Ionicons name="person-outline" size={16} color={c.mutedForeground} />
                          <Text style={[styles.detailInfoLabel, { color: c.mutedForeground }]}>Student</Text>
                          <Text style={[styles.detailInfoValue, { color: c.foreground }]}>{student?.name ?? 'Unknown'}</Text>
                        </View>
                        <View style={styles.detailInfoRow}>
                          <Ionicons name="calendar-outline" size={16} color={overdue ? c.destructive : c.mutedForeground} />
                          <Text style={[styles.detailInfoLabel, { color: c.mutedForeground }]}>Due Date</Text>
                          <Text style={[styles.detailInfoValue, { color: overdue ? c.destructive : c.foreground }]}>
                            {due.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            {overdue ? ' (overdue)' : ''}
                          </Text>
                        </View>
                      </>
                    );
                  })()}
                </View>

                {selectedHw.status === 'pending' && (
                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={() => {
                      setSubmitting(true);
                      setTimeout(() => { setSubmitting(false); setSelectedHw(null); }, 1000);
                    }}
                    activeOpacity={0.85}
                    disabled={submitting}
                  >
                    <LinearGradient colors={[c.primary, c.secondary]} style={styles.submitBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Ionicons name="cloud-upload-outline" size={20} color="#FFF" />
                      <Text style={styles.submitBtnText}>{submitting ? 'Submitting…' : 'Mark as Submitted'}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {selectedHw.status === 'graded' && (
                  <View style={styles.gradedBox}>
                    <Ionicons name="checkmark-circle" size={40} color="#2ECC71" />
                    <Text style={styles.gradedText}>This homework has been graded</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </Modal>
      </View>
    </AuroraBackground>
  );
}

function HomeworkCard({ item, students, onPress }: { item: HomeworkItem; students: any[]; onPress: () => void }) {
  const c = useColors();
  const student = students.find(s => s.id === item.studentId);
  const color = STATUS_COLORS[item.status];
  const icon = STATUS_ICONS[item.status];
  const due = new Date(item.dueDate);
  const overdue = item.status === 'pending' && due < new Date();

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <View style={[styles.subjectDot, { backgroundColor: `${color}22`, borderColor: `${color}44` }]}>
          <Text style={[styles.subjectText, { color }]}>{item.subject}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: `${color}22` }]}>
          <Ionicons name={icon} size={12} color={color} />
          <Text style={[styles.statusText, { color }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={[styles.title, { color: c.foreground }]}>{item.title}</Text>
      <Text style={[styles.desc, { color: c.mutedForeground }]}>{item.description}</Text>
      <View style={styles.cardFooter}>
        <View style={styles.footerRow}>
          <Ionicons name="person-outline" size={12} color={c.mutedForeground} />
          <Text style={[styles.footerText, { color: c.mutedForeground }]}>{student?.name ?? 'Unknown'}</Text>
        </View>
        <View style={styles.footerRow}>
          <Ionicons name="calendar-outline" size={12} color={overdue ? c.destructive : c.mutedForeground} />
          <Text style={[styles.footerText, { color: overdue ? c.destructive : c.mutedForeground }]}>
            Due: {due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            {overdue ? ' (overdue)' : ''}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 12, fontWeight: '600' },
  card: { borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' },
  subjectDot: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  subjectText: { fontSize: 11, fontWeight: '700' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  title: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  desc: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', gap: 16 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 10 },
  modalBody: { padding: 20, gap: 16 },
  detailSubjectRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailSubjectDot: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1 },
  detailSubjectText: { fontSize: 13, fontWeight: '700' },
  detailStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  detailStatusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  detailTitle: { fontSize: 22, fontWeight: '800' },
  detailDesc: { fontSize: 15, lineHeight: 24 },
  detailInfoGrid: { borderRadius: 16, padding: 16, gap: 12 },
  detailInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailInfoLabel: { fontSize: 13, width: 70 },
  detailInfoValue: { fontSize: 13, fontWeight: '600', flex: 1 },
  submitBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  submitBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  gradedBox: { alignItems: 'center', gap: 12, padding: 30 },
  gradedText: { fontSize: 15, color: '#2ECC71', fontWeight: '600' },
});
