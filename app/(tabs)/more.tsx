import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { AppearanceToggle } from '@/components/AppearanceToggle';
import { Avatar } from '@/components/Avatar';
import AuroraBackground from '@/components/AuroraBackground';
import { Card } from '@/components/Card';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useTabBarSpacing } from '@/hooks/useScreenInsets';
import { SUPPORT_EMAIL } from '@/constants/legal';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface MenuItem {
  label: string;
  description?: string;
  icon: IconName;
  onPress: () => void;
  tone?: 'default' | 'danger';
}

/**
 * More: everything that is not marks or messages.
 *
 * That is the whole point of this screen — the parent app's secondary tools live here,
 * including the appearance control, and none of them compete with the two primary
 * destinations. Nothing was removed to get here: homework, attendance, learning and
 * quizzes are all still one tap away.
 */
export default function MoreScreen() {
  const { user, logout } = useAuth();
  const { students, selectedStudent, setSelectedStudentId, getTotalXP, lessonProgress, gamification } = useApp();
  const c = useColors();
  const tabSpacing = useTabBarSpacing();

  const totalXP = getTotalXP();
  const completedLessons = Object.values(lessonProgress).filter(p => p.completed).length;
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await logout(); router.replace('/login'); } },
    ]);
  };

  const contactSchool = () => {
    if (SUPPORT_EMAIL) Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {});
  };

  const academic: MenuItem[] = [
    { label: 'Homework', description: 'Pending and submitted work', icon: 'book-outline', onPress: () => router.push('/homework') },
    { label: 'Attendance', description: 'Daily records per child', icon: 'calendar-outline', onPress: () => router.push('/attendance') },
    { label: 'Academic results', description: 'The same reports as the Marks tab', icon: 'bar-chart-outline', onPress: () => router.push('/results') },
    { label: 'Learning & practice', description: 'Lessons and activities', icon: 'school-outline', onPress: () => router.push('/(tabs)/learning') },
    { label: 'Quizzes', description: 'Class quizzes and results', icon: 'help-circle-outline', onPress: () => router.push('/quizzes') },
  ];

  const support: MenuItem[] = [
    { label: 'Privacy & data', description: 'What the app holds and why', icon: 'shield-checkmark-outline', onPress: () => router.push('/legal') },
    ...(SUPPORT_EMAIL
      ? [{ label: 'Contact the school office', description: SUPPORT_EMAIL, icon: 'mail-outline' as IconName, onPress: contactSchool }]
      : []),
    { label: 'Close my account', description: 'Ask the school office to remove it', icon: 'person-remove-outline', onPress: () => router.push('/account') },
    { label: 'Sign out', icon: 'log-out-outline', onPress: handleLogout, tone: 'danger' as const },
  ];

  return (
    <AuroraBackground>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: tabSpacing + 16 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="More" size="tab" />

        <View style={styles.gutter}>
          <Card style={styles.profileCard}>
            <Avatar name={user?.name ?? 'Parent'} color={c.primary} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.profileName, { color: c.foreground }]} numberOfLines={1}>{user?.name}</Text>
              <Text style={[styles.profileEmail, { color: c.textSecondary }]} numberOfLines={1}>{user?.email}</Text>
            </View>
          </Card>
        </View>

        {students.length > 0 ? (
          <>
            <SectionHeader title="My children" />
            <View style={styles.gutter}>
              <Card padded={false}>
                {students.map((student, index) => {
                  const selected = selectedStudent?.id === student.id;
                  return (
                    <TouchableOpacity
                      key={student.id}
                      style={[
                        styles.childRow,
                        index > 0 && { borderTopWidth: 1, borderTopColor: c.border },
                      ]}
                      activeOpacity={0.85}
                      onPress={() => {
                        setSelectedStudentId(student.id);
                        router.push('/(tabs)/marks');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${student.name}, ${student.grade}${student.id ? `, student ${student.id}` : ''}. Open marks`}
                    >
                      <Avatar name={student.name} color={student.avatarColor} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.childName, { color: c.foreground }]} numberOfLines={1}>{student.name}</Text>
                        <Text style={[styles.childClass, { color: c.textSecondary }]} numberOfLines={1}>
                          {student.id ? `${student.grade} · ${student.id}` : student.grade}
                        </Text>
                      </View>
                      {selected ? (
                        <View style={[styles.currentPill, { backgroundColor: c.primarySoft }]}>
                          <Text style={[styles.currentText, { color: c.primary }]}>Viewing</Text>
                        </View>
                      ) : null}
                      <Ionicons name="chevron-forward" size={17} color={c.textDim} />
                    </TouchableOpacity>
                  );
                })}
              </Card>
            </View>
          </>
        ) : null}

        <SectionHeader title="Appearance" />
        <View style={styles.gutter}>
          <Card style={{ gap: 10 }}>
            <AppearanceToggle />
            <Text style={[styles.hint, { color: c.textDim }]}>
              Applies to the whole app and is remembered on this device.
            </Text>
          </Card>
        </View>

        {totalXP > 0 || completedLessons > 0 ? (
          <>
            <SectionHeader title="Practice progress" />
            <View style={styles.gutter}>
              <Card style={styles.statsCard}>
                <Stat icon="star" value={String(totalXP)} label="XP" />
                <Stat icon="checkmark-circle" value={String(completedLessons)} label="Lessons" />
                <Stat icon="trophy" value={String(gamification.level)} label="Level" />
                <Stat icon="flame" value={String(gamification.currentStreak)} label="Streak" />
              </Card>
            </View>
          </>
        ) : null}

        <SectionHeader title="School records" />
        <View style={styles.gutter}>
          <Card padded={false}>
            {academic.map((item, index) => (
              <MenuRow key={item.label} item={item} first={index === 0} />
            ))}
          </Card>
        </View>

        <SectionHeader title="Support & account" />
        <View style={styles.gutter}>
          <Card padded={false}>
            {support.map((item, index) => (
              <MenuRow key={item.label} item={item} first={index === 0} />
            ))}
          </Card>
        </View>

        <Text style={[styles.version, { color: c.textDim }]}>
          MBK Parent Portal · version {appVersion}
        </Text>
      </ScrollView>
    </AuroraBackground>
  );
}

function MenuRow({ item, first }: { item: MenuItem; first: boolean }) {
  const c = useColors();
  const danger = item.tone === 'danger';

  return (
    <TouchableOpacity
      style={[styles.menuRow, !first && { borderTopWidth: 1, borderTopColor: c.border }]}
      onPress={item.onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={item.description ? `${item.label}. ${item.description}` : item.label}
    >
      <View style={[styles.menuIcon, { backgroundColor: danger ? c.surfaceMuted : c.primarySoft }]}>
        <Ionicons name={item.icon} size={19} color={danger ? c.destructive : c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuLabel, { color: danger ? c.destructive : c.foreground }]}>{item.label}</Text>
        {item.description ? (
          <Text style={[styles.menuDescription, { color: c.textSecondary }]} numberOfLines={1}>{item.description}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={17} color={c.textDim} />
    </TouchableOpacity>
  );
}

function Stat({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  const c = useColors();
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={17} color={c.primary} />
      <Text style={[styles.statValue, { color: c.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: c.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gutter: { paddingHorizontal: 20 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileName: { fontSize: 17, fontWeight: '700' },
  profileEmail: { fontSize: 13, marginTop: 2 },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  childName: { fontSize: 15.5, fontWeight: '700' },
  childClass: { fontSize: 12.5, marginTop: 2 },
  currentPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  currentText: { fontSize: 11, fontWeight: '700' },
  hint: { fontSize: 12, lineHeight: 17 },
  statsCard: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', gap: 3, flex: 1 },
  statValue: { fontSize: 19, fontWeight: '800' },
  statLabel: { fontSize: 11 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, paddingVertical: 15 },
  menuIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 15, fontWeight: '600' },
  menuDescription: { fontSize: 12, marginTop: 2 },
  version: { textAlign: 'center', fontSize: 12, marginTop: 22 },
});
