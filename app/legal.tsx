import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import AuroraBackground from '@/components/AuroraBackground';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL, POLICY_LAST_UPDATED } from '@/constants/legal';

/**
 * In-app privacy summary.
 *
 * The authoritative policy is the school's published page (PRIVACY_POLICY_URL,
 * https://schoolnnnnass.vercel.app/privacy-policy) — it covers the app and the
 * website, names the service providers, and is what the Play listing points at.
 * This screen is a short summary of it; where the two could be read differently,
 * the published policy wins. Keep it in step with docs/privacy-policy.md and the
 * published page when either changes.
 */
const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'Who runs this app',
    body: [
      'MBK Parent Portal is provided by your child’s school. The school decides which accounts exist and what data is shown in the app.',
    ],
  },
  {
    title: 'What the app collects',
    body: [
      'Account details: your name, email address and phone numbers, and the password you sign in with (stored by our authentication provider, never in the app).',
      'Your children’s school records: name, class, attendance, homework, exam and quiz results.',
      'Messages you exchange with teachers through the app.',
      'Learning progress: completed lessons, quiz attempts, accuracy and points.',
      'A push-notification token for the device, so the school can notify you about homework, messages and announcements.',
      'The app does not collect location, contacts, photos, camera or microphone data, and contains no advertising or analytics SDKs.',
    ],
  },
  {
    title: 'Why it is used',
    body: [
      'To sign you in, to show your children’s school information, to let you message teachers, and to send you notifications about school activity.',
      'Data is never sold, and is not used for advertising or profiling.',
    ],
  },
  {
    title: 'Who can see it',
    body: [
      'You: your own children’s records and your own conversations.',
      'Teachers: records for the classes they are responsible for.',
      'School administrators: school-wide records, as they need to run the school.',
      'Service providers who host the app (database, authentication, push delivery) process the data on the school’s behalf only.',
      'Technical measures: access to records is enforced by the database itself, per account and per class, not just by the app.',
    ],
  },
  {
    title: 'How long it is kept',
    body: [
      'When the school closes your account at your request, your sign-in access, phone numbers, messages and push token are removed.',
      'Your child’s school records (enrolment, attendance, homework and marks) are kept by the school, as schools are required to keep academic records. They are no longer linked to your account once it is closed.',
      'To have a school record corrected or removed, contact the school office.',
    ],
  },
  {
    title: 'Your choices',
    body: [
      'You can turn notifications off in your device settings at any time.',
      'Accounts are created and managed by the school office. To close your account, send a request from More → Close account, or write to the school office — the office handles the change on the school’s records.',
      'You can ask the school office for a copy of the data held about you, or ask for a correction.',
    ],
  },
];

export default function LegalScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const openPolicy = async () => {
    if (!PRIVACY_POLICY_URL) return;
    await WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL);
  };

  const contact = async () => {
    if (!SUPPORT_EMAIL) return;
    await Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
  };

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Privacy & Data</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.updated}>Last updated {POLICY_LAST_UPDATED}</Text>

          {SECTIONS.map(section => (
            <View key={section.title} style={styles.card}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.body.map(line => (
                <Text key={line} style={styles.paragraph}>
                  {line}
                </Text>
              ))}
            </View>
          ))}

          <TouchableOpacity style={styles.action} onPress={() => router.push('/account')} activeOpacity={0.8}>
            <Ionicons name="person-remove-outline" size={20} color="#FF5370" />
            <Text style={[styles.actionText, { color: '#FF5370' }]}>Ask the school to close my account</Text>
            <Ionicons name="chevron-forward" size={16} color="#8892B0" />
          </TouchableOpacity>

          {PRIVACY_POLICY_URL ? (
            <TouchableOpacity style={styles.action} onPress={openPolicy} activeOpacity={0.8}>
              <Ionicons name="open-outline" size={20} color="#3D5AFE" />
              <Text style={[styles.actionText, { color: '#3D5AFE' }]}>Read the full policy</Text>
              <Ionicons name="chevron-forward" size={16} color="#8892B0" />
            </TouchableOpacity>
          ) : null}

          {SUPPORT_EMAIL ? (
            <TouchableOpacity style={styles.action} onPress={contact} activeOpacity={0.8}>
              <Ionicons name="mail-outline" size={20} color="#3D5AFE" />
              <Text style={[styles.actionText, { color: '#3D5AFE' }]}>{SUPPORT_EMAIL}</Text>
              <Ionicons name="chevron-forward" size={16} color="#8892B0" />
            </TouchableOpacity>
          ) : (
            <Text style={styles.pendingNote}>
              This screen is a summary. The school’s published policy — which covers this app and the website — is
              the version that applies.
            </Text>
          )}
        </ScrollView>
      </View>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  body: { padding: 20, paddingBottom: 60, gap: 14 },
  updated: { color: '#4A5080', fontSize: 12 },
  card: { backgroundColor: 'rgba(20,29,58,0.9)', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  paragraph: { fontSize: 14, lineHeight: 21, color: '#B9C2DA' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(20,29,58,0.9)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  actionText: { flex: 1, fontSize: 15, fontWeight: '600' },
  pendingNote: { color: '#8892B0', fontSize: 12, lineHeight: 18, paddingHorizontal: 4 },
});
