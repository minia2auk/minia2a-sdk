#!/usr/bin/env node
/**
 * minia2a CLI — The marketplace companion for @x402/express
 *
 * Discover, list, and trial agent-to-agent x402 services.
 * USDC on Base, zero API keys.
 *
 * The catalog size is deliberately not stated here: it changes weekly and a
 * literal in a published tarball cannot be corrected once installed. `discover`
 * and `list` print live results; that is the only trustworthy count.
 */

const BASE_URL = "https://minia2a.uk";

async function fetchJSON(path) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${url}`);
    }
    return await res.json();
  } catch (err) {
    if (err.cause?.code === "ENOTFOUND" || err.cause?.code === "ECONNREFUSED") {
      console.error(`\n❌ Could not reach minia2a.uk — check your network.\n`);
    } else if (err.message?.includes("HTTP")) {
      console.error(`\n❌ API returned ${err.message}\n`);
    } else {
      console.error(`\n❌ ${err.message}\n`);
    }
    process.exit(1);
  }
}

function footer() {
  console.log("\n" + "─".repeat(50));
  console.log("Powered by minia2a.uk — pay-per-call x402 APIs, USDC on Base");
  console.log("─".repeat(50) + "\n");
}

function usage() {
  console.log(`
  minia2a <command> [args]

  Commands:
    discover <query>   Search the 1,680+-service marketplace
    list               Show popular x402 services
    trial <service>    Get trial instructions for a service
    register           Register a wallet for publishing (trials need none)

  Examples:
    minia2a discover "gas price"
    minia2a list
    minia2a trial x402-gas
    minia2a register

  For x402/express users:
    minia2a publish     Register your x402 endpoint on minia2a.uk
