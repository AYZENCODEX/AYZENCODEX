import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/hooks/useAuth";
import { useColors } from "@/hooks/useColors";

type Mode = "password" | "magic-link";
type MagicStep = "email" | "otp";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, sendMagicLink, verifyMagicLink } = useAuth();

  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [magicStep, setMagicStep] = useState<MagicStep>("email");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordRef = useRef<TextInput>(null);

  const handlePasswordLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await sendMagicLink(email.trim());
      setMagicStep("otp");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send code");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMagic = async () => {
    if (otp.length < 4) {
      setError("Enter the code sent to your email.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await verifyMagicLink(email.trim(), otp.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid code");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const s = makeStyles(colors, insets);

  const isMagicOtp = mode === "magic-link" && magicStep === "otp";

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={s.header}>
          <Text style={s.logo}>AYZEN</Text>
          <Text style={s.tagline}>Crypto Airdrop Command Center</Text>
        </View>

        {/* Mode toggle */}
        {!isMagicOtp && (
          <View style={[s.modeRow, { borderColor: colors.border }]}>
            <TouchableOpacity
              style={[s.modeBtn, mode === "password" && { backgroundColor: colors.accent }]}
              onPress={() => { setMode("password"); setError(""); }}
            >
              <Text style={[s.modeBtnText, { color: mode === "password" ? colors.primary : colors.mutedForeground }]}>
                Password
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modeBtn, mode === "magic-link" && { backgroundColor: colors.accent }]}
              onPress={() => { setMode("magic-link"); setMagicStep("email"); setError(""); }}
            >
              <Text style={[s.modeBtnText, { color: mode === "magic-link" ? colors.primary : colors.mutedForeground }]}>
                Magic Link
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Card */}
        <View style={s.card}>
          <Text style={s.title}>
            {isMagicOtp ? "Check your email" : "Sign In"}
          </Text>
          <Text style={s.subtitle}>
            {isMagicOtp
              ? `Enter the code sent to ${email}`
              : mode === "password"
              ? "Access your airdrop dashboard"
              : "We'll email you a one-time code"}
          </Text>

          {/* Email field — always show unless OTP step */}
          {!isMagicOtp && (
            <View style={s.inputGroup}>
              <Ionicons name="mail-outline" size={18} color={colors.mutedForeground} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="Email address"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType={mode === "password" ? "next" : "done"}
                onSubmitEditing={() =>
                  mode === "password" ? passwordRef.current?.focus() : handleMagicLink()
                }
              />
            </View>
          )}

          {/* Password (password mode only) */}
          {mode === "password" && (
            <View style={s.inputGroup}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} style={s.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={[s.input, { flex: 1 }]}
                placeholder="Password"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handlePasswordLogin}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={s.eyeBtn}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* OTP input (magic link step 2) */}
          {isMagicOtp && (
            <View style={s.inputGroup}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.mutedForeground} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="6-digit code"
                placeholderTextColor={colors.mutedForeground}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleVerifyMagic}
                autoFocus
              />
            </View>
          )}

          {!!error && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={
              mode === "password"
                ? handlePasswordLogin
                : isMagicOtp
                ? handleVerifyMagic
                : handleMagicLink
            }
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={s.btnText}>
                {mode === "password"
                  ? "Sign In"
                  : isMagicOtp
                  ? "Verify Code"
                  : "Send Code"}
              </Text>
            )}
          </TouchableOpacity>

          {isMagicOtp && (
            <TouchableOpacity onPress={() => { setMagicStep("email"); setOtp(""); setError(""); }}>
              <Text style={s.link}>← Resend code</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Register link */}
        <TouchableOpacity onPress={() => router.push("/auth/register")} style={s.registerBtn}>
          <Text style={s.registerText}>
            No account? <Text style={{ color: colors.primary }}>Register</Text>
          </Text>
        </TouchableOpacity>

        {/* Demo shortcuts */}
        <View style={s.demoBox}>
          <Text style={s.demoTitle}>DEMO ACCOUNTS</Text>
          <TouchableOpacity onPress={() => { setMode("password"); setEmail("user@ayzen.io"); setPassword("demo123"); }}>
            <Text style={s.demoItem}>👤  user@ayzen.io / demo123</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setMode("password"); setEmail("support@ayzen.tech"); setPassword("1234578@Ba1"); }}>
            <Text style={s.demoItem}>🛡  support@ayzen.tech / 1234578@Ba1</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(
  colors: ReturnType<typeof useColors>,
  insets: ReturnType<typeof useSafeAreaInsets>
) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    scroll: {
      flexGrow: 1,
      paddingTop: Platform.OS === "web" ? 67 : insets.top + 40,
      paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 32,
      paddingHorizontal: 24,
    },
    header: { alignItems: "center", marginBottom: 32 },
    logo: {
      fontSize: 36,
      fontWeight: "700",
      color: colors.primary,
      letterSpacing: 8,
      fontFamily: "SpaceMono_400Regular",
    },
    tagline: { fontSize: 12, color: colors.mutedForeground, marginTop: 6, letterSpacing: 1 },
    modeRow: {
      flexDirection: "row",
      borderWidth: 1,
      borderRadius: 10,
      overflow: "hidden",
      marginBottom: 16,
    },
    modeBtn: { flex: 1, alignItems: "center", paddingVertical: 11 },
    modeBtnText: { fontSize: 13, fontWeight: "600" },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: { fontSize: 22, fontWeight: "700", color: colors.foreground, marginBottom: 6 },
    subtitle: { fontSize: 13, color: colors.mutedForeground, marginBottom: 24 },
    inputGroup: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.input,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 14,
      paddingHorizontal: 14,
    },
    inputIcon: { marginRight: 10 },
    input: {
      flex: 1,
      height: 50,
      color: colors.foreground,
      fontSize: 15,
      fontFamily: "SpaceMono_400Regular",
    },
    eyeBtn: { padding: 6 },
    error: { color: colors.destructive, fontSize: 13, marginBottom: 14, textAlign: "center" },
    btn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: colors.primaryForeground, fontWeight: "700", fontSize: 16, letterSpacing: 0.5 },
    link: { color: colors.primary, textAlign: "center", marginTop: 16, fontSize: 14 },
    registerBtn: { marginTop: 20, alignItems: "center" },
    registerText: { color: colors.mutedForeground, fontSize: 14 },
    demoBox: {
      marginTop: 24,
      backgroundColor: colors.muted,
      borderRadius: 10,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    demoTitle: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 2,
      marginBottom: 8,
      fontFamily: "SpaceMono_400Regular",
    },
    demoItem: { color: colors.primary, fontSize: 12, marginBottom: 6, fontFamily: "SpaceMono_400Regular" },
  });
}
