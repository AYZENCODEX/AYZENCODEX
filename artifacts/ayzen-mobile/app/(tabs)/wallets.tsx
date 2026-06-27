import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { apiRequest } from "@/lib/query-client";

interface Wallet {
  id: number;
  address: string;
  chain?: string;
  label?: string;
  balance?: string;
  network?: string;
}

interface WalletBalance {
  azn: number;
  usdt: number;
  credits: number;
}

function WalletCard({
  item,
  colors,
}: {
  item: Wallet;
  colors: ReturnType<typeof useColors>;
}) {
  const short = item.address
    ? `${item.address.slice(0, 8)}...${item.address.slice(-6)}`
    : "—";

  const handleCopy = async () => {
    if (item.address) {
      await Clipboard.setStringAsync(item.address);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <View style={[styles.walletCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.walletHeader}>
        <View style={[styles.chainIcon, { backgroundColor: colors.accent }]}>
          <Text style={[styles.chainIconText, { color: colors.primary }]}>
            {(item.chain ?? item.network ?? "ETH").slice(0, 3).toUpperCase()}
          </Text>
        </View>
        <View style={styles.walletInfo}>
          <Text style={[styles.walletLabel, { color: colors.foreground }]}>
            {item.label ?? item.chain ?? "Wallet"}
          </Text>
          <Text style={[styles.walletAddr, { color: colors.mutedForeground }]}>{short}</Text>
        </View>
        <TouchableOpacity onPress={handleCopy} style={styles.copyBtn}>
          <Ionicons name="copy-outline" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      {item.balance && item.balance !== "0" && (
        <View style={[styles.balanceRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>Balance</Text>
          <Text style={[styles.balanceValue, { color: colors.primary }]}>{item.balance}</Text>
        </View>
      )}
    </View>
  );
}

export default function WalletsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data: wallets = [], isLoading, refetch } = useQuery<Wallet[]>({
    queryKey: ["/api/wallets"],
  });

  const { data: balances } = useQuery<WalletBalance>({
    queryKey: ["/api/wallets/tokens"],
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const createBuiltinMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/wallets/builtin/create", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/wallets"] });
      qc.invalidateQueries({ queryKey: ["/api/wallets/tokens"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: Error) => {
      Alert.alert("Error", e.message);
    },
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 12 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Wallets</Text>
      </View>

      {/* Balance Cards */}
      <View style={styles.balanceCards}>
        <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          <Ionicons name="diamond-outline" size={20} color={colors.primary} />
          <Text style={[styles.balanceAmount, { color: colors.primary }]}>
            {balances?.azn?.toFixed(2) ?? "0.00"}
          </Text>
          <Text style={[styles.balanceToken, { color: colors.mutedForeground }]}>AZN</Text>
        </View>
        <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="logo-usd" size={20} color={colors.warning} />
          <Text style={[styles.balanceAmount, { color: colors.foreground }]}>
            {balances?.usdt?.toFixed(2) ?? "0.00"}
          </Text>
          <Text style={[styles.balanceToken, { color: colors.mutedForeground }]}>USDT</Text>
        </View>
        <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="star-outline" size={20} color={colors.secondary} />
          <Text style={[styles.balanceAmount, { color: colors.foreground }]}>
            {balances?.credits ?? 0}
          </Text>
          <Text style={[styles.balanceToken, { color: colors.mutedForeground }]}>Credits</Text>
        </View>
      </View>

      {/* Add Wallet Button */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.accent, borderColor: colors.primary }]}
          onPress={() => createBuiltinMutation.mutate()}
          disabled={createBuiltinMutation.isPending}
          activeOpacity={0.8}
        >
          {createBuiltinMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={[styles.addBtnText, { color: colors.primary }]}>Create Built-in Wallet</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Wallets List */}
      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={wallets}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <WalletCard item={item} colors={colors} />}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!wallets.length}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              CONNECTED WALLETS
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="wallet-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Wallets</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Create a built-in wallet to get started
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
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 26, fontWeight: "700" },
  balanceCards: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  balanceCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    gap: 6,
  },
  balanceAmount: { fontSize: 18, fontWeight: "700" },
  balanceToken: { fontSize: 10, fontFamily: "SpaceMono_400Regular", letterSpacing: 1 },
  actions: { paddingHorizontal: 16, marginBottom: 12 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    height: 46,
    gap: 8,
  },
  addBtnText: { fontSize: 14, fontWeight: "600" },
  listContent: { paddingHorizontal: 16, paddingTop: 4 },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: "SpaceMono_400Regular",
    marginBottom: 10,
    marginTop: 4,
  },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  walletCard: {
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  walletHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  chainIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  chainIconText: { fontSize: 10, fontWeight: "700", fontFamily: "SpaceMono_400Regular" },
  walletInfo: { flex: 1 },
  walletLabel: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  walletAddr: { fontSize: 12, fontFamily: "SpaceMono_400Regular" },
  copyBtn: { padding: 8 },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  balanceLabel: { fontSize: 12 },
  balanceValue: { fontSize: 14, fontWeight: "600", fontFamily: "SpaceMono_400Regular" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptyText: { fontSize: 13, textAlign: "center" },
});
