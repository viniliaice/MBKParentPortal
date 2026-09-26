import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Image,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import AuroraBackground from '@/components/AuroraBackground';
import { isDemoMode } from '@/lib/demoMode';
import { useColors, type Colors } from '@/hooks/useColors';

export default function LoginScreen() {
  const { login } = useAuth();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    const err = await login(email, password);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <AuroraBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <Image source={require('@/assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
          </View>

          <Text style={styles.appName}>MBK Parent Portal</Text>
          <Text style={styles.subtitle}>Sign in to follow your child’s progress</Text>

          {isDemoMode() && (
            <View style={styles.demoBanner}>
              <Ionicons name="flask-outline" size={15} color={c.warning} />
              <Text style={styles.demoText}>
                Preview build: any email and password opens the app with example data.
                Nothing is sent to the school.
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.label}>Email address</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={c.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor={c.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={c.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                placeholderTextColor={c.placeholder}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.textSecondary} />
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={c.destructive} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
              <LinearGradient colors={c.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.loginGradient}>
                {loading ? <ActivityIndicator color={c.onBrand} /> : (
                  <>
                    <Text style={styles.loginBtnText}>Sign in</Text>
                    <Ionicons name="arrow-forward" size={18} color={c.onBrand} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.noteBox}>
            <Ionicons name="information-circle-outline" size={15} color={c.textSecondary} />
            <Text style={styles.noteText}>Use the email address the school registered for you</Text>
          </View>

          <Text style={styles.credit}>
            Made by{' '}
            <Text style={styles.creditName}>Eng. Akso</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuroraBackground>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24, alignItems: 'center' },
  logoContainer: { marginBottom: 20 },
  logoImage: { width: 100, height: 100, borderRadius: 50 },
  appName: { fontSize: 28, fontWeight: '800', color: c.foreground, letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 15, color: c.textSecondary, marginBottom: 36, textAlign: 'center' },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
    marginTop: -22,
    marginBottom: 22,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceMuted,
  },
  demoText: { flex: 1, fontSize: 12, lineHeight: 17, color: c.textSecondary },
  card: {
    width: '100%',
    backgroundColor: c.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: c.border,
  },
  label: { fontSize: 12, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.5, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.inputBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.inputBorder,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: c.foreground, fontSize: 15, paddingVertical: 14 },
  eyeBtn: { padding: 4 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.surfaceMuted,
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: c.destructive,
  },
  errorText: { color: c.destructive, fontSize: 13, flex: 1 },
  loginBtn: { marginTop: 24, borderRadius: 16, overflow: 'hidden' },
  loginGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  loginBtnText: { color: c.onBrand, fontSize: 16, fontWeight: '700' },
  noteBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20 },
  noteText: { color: c.textSecondary, fontSize: 12 },
  credit: { fontSize: 16, color: c.textDim, marginTop: 40, marginBottom: 10, textAlign: 'center', letterSpacing: 0.5 },
  creditName: { fontFamily: 'DancingScript_700Bold', fontSize: 22, color: c.textSecondary },
});
