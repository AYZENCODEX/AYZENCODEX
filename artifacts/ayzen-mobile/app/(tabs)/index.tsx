import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { useColors } from "@/hooks/useColors";

interface DashboardStats {
  totalXp?: number;
  aznBalance?: number;
  credits?: number;
  completedTasks?: number;
  activeProjects?: number;
  rank?: number;
}

interface Project {
  id: number;
  name: string;
  chain?: string;
  status?: string;
  rewardEstimate?: string;
}

interface RecentActivity {
  id: number;
  action: string;
  createdAt: string;
}

function StatCard({
  label,
  value,
  icon,
  accent,
  colors,
}: {
  label: string;
  value: string;
  icon: string;
  accent?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[
      cardStyles.card,
      {
        backgroundColor: colors.card,
        borderColor: accent ? colors.primary : colors.border,
      },
    ]}>
      <View style={[cardStyles.iconWrap, { backgroundColor: accent ? colors.accent : colors.muted }]}>
        <Ionicons name={icon as any} size={20} color={accent ? colors.primary : colors.mutedForeground} />
      </View>
      <Text style={[cardStyles.value, { color: accent ? colors.primary : colors.foreground }]}>
        {value}
      </Text>
      <Text style={[cardStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    flex: 1,
    minWidth: 140,
    borderWidth: 1,
    margin: 4,
    alignItems: "flex-start",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  value: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  label: { fontSize: 11, letterSpacing: 0.5, fontFamily: "SpaceMono_400Regular" },
});

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<DashboardStats>({
    queryKey: ["/api/users/me/stats"],
  });

  const { data: projectsData, isLoading: projectsLoading, refetch: refetchProjects } = useQuery<{
    projects: Project[];
    total: number;
  }>({
    queryKey: ["/api/projects?page=1&limit=3"],
  });

  const { data: activity, refetch: refetchActivity } = useQuery<RecentActivity[]>({
    queryKey: ["/api/history?limit=5"],
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchProjects(), refetchActivity()]);
    setRefreshing(false);
  };

  const s = makeStyles(colors, insets);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 12 }]}>
        <View>
          <Text style={s.greeting}>GM, {user?.username ?? "Operator"}</Text>
          <Text style={s.subGreeting}>Your airdrop dashboard</Text>
        </View>
        <View style={s.badgeWrap}>
          <View style={s.badge}>
            <Ionicons name="star" size={12} color={colors.primary} />
            <Text style={s.badgeText}>{user?.role === "admin" ? "Admin" : "Operator"}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Stats Grid */}
        <Text style={s.sectionLabel}>OVERVIEW</Text>
        {statsLoading ? (
          <View style={s.loader}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            <View style={s.row}>
              <StatCard
                label="AZN Balance"
                value={formatNum(stats?.aznBalance ?? user?.aznBalance ?? 0)}
                icon="diamond-outline"
                accent
                colors={colors}
              />
              <StatCard
                label="XP Earned"
                value={formatNum(stats?.totalXp ?? user?.xpBalance ?? 0)}
                icon="flash-outline"
                colors={colors}
              />
            </View>
            <View style={s.row}>
              <StatCard
                label="Tasks Done"
                value={String(stats?.completedTasks ?? 0)}
                icon="checkbox-outline"
                colors={colors}
              />
              <StatCard
                label="Active Projects"
                value={String(stats?.activeProjects ?? 0)}
                icon="layers-outline"
                colors={colors}
              />
            </View>
          </>
        )}

        {/* Active Projects */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionLabel}>ACTIVE PROTOCOLS</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/projects")}>
            <Text style={s.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {projectsLoading ? (
          <View style={s.loader}><ActivityIndicator color={colors.primary} /></View>
        ) : (projectsData?.projects?.length ?? 0) === 0 ? (
          <View style={s.empty}>
            <Ionicons name="layers-outline" size={32} color={colors.mutedForeground} />
            <Text style={s.emptyText}>No active protocols</Text>
          </View>
        ) : (
          projectsData?.projects?.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[s.projectCard, { borderColor: colors.border }]}
              onPress={() => router.push("/(tabs)/projects")}
              activeOpacity={0.7}
            >
              <View style={s.projectLeft}>
                <View style={[s.chainBadge, { backgroundColor: colors.accent }]}>
                  <Text style={[s.chainText, { color: colors.primary }]}>
                    {(p.chain ?? "ETH").slice(0, 4).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={[s.projectName, { color: colors.foreground }]}>{p.name}</Text>
                  <Text style={[s.projectSub, { color: colors.mutedForeground }]}>
                    {p.status ?? "Active"}
                  </Text>
                </View>
              </View>
              <View style={s.projectRight}>
                <Text style={[s.reward, { color: colors.primary }]}>
                  {p.rewardEstimate ?? "—"}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Recent Activity */}
        {(activity?.length ?? 0) > 0 && (
          <>
            <Text style={[s.sectionLabel, { marginTop: 24 }]}>RECENT ACTIVITY</Text>
            {activity?.slice(0, 4).map((a) => (
              <View key={a.id} style={[s.activityRow, { borderColor: colors.border }]}>
                <View style={[s.activityDot, { backgroundColor: colors.primary }]} />
                <View style={s.activityInfo}>
                  <Text style={[s.activityAction, { color: colors.foreground }]}>{a.action}</Text>
                  <Text style={[s.activityTime, { color: colors.mutedForeground }]}>
                    {formatTime(a.createdAt)}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={{ height: Platform.OS === "web" ? 34 : 24 }} />
      </ScrollView>
    </View>
  );
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    greeting: { fontSize: 22, fontWeight: "700", color: colors.foreground },
    subGreeting: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
    badgeWrap: {},
    badge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.accent,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
      gap: 4,
    },
    badgeText: { color: colors.primary, fontSize: 11, fontFamily: "SpaceMono_400Regular" },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16 },
    sectionLabel: {
      fontSize: 10,
      color: colors.mutedForeground,
      letterSpacing: 2,
      fontFamily: "SpaceMono_400Regular",
      marginTop: 20,
      marginBottom: 10,
      marginLeft: 4,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 20,
      marginBottom: 10,
      paddingHorizontal: 4,
    },
    seeAll: { color: colors.primary, fontSize: 12, fontFamily: "SpaceMono_400Regular" },
    row: { flexDirection: "row", marginHorizontal: -4 },
    loader: { padding: 24, alignItems: "center" },
    empty: { alignItems: "center", padding: 32, gap: 8 },
    emptyText: { color: colors.mutedForeground, fontSize: 14 },
    projectCard: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
    },
    projectLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
    chainBadge: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    chainText: { fontSize: 10, fontWeight: "700", fontFamily: "SpaceMono_400Regular" },
    projectName: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
    projectSub: { fontSize: 11, fontFamily: "SpaceMono_400Regular" },
    projectRight: { flexDirection: "row", alignItems: "center", gap: 6 },
    reward: { fontSize: 13, fontWeight: "600" },
    activityRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      gap: 12,
    },
    activityDot: { width: 6, height: 6, borderRadius: 3 },
    activityInfo: { flex: 1 },
    activityAction: { fontSize: 13, fontWeight: "500" },
    activityTime: { fontSize: 11, marginTop: 2 },
  });
}
