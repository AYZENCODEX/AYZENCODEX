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

type Step = "form" | "otp";

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { sendOtp, register } = useAuth();

  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleSendOtp = async () => {
    if (!email.trim() || !username.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await sendOtp(email.trim());
      setStep("otp");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send OTP");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (otp.length < 4) {
      setError("Enter the OTP sent to your email.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await register(email.trim(), username.trim(), password, otp.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Registration failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const s = makeStyles(colors, insets);

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
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <View style={s.header}>
          <Text style={s.logo}>AYZEN</Text>
          <Text style={s.tagline}>Join the Airdrop Network</Text>
        </View>

        <View style={s.card}>
          <Text style={s.title}>
            {step === "form" ? "Create Account" : "Verify Email"}
          </Text>
          <Text style={s.subtitle}>
            {step === "form"
              ? "Start earning from airdrops"
              : `Enter the 6-digit code sent to ${email}`}
          </Text>

          {step === "form" ? (
            <>
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
                  returnKeyType="next"
                  onSubmitEditing={() => usernameRef.current?.focus()}
                />
              </View>

              <View style={s.inputGroup}>
                <Ionicons name="person-outline" size={18} color={colors.mutedForeground} style={s.inputIcon} />
                <TextInput
                  ref={usernameRef}
                  style={s.input}
                  placeholder="Username"
                  placeholderTextColor={colors.mutedForeground}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>

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
                  onSubmitEditing={handleSendOtp}
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={s.eyeBtn}>
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={s.inputGroup}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.mutedForeground} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="6-digit OTP"
                placeholderTextColor={colors.mutedForeground}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
                autoFocus
              />
            </View>
          )}

          {!!error && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={step === "form" ? handleSendOtp : handleRegister}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={s.btnText}>
                {step === "form" ? "Continue" : "Create Account"}
              </Text>
            )}
          </TouchableOpacity>

          {step === "otp" && (
            <TouchableOpacity onPress={() => { setStep("form"); setOtp(""); setError(""); }}>
              <Text style={s.link}>← Edit details</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    scroll: {
      flexGrow: 1,
      paddingTop: insets.top + 16,
      paddingBottom: insets.bottom + 32,
      paddingHorizontal: 24,
    },
    backBtn: { marginBottom: 24, alignSelf: "flex-start" },
    header: { alignItems: "center", marginBottom: 36 },
    logo: {
      fontSize: 32,
      fontWeight: "700",
      color: colors.primary,
      letterSpacing: 8,
      fontFamily: "SpaceMono_400Regular",
    },
    tagline: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 6,
      letterSpacing: 1,
      fontFamily: "SpaceMono_400Regular",
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 6,
    },
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
    error: {
      color: colors.destructive,
      fontSize: 13,
      marginBottom: 14,
      textAlign: "center",
    },
    btn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: {
      color: colors.primaryForeground,
      fontWeight: "700",
      fontSize: 16,
    },
    link: { color: colors.primary, textAlign: "center", marginTop: 16, fontSize: 14 },
  });
}
