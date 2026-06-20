import { Router } from "express";
import { getUserIdAsync } from "../lib/auth-utils";

const router = Router();

const SYSTEM_PROMPT = `You are AYZEN AI — an expert crypto airdrop assistant built into the AYZEN Airdrop Command Center platform.

You specialize in:
- Crypto airdrops: how to find them, qualify for them, and maximize ROI
- DeFi strategies: yield farming, liquidity provision, bridging
- Layer 2 networks: Arbitrum, Optimism, zkSync, Starknet, Base, Scroll
- Wallet management: multi-wallet strategies, gas optimization
- Task automation: how to efficiently complete airdrop tasks
- Risk management: avoiding sybil bans, managing wallet identities

AYZEN Platform context:
- Users create "entities" (vault entries with unique serials like AYZNA1) to manage multiple account identities
- Each entity has: wallet addresses, Twitter, Discord, Telegram, email credentials
- Users enroll their entities into projects to participate in airdrops
- Admin can create and manage projects/tasks

Keep responses concise, actionable, and crypto-native. Use $ticker symbols when relevant. Be direct and professional.`;

router.post("/ai/chat", async (req, res): Promise<void> => {
  const groqKey = process.env.GROQ_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (!groqKey && !openRouterKey) {
    res.status(503).json({ error: "AI not configured. Add GROQ_API_KEY or OPENROUTER_API_KEY." });
    return;
  }

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  const allMessages = [{ role: "system", content: SYSTEM_PROMPT }, ...messages.slice(-20)];

  if (groqKey) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama-3.1-8b-instant", messages: allMessages, max_tokens: 1024 }),
    });
    const data = await response.json();
    res.json(data);
    return;
  }

  // Fallback to OpenRouter
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openRouterKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://ayzen.tech" },
    body: JSON.stringify({ model: "meta-llama/llama-3.1-8b-instruct:free", messages: allMessages, max_tokens: 1024 }),
  });
  const data = await response.json();
  res.json(data);
});

export default router;
