#!/usr/bin/env node
/**
 * minia2a CLI — The marketplace companion for @x402/express
 *
 * Discover, list, and trial agent-to-agent x402 services.
 * 299 services, USDC on Base, zero API keys.
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
  console.log("Powered by minia2a.uk — 299 services, USDC on Base");
  console.log("─".repeat(50) + "\n");
}

function usage() {
  console.log(`
  minia2a <command> [args]

  Commands:
    discover <query>   Search the 299-service marketplace
    list               Show popular x402 services
    trial <service>    Get trial instructions for a service
    register           Register your agent (500 free credits)

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

async function trial(serviceId) {
  if (!serviceId || serviceId.trim() === "") {
    console.error("Usage: minia2a trial <service-id>");
    console.error("Example: minia2a trial x402-gas\n");
    process.exit(1);
  }

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
  const trialEndpoint = `${svc.endpoint}?trial=1`;

  console.log(`  Service:    ${svc.name}`);
  console.log(`  Price:      ${price}/call`);
  console.log(`  Endpoint:   ${svc.endpoint}`);
  console.log(`  Trial URL:  ${trialEndpoint}`);
  console.log(`  About:      ${svc.description?.slice(0, 120) || ""}...`);
  console.log();

  console.log("  curl example:");
  console.log(`    curl -s '${trialEndpoint}'`);
  console.log();

  // Actually call the trial endpoint
  console.log("  Trying now...\n");
  try {
    const start = Date.now();
    const res = await fetch(trialEndpoint);
    const elapsed = Date.now() - start;
    const body = await res.text();
    const preview = body.length > 300 ? body.slice(0, 300) + "..." : body;

    console.log(`  Status:  ${res.status} ${res.statusText} (${elapsed}ms)`);
    console.log(`  Response: ${preview}`);
    console.log();
  } catch (err) {
    console.log(`  ⚠  Could not reach trial endpoint: ${err.message}`);
    console.log(`  Try manually: curl -s '${trialEndpoint}'\n`);
  }

  footer();
}

async function register() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           Register Your Agent on minia2a.uk                 ║
╠══════════════════════════════════════════════════════════════╣
║                                                            ║
║  To register and get 500 free credits ($2.50 value):       ║
║                                                            ║
║    curl -X POST https://minia2a.uk/api/v1/register-simple  ║
║      -H "Content-Type: application/json"                   ║
║      -d '{"agentName":"your-agent-name"}'                  ║
║                                                            ║
║  Already registered? Check your stats:                     ║
║                                                            ║
║    curl -s https://minia2a.uk/api/stats                     ║
║                                                            ║
╚══════════════════════════════════════════════════════════════╝
`);
  footer();
}

async function publish() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║       List Your x402 Endpoint on minia2a.uk                 ║
╠══════════════════════════════════════════════════════════════╣
║                                                            ║
║  Already using @x402/express or @minia2a/x402-express?     ║
║  Register your endpoint in one command:                    ║
║                                                            ║
║    curl -X POST https://minia2a.uk/api/v1/register-simple  ║
║      -H "Content-Type: application/json"                   ║
║      -d '{                                                ║
║        "agentName":"my-service",                           ║
║        "endpoint":"https://my-api.com/x402/ai-summary",    ║
║        "description":"AI summary service — $0.01/call"     ║
║      }'                                                   ║
║                                                            ║
║  Your service gets:                                        ║
║  • Listed in the 299-service catalog                       ║
║  • Free trial traffic from agent developers                ║
║  • USDC revenue on Base — direct to your wallet            ║
║  • 5% marketplace fee only on paid calls                   ║
║                                                            ║
║  Docs: https://minia2a.uk/docs                             ║
║                                                            ║
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
      await trial(args[1] || "");
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
