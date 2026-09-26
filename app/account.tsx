import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import AuroraBackground from '@/components/AuroraBackground';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { requestAccountDeletion } from '@/lib/accountDeletion';
import { ACCOUNT_DELETION_URL, PRIVACY_POLICY_URL, SUPPORT_EMAIL } from '@/constants/legal';

/**
 * Account deletion — as a request to the school.
 *
 * Accounts are created and administered by the school office, and the school's
 * published privacy policy (§11) says deletion requests are handled by the
 * school. So there is no self-service delete here: the app sends the request,
 * the office confirms it and acts on the school's records.
 *
 * Two distinct things, kept apart in the wording below:
 *  - the parent's *account*: removed by the school on request
 *  - the child's *school records*: kept by the school, and de-linked from the account
 *
 * The wording must stay in step with docs/account-deletion.md, app/legal.tsx and
 * the published policy.
 */
export default function AccountScreen() {
  const { user } = useAuth();
  const c = useColors();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const confirmRequest = () => {
    Alert.alert(
      'Ask the school to close your account?',
      'The school office receives your request and will contact you before anything is removed. ' +
        'Your account stays active until they act on it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send request',
          onPress: async () => {
            setBusy(true);
            const result = await requestAccountDeletion(reason);
            setBusy(false);
            if (!result.ok) {
              Alert.alert('Request not sent', result.error ?? 'Please try again.');
              return;
            }
            Alert.alert(
              'Request sent',
              SUPPORT_EMAIL
                ? `The school office has been notified. You can also write to ${SUPPORT_EMAIL}.`
                : 'The school office has been notified and will contact you.',
            );
            setReason('');
          },
        },
      ],
    );
  };

  const openPolicy = async () => {
    if (!PRIVACY_POLICY_URL) return;
    await WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL);
  };

  const openWebResource = async () => {
    if (!ACCOUNT_DELETION_URL) return;
    await WebBrowser.openBrowserAsync(ACCOUNT_DELETION_URL);
  };

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <TopBar title="Close Account" />

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>Signed in as</Text>
            <Text style={[styles.mono, { color: c.mutedForeground }]}>{user?.email}</Text>
          </View>

          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>How it works</Text>
            <Text style={[styles.hint, { color: c.mutedForeground }]}>
              Accounts for this portal are created and managed by the school office. Send a request below and the
              office will contact you, confirm what can be removed, and act on the school’s records.
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>The school will remove</Text>
            {[
              'Your sign-in access and password',
              'Your name, email and phone numbers',
              'Your messages with teachers',
              'Your device’s push-notification token',
            ].map(line => (
              <View key={line} style={styles.row}>
                <Ionicons name="close-circle-outline" size={16} color={c.destructive} />
                <Text style={[styles.rowText, { color: c.foreground }]}>{line}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>The school keeps</Text>
            {[
              'Your child’s enrolment record',
              'Attendance, homework and exam marks',
            ].map(line => (
              <View key={line} style={styles.row}>
                <Ionicons name="information-circle-outline" size={16} color={c.warning} />
                <Text style={[styles.rowText, { color: c.foreground }]}>{line}</Text>
              </View>
            ))}
            <Text style={[styles.hint, { color: c.mutedForeground }]}>
              Schools are required to keep academic records. These stay with the school and are no longer linked to
              your account. Ask the office if you want a record corrected or removed.
            </Text>
          </View>

          <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>OPTIONAL — TELL THE SCHOOL WHY</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.foreground }]}
            value={reason}
            onChangeText={setReason}
            placeholder="Moving away, duplicate account…"
            placeholderTextColor={c.mutedForeground}
            multiline
          />

          <TouchableOpacity style={[styles.dangerBtn, { backgroundColor: c.destructive }]} onPress={confirmRequest} disabled={busy} activeOpacity={0.85}>
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" />
                <Text style={styles.dangerText}>Send the request to the school</Text>
              </>
            )}
          </TouchableOpacity>

          {PRIVACY_POLICY_URL ? (
            <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: `${c.primary}24` }]} onPress={openPolicy} activeOpacity={0.85}>
              <Ionicons name="open-outline" size={18} color={c.primary} />
              <Text style={[styles.secondaryText, { color: c.primary }]}>Read the school’s privacy policy</Text>
            </TouchableOpacity>
          ) : null}

          {ACCOUNT_DELETION_URL ? (
            <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: `${c.primary}24` }]} onPress={openWebResource} activeOpacity={0.85}>
              <Ionicons name="open-outline" size={18} color={c.primary} />
              <Text style={[styles.secondaryText, { color: c.primary }]}>Deletion information on the web</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.hint, { color: c.mutedForeground }]}>
              You can also contact the school office directly{SUPPORT_EMAIL ? ` at ${SUPPORT_EMAIL}` : ''} to ask
              about your account or your child’s records.
            </Text>
          )}
        </ScrollView>
      </View>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
  card: { borderRadius: 16, padding: 16, gap: 8, borderWidth: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  mono: { fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowText: { flex: 1, fontSize: 13, lineHeight: 19 },
  hint: { fontSize: 12.5, lineHeight: 19, marginTop: 4 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.8, fontWeight: '700', marginTop: 6 },
  input: { borderRadius: 14, padding: 14, minHeight: 92, textAlignVertical: 'top', borderWidth: 1 },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 15 },
  dangerText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14 },
  secondaryText: { fontSize: 14, fontWeight: '600' },
});