`);
  footer();
}

async function discover(query) {
  if (!query || query.trim() === "") {
    console.error("Usage: minia2a discover <query>");
    console.error("Example: minia2a discover \"gas price\"\n");
    process.exit(1);
  }

  console.log(`\n🔍 Searching for "${query}"...\n`);

  const data = await fetchJSON("/api/services");

  const services = data.services || [];
  const q = query.toLowerCase().split(/\s+/);

  // Score each service by keyword match in name + description
  const scored = services
    .filter(s => s.active)
    .map(s => {
      const text = `${s.name} ${s.description} ${s.id} ${s.category || ""}`.toLowerCase();
      let score = 0;
      for (const word of q) {
        if (text.includes(word)) score += 10;
        // Exact match in name = very relevant
        if (s.name.toLowerCase().includes(word)) score += 20;
        // In the service ID
        if (s.id.toLowerCase().includes(word)) score += 5;
      }
      return { ...s, _score: score };
    })
    .filter(s => s._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 15);

  if (scored.length === 0) {
    console.log(`No services matched "${query}". Try broader keywords.\n`);
    footer();
    return;
  }

  console.log(`Found ${scored.length} matching service(s):\n`);

  for (const s of scored) {
    const price = s.priceCents != null
      ? `$${(s.priceCents / 100).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}`
      : "?";
    const trials = s.trialCount != null ? `${s.trialCount} trials` : "";
    const emoji = s.priceCents === 0 ? "🆓" : s.priceCents <= 0.1 ? "💰" : "💎";
    console.log(`  ${emoji}  ${s.name}`);
    console.log(`      id:      ${s.id}`);
    console.log(`      price:   ${price}/call`);
    console.log(`      endpoint: ${s.endpoint}`);
    console.log(`      about:   ${s.description?.slice(0, 80) || ""}...`);
    console.log();
  }

  console.log(`\nTry one:  minia2a trial ${scored[0].id}`);
  footer();
}

async function list() {
  console.log("\n📡 Fetching services from minia2a.uk...\n");

  const data = await fetchJSON("/api/services");
  const services = (data.services || []).filter(s => s.active);

  // Sort by trial count (popularity) descending
  const popular = [...services]
    .sort((a, b) => (b.trialCount || 0) - (a.trialCount || 0))
    .slice(0, 20);

  console.log(`Top ${Math.min(20, popular.length)} of ${services.length} services:\n`);

  for (const s of popular) {
    const price = s.priceCents != null
      ? `$${(s.priceCents / 100).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}`
      : "?";
    const trials = s.trialCount || 0;
    const id = (s.id || "").padEnd(30);
    console.log(`  ${id}  ${price.padStart(8)}/call   ${String(trials).padStart(5)} trials`);
  }

  console.log(`\n  ...and ${services.length - 20} more. Search: minia2a discover <keyword>`);
  console.log("\nRegister your own:  minia2a publish");
  footer();
}

async function trial(serviceId, flags = []) {
  if (!serviceId || serviceId.trim() === "") {
    console.error("Usage: minia2a trial <service-id> [--wallet 0x.. --signature 0x.. --timestamp <unixSec>]");
    console.error("Example: minia2a trial x402-gas --wallet 0xYourWallet --signature 0xSig --timestamp 1758700000\n");
    console.error("A signed wallet draws from its 5 free trial calls. Without a signature this command");
    console.error("only shows the endpoint's 402 payment challenge — it cannot draw a trial.\n");
    process.exit(1);
  }

  const opt = (name) => {
    const i = flags.indexOf(`--${name}`);
    return i >= 0 ? flags[i + 1] : undefined;
  };
  const wallet = opt("wallet");
  const signature = opt("signature");
  const ts = String(opt("timestamp") || Math.floor(Date.now() / 1000));

  console.log(`\n🧪 ${serviceId} — trial mode\n`);

  // Fetch service details
  const data = await fetchJSON("/api/services");
  const svc = data.services?.find(s => s.id === serviceId);

  if (!svc) {
    console.log(`Service "${serviceId}" not found.`);
    console.log(`Run 'minia2a list' to see available services.\n`);
    footer();
    return;
  }

  const price = svc.priceCents != null
    ? `$${(svc.priceCents / 100).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}`
    : "?";
  const url = new URL(svc.endpoint);
  const headers = {};
  if (wallet) {
    url.searchParams.set("wallet", wallet);
    headers["X-Wallet-Signature"] = signature || "";
    headers["X-Trial-Timestamp"] = ts;
  }

  console.log(`  Service:    ${svc.name}`);
  console.log(`  Price:      ${price}/call`);
  console.log(`  Endpoint:   ${svc.endpoint}`);
  console.log(
    wallet
      ? `  Trial:      signed wallet ${wallet}`
      : "  Trial:      NOT SIGNED — this call returns the 402 challenge, not a trial"
  );
  console.log(`  About:      ${svc.description?.slice(0, 120) || ""}...`);
  console.log();

  if (!wallet) {
    console.log("  A trial needs a signed wallet (no registration). The message is:");
    console.log(`    minia2a trial:${wallet || "<wallet>"}:${serviceId}:${ts}      (EIP-191 personal_sign)`);
    console.log(`    minia2a trial ${serviceId} --wallet 0x.. --signature 0x.. --timestamp ${ts}`);
    console.log("  Note: serviceId is the catalog id (x402-gas), not the URL path segment (gas).");
    console.log();
  }

  console.log("  curl example:");
  console.log(`    curl -s '${url}'${wallet ? ` \\\n      -H 'X-Wallet-Signature: ${signature}' \\\n      -H 'X-Trial-Timestamp: ${ts}'` : ""}`);
  console.log();

  console.log("  Trying now...\n");
  try {
    const start = Date.now();
    const res = await fetch(url, { headers });
    const elapsed = Date.now() - start;
    const body = await res.text();
    const preview = body.length > 300 ? body.slice(0, 300) + "..." : body;
    const remaining = res.headers.get("x-trial-remaining");

    console.log(`  Status:  ${res.status} ${res.statusText} (${elapsed}ms)`);
    if (remaining != null) {
      console.log(`  Trial calls remaining: ${remaining} of ${res.headers.get("x-trial-max") || 5}`);
    }
    console.log(`  Response: ${preview}`);
    console.log();
  } catch (err) {
    console.log(`  ⚠  Could not reach the endpoint: ${err.message}`);
    console.log(`  Try manually: curl -s '${url}'\n`);
  }

  footer();
}

async function register() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           Register Your Agent on minia2a.uk                  ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Free trial calls need no registration. Sign a wallet:       ║
║                                                              ║
║    TS=$(date +%s)                                            ║
║    sign EIP-191 "minia2a trial:<wallet>:<svc-id>:$TS"        ║
║    curl "https://minia2a.uk/x402/<svc>?wallet=0x..."         ║
║      header X-Wallet-Signature: 0x...                        ║
║      header X-Trial-Timestamp: $TS                           ║
║                                                              ║
║  Registering is for publishing services, not for trials:     ║
║                                                              ║
║  Already registered? Check your stats:                       ║
║                                                              ║
║    curl -s https://minia2a.uk/api/stats                      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
  footer();
}

async function publish() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║       List Your x402 Endpoint on minia2a.uk                  ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Serving your own x402 endpoint? Registering lists your      ║
║  wallet for publishing — it is NOT the trial gate. The 5     ║
║  free calls come from signing on the call itself.            ║
║                                                              ║
║  Sign the string  minia2a register: <your-wallet>  with      ║
║  EIP-191 personal_sign, then:                                ║
║                                                              ║
║    curl -X POST https://minia2a.uk/api/v1/register-simple    ║
║      -H "Content-Type: application/json"                     ║
║      -d '{                                                   ║
║        "name":"my-service",                                  ║
║        "wallet":"0x...",                                     ║
║        "signature":"0x..."                                   ║
║      }'                                                      ║
║                                                              ║
║  Your service gets:                                          ║
║  • Listed in the 1,680+-service catalog                      ║
║  • Free trial traffic from agent developers                  ║
║  • USDC revenue on Base — direct to your wallet              ║
║  • 5% platform fee — 0% through 2026                         ║
║                                                              ║
║  Docs: https://minia2a.uk/docs                               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
  footer();
}

// --- Main ---
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0]?.toLowerCase();
  const arg = args.slice(1).join(" ");

  switch (cmd) {
    case "discover":
    case "search":
      await discover(arg);
      break;
    case "list":
    case "ls":
      await list();
      break;
    case "trial":
    case "try":
      await trial(args[1] || "", args.slice(2));
      break;
    case "register":
    case "signup":
      await register();
      break;
    case "publish":
    case "add":
      await publish();
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      usage();
      break;
    default:
      console.error(`\nUnknown command: ${cmd}\n`);
      usage();
      process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(`\n❌ Unexpected error: ${err.message}\n`);
  process.exit(1);
});
