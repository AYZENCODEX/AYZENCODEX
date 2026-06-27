import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface Project {
  id: number;
  name: string;
  description?: string;
  chain?: string;
  status?: string;
  tier?: string;
  rewardEstimate?: string;
  deadline?: string;
  xpPrice?: number;
  participantCount?: number;
}

function ProjectCard({
  item,
  colors,
}: {
  item: Project;
  colors: ReturnType<typeof useColors>;
}) {
  const tierColor =
    item.tier === "S"
      ? colors.primary
      : item.tier === "A"
      ? colors.secondary
      : item.tier === "B"
      ? colors.warning
      : colors.mutedForeground;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={styles.nameRow}>
          <View style={[styles.chainTag, { backgroundColor: colors.accent }]}>
            <Text style={[styles.chainText, { color: colors.primary }]}>
              {(item.chain ?? "ETH").slice(0, 5).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        <View style={[styles.tierBadge, { borderColor: tierColor }]}>
          <Text style={[styles.tierText, { color: tierColor }]}>
            {item.tier ?? "B"}
          </Text>
        </View>
      </View>

      {item.description ? (
        <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      <View style={styles.cardFooter}>
        <View style={styles.metaRow}>
          <Ionicons name="flash-outline" size={13} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {item.xpPrice ?? 0} XP/task
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="people-outline" size={13} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {item.participantCount ?? 0}
          </Text>
        </View>
        <View style={[styles.statusBadge, {
          backgroundColor: item.status === "active" ? colors.accent : colors.muted,
        }]}>
          <Text style={[styles.statusText, {
            color: item.status === "active" ? colors.primary : colors.mutedForeground,
          }]}>
            {item.status ?? "active"}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function ProjectsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useQuery<{ projects: Project[]; total: number }>({
    queryKey: ["/api/projects?limit=50"],
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const projects = data?.projects ?? [];
  const filtered = search
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.chain ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : projects;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 12 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Protocols</Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {filtered.length} active
        </Text>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { paddingHorizontal: 16, marginBottom: 8 }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search protocols..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <ProjectCard item={item} colors={colors} />}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!filtered.length}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="layers-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Protocols</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {search ? "No results found" : "No active protocols yet"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 26, fontWeight: "700" },
  count: { fontSize: 13, fontFamily: "SpaceMono_400Regular" },
  searchWrap: {},
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, height: "100%" },
  listContent: { paddingHorizontal: 16, paddingTop: 8 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  nameRow: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  chainTag: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chainText: { fontSize: 10, fontWeight: "700", fontFamily: "SpaceMono_400Regular" },
  name: { fontSize: 16, fontWeight: "600", flex: 1 },
  tierBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tierText: { fontSize: 13, fontWeight: "700" },
  desc: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontFamily: "SpaceMono_400Regular" },
  statusBadge: { marginLeft: "auto", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontFamily: "SpaceMono_400Regular" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptyText: { fontSize: 13 },
});
