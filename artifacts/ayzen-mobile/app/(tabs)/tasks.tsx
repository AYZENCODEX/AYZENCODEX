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
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { apiRequest } from "@/lib/query-client";

interface Task {
  id: number;
  title: string;
  description?: string;
  type?: string;
  status?: string;
  xpAmount?: number;
  projectName?: string;
  projectId?: number;
  deadline?: string;
  isCompleted?: boolean;
}

type Filter = "all" | "pending" | "completed";

function TaskCard({
  item,
  colors,
  onVisit,
  visiting,
}: {
  item: Task;
  colors: ReturnType<typeof useColors>;
  onVisit: (id: number) => void;
  visiting: boolean;
}) {
  const isCompleted = item.status === "completed" || item.status === "approved" || item.isCompleted;

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: colors.card,
        borderColor: isCompleted ? colors.border : colors.border,
        opacity: isCompleted ? 0.7 : 1,
      },
    ]}>
      <View style={styles.cardTop}>
        <View style={[
          styles.typeIcon,
          { backgroundColor: isCompleted ? colors.muted : colors.accent },
        ]}>
          <Ionicons
            name={isCompleted ? "checkmark-circle" : "ellipse-outline"}
            size={20}
            color={isCompleted ? colors.mutedForeground : colors.primary}
          />
        </View>
        <View style={styles.titleWrap}>
          <Text
            style={[styles.title, { color: isCompleted ? colors.mutedForeground : colors.foreground }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {item.projectName ? (
            <Text style={[styles.project, { color: colors.secondary }]}>
              {item.projectName}
            </Text>
          ) : null}
        </View>
        <View style={[styles.xpBadge, { backgroundColor: colors.accent }]}>
          <Text style={[styles.xpText, { color: colors.primary }]}>+{item.xpAmount ?? 0}</Text>
          <Text style={[styles.xpLabel, { color: colors.primary }]}>XP</Text>
        </View>
      </View>

      {item.description ? (
        <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      <View style={styles.cardBottom}>
        {item.type && (
          <View style={[styles.typeBadge, { backgroundColor: colors.muted }]}>
            <Text style={[styles.typeText, { color: colors.mutedForeground }]}>{item.type}</Text>
          </View>
        )}
        {!isCompleted && (
          <TouchableOpacity
            style={[styles.visitBtn, { backgroundColor: colors.primary, opacity: visiting ? 0.6 : 1 }]}
            onPress={() => onVisit(item.id)}
            disabled={visiting}
            activeOpacity={0.8}
          >
            {visiting ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <>
                <Ionicons name="link-outline" size={13} color={colors.primaryForeground} />
                <Text style={[styles.visitText, { color: colors.primaryForeground }]}>Visit</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function TasksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>("all");
  const [visitingId, setVisitingId] = useState<number | null>(null);
  const qc = useQueryClient();

  const { data: tasks = [], isLoading, refetch } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const visitMutation = useMutation({
    mutationFn: (taskId: number) =>
      apiRequest("POST", `/api/tasks/${taskId}/visit`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const handleVisit = async (id: number) => {
    setVisitingId(id);
    try {
      await visitMutation.mutateAsync(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    finally {
      setVisitingId(null);
    }
  };

  const filtered = tasks.filter((t) => {
    const done = t.status === "completed" || t.status === "approved" || t.isCompleted;
    if (filter === "pending") return !done;
    if (filter === "completed") return done;
    return true;
  });

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "completed", label: "Done" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 12 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Tasks</Text>
        <Text style={[styles.headerCount, { color: colors.mutedForeground }]}>
          {filtered.length} tasks
        </Text>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterPill,
              {
                backgroundColor: filter === f.key ? colors.primary : colors.muted,
                borderColor: filter === f.key ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[
              styles.filterText,
              { color: filter === f.key ? colors.primaryForeground : colors.mutedForeground },
            ]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TaskCard
              item={item}
              colors={colors}
              onVisit={handleVisit}
              visiting={visitingId === item.id}
            />
          )}
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
              <Ionicons name="checkbox-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Tasks</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {filter === "completed"
                  ? "Complete some tasks to see them here"
                  : "No tasks available right now"}
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
  headerTitle: { fontSize: 26, fontWeight: "700" },
  headerCount: { fontSize: 13, fontFamily: "SpaceMono_400Regular" },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderWidth: 1,
  },
  filterText: { fontSize: 13, fontWeight: "600" },
  listContent: { paddingHorizontal: 16, paddingTop: 4 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  typeIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  titleWrap: { flex: 1 },
  title: { fontSize: 15, fontWeight: "600", lineHeight: 20 },
  project: { fontSize: 11, marginTop: 3, fontFamily: "SpaceMono_400Regular" },
  xpBadge: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 44,
  },
  xpText: { fontSize: 14, fontWeight: "700" },
  xpLabel: { fontSize: 9, fontFamily: "SpaceMono_400Regular" },
  desc: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  cardBottom: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeText: { fontSize: 11, fontFamily: "SpaceMono_400Regular" },
  visitBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 5,
  },
  visitText: { fontSize: 12, fontWeight: "600" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptyText: { fontSize: 13, textAlign: "center", paddingHorizontal: 24 },
});
