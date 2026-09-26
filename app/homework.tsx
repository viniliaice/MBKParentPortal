import React, { useState } from 'react';
import { FlatList, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuroraBackground from '@/components/AuroraBackground';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { Colors } from '@/hooks/useColors';
import { HomeworkItem } from '@/data/mockData';

const STATUS_ICONS = { pending: 'time-outline', submitted: 'cloud-upload-outline', graded: 'checkmark-circle-outline' } as const;
const FILTERS = ['all', 'pending', 'submitted', 'graded'] as const;

function statusColor(c: Colors, status: HomeworkItem['status']): string {
  if (status === 'pending') return c.warning;
  if (status === 'submitted') return c.primary;
  return c.accent;
}

export default function HomeworkScreen() {
  const { homework, students, refresh } = useApp();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<typeof FILTERS[number]>('all');
  const [selectedHw, setSelectedHw] = useState<HomeworkItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const filtered = filter === 'all' ? homework : homework.filter(h => h.status === filter);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Homework" onBack={() => router.back()} />

        <View style={styles.filterRow}>
          {FILTERS.map(f => {
            const active = filter === f;
            return (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterBtn,
                  { backgroundColor: active ? c.primary : c.surfaceMuted, borderColor: active ? c.primary : c.border },
                ]}
                onPress={() => setFilter(f)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.filterText, { color: active ? c.onBrand : c.textSecondary }]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={h => h.id}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 0, flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />
          }
          renderItem={({ item }) => <HomeworkCard item={item} students={students} onPress={() => setSelectedHw(item)} />}
          ListEmptyComponent={
            <EmptyState
              icon="book-outline"
              title="No homework here"
              message={filter === 'all' ? 'Homework set by teachers will appear here.' : `No ${filter} homework right now.`}
            />
          }
        />

        <Modal visible={!!selectedHw} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedHw(null)}>
          <View style={{ flex: 1, backgroundColor: c.overlay }}>
            <View style={[styles.modalHeader, { paddingTop: insets.top + 12, borderBottomColor: c.border }]}>
              <TouchableOpacity onPress={() => setSelectedHw(null)} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={c.foreground} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: c.foreground }]} numberOfLines={1}>Homework details</Text>
              <View style={{ width: 24 }} />
            </View>
            {selectedHw ? (
              <ScrollView contentContainerStyle={styles.modalBody}>
                <View style={styles.detailSubjectRow}>
                  <View style={[styles.detailChip, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}>
                    <Text style={[styles.detailSubjectText, { color: statusColor(c, selectedHw.status) }]}>
                      {selectedHw.subject}
                    </Text>
                  </View>
                  <View style={[styles.detailChip, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}>
                    <Ionicons name={STATUS_ICONS[selectedHw.status]} size={14} color={statusColor(c, selectedHw.status)} />
                    <Text style={[styles.detailStatusText, { color: statusColor(c, selectedHw.status) }]}>{selectedHw.status}</Text>
                  </View>
                </View>

                <Text style={[styles.detailTitle, { color: c.foreground }]}>{selectedHw.title}</Text>
                <Text style={[styles.detailDesc, { color: c.textBody }]}>{selectedHw.description}</Text>

                <View style={[styles.detailInfoGrid, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}>
                  {(() => {
                    const student = students.find(s => s.id === selectedHw.studentId);
                    const due = new Date(selectedHw.dueDate);
                    const overdue = selectedHw.status === 'pending' && due < new Date();
                    return (
                      <>
                        <View style={styles.detailInfoRow}>
                          <Ionicons name="person-outline" size={16} color={c.textSecondary} />
                          <Text style={[styles.detailInfoLabel, { color: c.textSecondary }]}>Student</Text>
                          <Text style={[styles.detailInfoValue, { color: c.foreground }]}>{student?.name ?? 'Unknown'}</Text>
                        </View>
                        <View style={styles.detailInfoRow}>
                          <Ionicons name="calendar-outline" size={16} color={overdue ? c.destructive : c.textSecondary} />
                          <Text style={[styles.detailInfoLabel, { color: c.textSecondary }]}>Due</Text>
                          <Text style={[styles.detailInfoValue, { color: overdue ? c.destructive : c.foreground }]}>
                            {due.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            {overdue ? ' (overdue)' : ''}
                          </Text>
                        </View>
                      </>
                    );
                  })()}
                </View>

                {selectedHw.status === 'pending' ? (
                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={() => {
                      setSubmitting(true);
                      setTimeout(() => { setSubmitting(false); setSelectedHw(null); }, 1000);
                    }}
                    activeOpacity={0.85}
                    disabled={submitting}
                  >
                    <LinearGradient colors={c.brandGradient} style={styles.submitBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Ionicons name="cloud-upload-outline" size={20} color={c.onBrand} />
                      <Text style={[styles.submitBtnText, { color: c.onBrand }]}>
                        {submitting ? 'Submitting…' : 'Mark as submitted'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : null}

                {selectedHw.status === 'graded' ? (
                  <View style={styles.gradedBox}>
                    <Ionicons name="checkmark-circle" size={40} color={c.accent} />
                    <Text style={[styles.gradedText, { color: c.accent }]}>This homework has been graded</Text>
                  </View>
                ) : null}
              </ScrollView>
            ) : null}
          </View>
        </Modal>
      </View>
    </AuroraBackground>
  );
}

function HomeworkCard({ item, students, onPress }: { item: HomeworkItem; students: { id: string; name: string }[]; onPress: () => void }) {
  const c = useColors();
  const color = statusColor(c, item.status);
  const student = students.find(s => s.id === item.studentId);
  const due = new Date(item.dueDate);
  const overdue = item.status === 'pending' && due < new Date();

  return (
    <Card onPress={onPress} style={styles.card} accessibilityLabel={`${item.subject} homework: ${item.title}`}>
      <View style={styles.cardHeader}>
        <View style={[styles.subjectPill, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}>
          <Text style={[styles.subjectText, { color }]}>{item.subject}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: c.surfaceMuted }]}>
          <Ionicons name={STATUS_ICONS[item.status]} size={12} color={color} />
          <Text style={[styles.statusText, { color }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={[styles.title, { color: c.foreground }]}>{item.title}</Text>
      <Text style={[styles.desc, { color: c.textSecondary }]} numberOfLines={3}>{item.description}</Text>
      <View style={styles.cardFooter}>
        <View style={styles.footerRow}>
          <Ionicons name="person-outline" size={12} color={c.textSecondary} />
          <Text style={[styles.footerText, { color: c.textSecondary }]} numberOfLines={1}>{student?.name ?? 'Unknown'}</Text>
        </View>
        <View style={styles.footerRow}>
          <Ionicons name="calendar-outline" size={12} color={overdue ? c.destructive : c.textSecondary} />
          <Text style={[styles.footerText, { color: overdue ? c.destructive : c.textSecondary }]}>
            Due {due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{overdue ? ' · overdue' : ''}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 14 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 12.5, fontWeight: '600' },
  card: { marginHorizontal: 20, marginBottom: 10, gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subjectPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  subjectText: { fontSize: 12, fontWeight: '700' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11.5, fontWeight: '600', textTransform: 'capitalize' },
  title: { fontSize: 15.5, fontWeight: '700' },
  desc: { fontSize: 13, lineHeight: 19 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  footerText: { fontSize: 11.5 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 10 },
  modalBody: { padding: 20, gap: 12 },
  detailSubjectRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  detailChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  detailSubjectText: { fontSize: 12.5, fontWeight: '700' },
  detailStatusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  detailTitle: { fontSize: 21, fontWeight: '800' },
  detailDesc: { fontSize: 15, lineHeight: 23 },
  detailInfoGrid: { borderRadius: 16, padding: 16, gap: 12, borderWidth: 1 },
  detailInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailInfoLabel: { fontSize: 13, width: 62 },
  detailInfoValue: { fontSize: 13, fontWeight: '600', flex: 1 },
  submitBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  submitBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  submitBtnText: { fontSize: 16, fontWeight: '700' },
  gradedBox: { alignItems: 'center', gap: 12, padding: 30 },
  gradedText: { fontSize: 15, fontWeight: '600' },
});
