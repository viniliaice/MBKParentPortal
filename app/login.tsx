import React, { useState } from 'react';
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
import { useColors } from '@/hooks/useColors';

export default function LoginScreen() {
  const { login } = useAuth();
  const c = useColors();
  const insets = useSafeAreaInsets();
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
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]} keyboardShouldPersistTaps="handled">
          <View style={styles.logoContainer}>
            <Image source={require('@/assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
          </View>

          <Text style={[styles.appName, { color: c.foreground }]}>MBK Parent Portal</Text>
          <Text style={[styles.subtitle, { color: c.mutedForeground }]}>Sign in to track your child's progress</Text>

          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.label, { color: c.mutedForeground }]}>Email Address</Text>
            <View style={[styles.inputWrap, { backgroundColor: c.input, borderColor: c.border }]}>
              <Ionicons name="mail-outline" size={18} color={c.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: c.foreground }]}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor={c.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={[styles.label, { color: c.mutedForeground, marginTop: 16 }]}>Password</Text>
            <View style={[styles.inputWrap, { backgroundColor: c.input, borderColor: c.border }]}>
              <Ionicons name="lock-closed-outline" size={18} color={c.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: c.foreground }]}
                value={password}
                onChangeText={setPassword}
                placeholder="password123"
                placeholderTextColor={c.mutedForeground}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.mutedForeground} />
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: `${c.destructive}1A`, borderColor: `${c.destructive}40` }]}>
                <Ionicons name="alert-circle-outline" size={16} color={c.destructive} />
                <Text style={[styles.errorText, { color: c.destructive }]}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
              <LinearGradient colors={[c.primary, c.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.loginGradient}>
                {loading ? <ActivityIndicator color="#FFFFFF" /> : (
                  <>
                    <Text style={styles.loginBtnText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.demoBox}>
            <Ionicons name="information-circle-outline" size={15} color={c.mutedForeground} />
            <Text style={[styles.demoText, { color: c.mutedForeground }]}>Use your registered email to sign in</Text>
          </View>

          <Text style={[styles.credit, { color: c.mutedForeground }]}>
            Made by{' '}
            <Text style={[styles.creditName, { color: c.mutedForeground }]}>Eng. Akso</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24, alignItems: 'center' },
  logoContainer: { marginBottom: 20 },
  logoImage: { width: 100, height: 100, borderRadius: 50 },
  appName: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 15, marginBottom: 36 },
  card: { width: '100%', borderRadius: 24, padding: 24, borderWidth: 1 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingHorizontal: 14 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, paddingVertical: 14 },
  eyeBtn: { padding: 4 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 12, marginTop: 14, borderWidth: 1 },
  errorText: { fontSize: 13, flex: 1 },
  loginBtn: { marginTop: 24, borderRadius: 16, overflow: 'hidden' },
  loginGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  loginBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  demoBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20 },
  demoText: { fontSize: 12 },
  credit: { fontSize: 16, marginTop: 40, marginBottom: 10, textAlign: 'center', letterSpacing: 0.5 },
  creditName: { fontFamily: 'DancingScript_700Bold', fontSize: 22 },
});
