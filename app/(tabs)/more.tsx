import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AuroraBackground from '@/components/AuroraBackground';
import { useAuth } from '@/context/AuthContext';
import { useScheme } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';

interface MenuItem {
  section: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  route?: string;
  desc?: string;
}

const MENU_ITEMS: MenuItem[] = [
  { section: 'Children', label: 'Attendance', icon: 'calendar-outline', iconColor: '#00BCD4', route: '/attendance', desc: 'Daily presence records per child' },
  { section: 'Children', label: 'Homework', icon: 'book-outline', iconColor: '#3D5AFE', route: '/homework', desc: 'Pending and submitted tasks' },
  { section: 'Children', label: 'Quizzes', icon: 'help-circle-outline', iconColor: '#F59E0B', route: '/quizzes', desc: 'Class quizzes and results' },
  { section: 'Children', label: 'Learning Hub', icon: 'school-outline', iconColor: '#8B5CF6', route: '/(tabs)/learning', desc: 'Practice lessons and progress' },
  { section: 'Account', label: 'My Profile', icon: 'person-outline', iconColor: '#2ECC71', route: '/account', desc: 'Signed-in account details' },
  { section: 'Account', label: 'Privacy & Data', icon: 'shield-checkmark-outline', iconColor: '#3D5AFE', route: '/legal', desc: "How the school handles your data" },
];

export default function MoreScreen() {
  const { user, logout } = useAuth();
  const { setScheme, isDark } = useScheme();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await logout(); router.replace('/login'); } },
    ]);
  };

  const sections = ['Children', 'Account'];
  const groups = sections.map(section => ({
    section,
    items: MENU_ITEMS.filter(i => i.section === section),
  })).filter(g => g.items.length > 0);

  return (
    <AuroraBackground>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 + 84 : 100 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <Text style={[styles.headerTitle, { color: c.foreground }]}>More</Text>
        </View>

        <View style={[styles.profileCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={[styles.profileAvatar, { backgroundColor: `${c.primary}33` }]}>
            <Text style={[styles.profileInitial, { color: c.foreground }]}>{user?.name[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: c.foreground }]} numberOfLines={1}>{user?.name}</Text>
            <Text style={[styles.profileEmail, { color: c.mutedForeground }]} numberOfLines={1}>{user?.email}</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>Appearance</Text>
        <View style={[styles.appearanceCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={[styles.appearanceIcon, { backgroundColor: `${c.secondary}1F` }]}>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={22} color={c.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuLabel, { color: c.foreground }]}>Dark Mode</Text>
            <Text style={[styles.menuDesc, { color: c.mutedForeground }]}>Currently {isDark ? 'dark' : 'light'}. Tap the switch to change.</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={next => setScheme(next ? 'dark' : 'light')}
            trackColor={{ false: c.border, true: c.primary }}
            thumbColor="#FFFFFF"
            accessibilityLabel="Dark mode"
            accessibilityHint="Toggles between dark and light appearance"
          />
        </View>
        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={() => router.push('/appearance')}
          activeOpacity={0.8}
        >
          <View style={[styles.menuIcon, { backgroundColor: `${c.secondary}1F` }]}>
            <Ionicons name="color-palette-outline" size={22} color={c.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuLabel, { color: c.foreground }]}>Appearance</Text>
            <Text style={[styles.menuDesc, { color: c.mutedForeground }]}>Choose Light or Dark</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
        </TouchableOpacity>

        {groups.map(group => (
          <View key={group.section}>
            <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>{group.section}</Text>
            {group.items.map(item => {
              return (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.menuItem, { backgroundColor: c.card, borderColor: c.border }]}
                  onPress={() => item.route && router.push(item.route as any)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.menuIcon, { backgroundColor: `${item.iconColor}1F` }]}>
                    <Ionicons name={item.icon} size={22} color={item.iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.menuLabel, { color: c.foreground }]}>{item.label}</Text>
                    {item.desc ? <Text style={[styles.menuDesc, { color: c.mutedForeground }]}>{item.desc}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <TouchableOpacity style={[styles.menuItem, styles.logoutItem, { backgroundColor: c.card, borderColor: c.border }]} onPress={handleLogout} activeOpacity={0.8}>
          <View style={[styles.menuIcon, { backgroundColor: `${c.destructive}26` }]}>
            <Ionicons name="log-out-outline" size={22} color={c.destructive} />
          </View>
          <Text style={[styles.menuLabel, { color: c.destructive }]}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 26, fontWeight: '800' },
  profileCard: { marginHorizontal: 20, marginBottom: 20, borderRadius: 18, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1 },
  profileAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  profileInitial: { fontSize: 22, fontWeight: '800' },
  profileName: { fontSize: 18, fontWeight: '700' },
  profileEmail: { fontSize: 13, marginTop: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 20, marginBottom: 8, marginTop: 8 },
  appearanceCard: { marginHorizontal: 20, marginBottom: 8, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1 },
  appearanceIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  menuItem: { marginHorizontal: 20, marginBottom: 8, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1 },
  logoutItem: { borderWidth: 1 },
  menuIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 16, fontWeight: '600' },
  menuDesc: { fontSize: 12, marginTop: 2 },
});
