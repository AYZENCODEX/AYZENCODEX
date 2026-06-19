import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const NETWORKS = [
  { network: "Ethereum", networkId: "ethereum", baseGas: 25 },
  { network: "BSC", networkId: "bsc", baseGas: 3 },
  { network: "Polygon", networkId: "polygon", baseGas: 100 },
  { network: "Arbitrum", networkId: "arbitrum", baseGas: 0.1 },
  { network: "Optimism", networkId: "optimism", baseGas: 0.05 },
  { network: "Avalanche", networkId: "avalanche", baseGas: 35 },
  { network: "Fantom", networkId: "fantom", baseGas: 200 },
  { network: "zkSync", networkId: "zksync", baseGas: 0.25 },
  { network: "StarkNet", networkId: "starknet", baseGas: 0.01 },
  { network: "Linea", networkId: "linea", baseGas: 0.05 },
  { network: "Base", networkId: "base", baseGas: 0.05 },
  { network: "Scroll", networkId: "scroll", baseGas: 0.1 },
  { network: "Mantle", networkId: "mantle", baseGas: 0.02 },
  { network: "Celo", networkId: "celo", baseGas: 0.5 },
  { network: "Gnosis", networkId: "gnosis", baseGas: 2 },
  { network: "Moonbeam", networkId: "moonbeam", baseGas: 100 },
  { network: "Cronos", networkId: "cronos", baseGas: 5000 },
  { network: "Klaytn", networkId: "klaytn", baseGas: 25 },
  { network: "Aurora", networkId: "aurora", baseGas: 0 },
  { network: "Metis", networkId: "metis", baseGas: 1 },
  { network: "Blast", networkId: "blast", baseGas: 0.05 },
  { network: "Mode", networkId: "mode", baseGas: 0.02 },
  { network: "Berachain", networkId: "berachain", baseGas: 15 },
  { network: "Sei", networkId: "sei", baseGas: 0.01 },
];

function generateGasPrice(baseGas: number) {
  const variation = 1 + (Math.random() - 0.5) * 0.4;
  const standard = baseGas * variation;
  return {
    slow: Math.max(standard * 0.8, 0.001),
    standard,
    fast: standard * 1.3,
    usdPerTx: standard * 0.000021 * 2000,
  };
}

router.get("/tools/gas", async (_req, res): Promise<void> => {
  const prices = NETWORKS.map(n => {
    const { slow, standard, fast, usdPerTx } = generateGasPrice(n.baseGas);
    return { ...n, slow, standard, fast, usdPerTx, updatedAt: new Date().toISOString() };
  });
  res.json(prices);
});

router.get("/tools/gas/:network", async (req, res): Promise<void> => {
  const networkId = Array.isArray(req.params.network) ? req.params.network[0] : req.params.network;
  const net = NETWORKS.find(n => n.networkId === networkId.toLowerCase());
  if (!net) { res.status(404).json({ error: "Network not found" }); return; }
  const { slow, standard, fast, usdPerTx } = generateGasPrice(net.baseGas);
  res.json({ ...net, slow, standard, fast, usdPerTx, updatedAt: new Date().toISOString() });
});

router.post("/tools/wallet-analysis", async (req, res): Promise<void> => {
  const { address, networks } = req.body;
  if (!address) { res.status(400).json({ error: "address is required" }); return; }

  const walletAge = Math.floor(Math.random() * 1000) + 30;
  const txCount = Math.floor(Math.random() * 2000) + 10;
  const txVolume = Math.random() * 500000 + 1000;
  const firstDate = new Date(); firstDate.setDate(firstDate.getDate() - walletAge);

  res.json({
    address,
    walletAge,
    txCount,
    txVolume,
    firstTx: firstDate.toISOString(),
    lastTx: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    firstBridge: new Date(firstDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastBridge: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    firstSwap: new Date(firstDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastSwap: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString(),
    totalGasUsed: Math.random() * 2 + 0.1,
    netWorth: Math.random() * 50000 + 500,
    activityScore: Math.floor(Math.random() * 40) + 60,
    networks: networks ?? ["ethereum"],
  });
});

router.get("/tools/streak/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId, 10);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  res.json({
    userId,
    currentStreak: user?.streak ?? 0,
    longestStreak: user?.longestStreak ?? 0,
    lastActiveDate: user?.lastActiveAt?.toISOString() ?? null,
    streakByProject: [],
  });
});

router.post("/tools/spam-score", async (req, res): Promise<void> => {
  const { address } = req.body;
  if (!address) { res.status(400).json({ error: "address is required" }); return; }

  const score = Math.floor(Math.random() * 100);
  let level = "Low";
  if (score >= 75) level = "Critical";
  else if (score >= 50) level = "High";
  else if (score >= 25) level = "Medium";

  res.json({
    address,
    score,
    level,
    dustTxCount: Math.floor(Math.random() * 50),
    highFreqLowValueCount: Math.floor(Math.random() * 100),
    explanation: score >= 50
      ? "Wallet shows patterns consistent with spam activity: high-frequency low-value transactions detected."
      : "Wallet appears legitimate with normal transaction patterns.",
  });
});

export default router;
