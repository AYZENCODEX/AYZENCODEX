import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { useColors } from "@/hooks/useColors";

interface LeaderboardEntry {
  rank: number;
  username: string;
  xpBalance?: number;
  aznBalance?: number;
}

function MenuItem({
  icon,
  label,
  value,
  onPress,
  danger,
  colors,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.menuIcon, { backgroundColor: danger ? "#2d0f0f" : colors.muted }]}>
        <Ionicons
          name={icon as any}
          size={18}
          color={danger ? colors.destructive : colors.mutedForeground}
        />
      </View>
      <Text style={[styles.menuLabel, { color: danger ? colors.destructive : colors.foreground }]}>
        {label}
      </Text>
      {value && (
        <Text style={[styles.menuValue, { color: colors.mutedForeground }]}>{value}</Text>
      )}
      {onPress && (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={danger ? colors.destructive : colors.mutedForeground}
        />
      )}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const { data: leaderboard = [] } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard?limit=5"],
  });

  const myRank = leaderboard.findIndex((e) => e.username === user?.username) + 1;

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          try {
            await logout();
            router.replace("/auth/login");
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top + 20,
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar / Header */}
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: colors.accent, borderColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {user?.username?.slice(0, 2).toUpperCase() ?? "??"}
            </Text>
          </View>
          <Text style={[styles.username, { color: colors.foreground }]}>
            {user?.username ?? "Unknown"}
          </Text>
          <Text style={[styles.email, { color: colors.mutedForeground }]}>
            {user?.email ?? ""}
          </Text>
          <View style={[styles.roleBadge, { backgroundColor: colors.accent, borderColor: colors.primary }]}>
            <Text style={[styles.roleText, { color: colors.primary }]}>
              {user?.role?.toUpperCase() ?? "USER"}
            </Text>
          </View>
        </View>

        {/* Stats Strip */}
        <View style={[styles.statsStrip, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {user?.aznBalance?.toFixed(2) ?? "0.00"}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>AZN</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {user?.xpBalance ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>XP</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.secondary }]}>
              #{myRank > 0 ? myRank : "—"}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Rank</Text>
          </View>
        </View>

        {/* Top 5 Leaderboard */}
        {leaderboard.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              TOP OPERATORS
            </Text>
            {leaderboard.slice(0, 5).map((entry, idx) => (
              <View key={entry.rank ?? idx} style={[
                styles.leaderRow,
                { borderBottomColor: colors.border },
                idx === leaderboard.slice(0, 5).length - 1 && { borderBottomWidth: 0 },
              ]}>
                <Text style={[
                  styles.leaderRank,
                  { color: idx === 0 ? colors.primary : colors.mutedForeground },
                ]}>
                  #{entry.rank ?? idx + 1}
                </Text>
                <Text style={[
                  styles.leaderName,
                  { color: entry.username === user?.username ? colors.primary : colors.foreground },
                ]}>
                  {entry.username}
                  {entry.username === user?.username ? " (you)" : ""}
                </Text>
                <Text style={[styles.leaderXp, { color: colors.mutedForeground }]}>
                  {entry.xpBalance ?? 0} XP
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Menu */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ACCOUNT</Text>
          <MenuItem
            icon="person-outline"
            label="Username"
            value={user?.username}
            colors={colors}
          />
          <MenuItem
            icon="mail-outline"
            label="Email"
            value={user?.email}
            colors={colors}
          />
          <MenuItem
            icon="id-card-outline"
            label="Role"
            value={user?.role}
            colors={colors}
          />
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: colors.destructive }]}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.8}
        >
          {loggingOut ? (
            <ActivityIndicator color={colors.destructive} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
              <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  profileHeader: { alignItems: "center", marginBottom: 20 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: "700" },
  username: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  email: { fontSize: 13, fontFamily: "SpaceMono_400Regular", marginBottom: 10 },
  roleBadge: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
  },
  roleText: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  statsStrip: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  statLabel: { fontSize: 10, letterSpacing: 1, fontFamily: "SpaceMono_400Regular" },
  statDivider: { width: 1, marginHorizontal: 8 },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: "SpaceMono_400Regular",
    padding: 14,
    paddingBottom: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: { flex: 1, fontSize: 15 },
  menuValue: { fontSize: 13, fontFamily: "SpaceMono_400Regular" },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  leaderRank: { fontSize: 13, fontWeight: "700", width: 28, fontFamily: "SpaceMono_400Regular" },
  leaderName: { flex: 1, fontSize: 14 },
  leaderXp: { fontSize: 12, fontFamily: "SpaceMono_400Regular" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    height: 52,
    gap: 10,
    marginBottom: 8,
  },
  logoutText: { fontSize: 16, fontWeight: "600" },
});
