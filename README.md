# @minia2a/sdk

The marketplace companion for [@x402/express](https://www.npmjs.com/package/@x402/express) — discover, list, and trial 1,680+ agent-to-agent services from the command line.

```bash
npm install -g @minia2a/sdk
```

## Quickstart

```bash
# Discover services your agent can call
minia2a discover "gas price"

# See what's popular
minia2a list

# Try a service for free
minia2a trial x402-gas

# Register a wallet for publishing services
minia2a register
```

## Commands

| Command | Description |
|---------|-------------|
| `minia2a discover <query>` | Search 1,680+ services by keyword |
| `minia2a list` | Show top 20 most-used services |
| `minia2a trial <id>` | Call a service's free trial endpoint |
| `minia2a register` | Register a wallet for publishing (trials need no registration) |
| `minia2a publish` | List your x402 endpoint on the marketplace |

## For @x402/express Users

Already charging agents with `@x402/express`? List your endpoint:

```bash
minia2a publish
```

Your service gets:
- Listed in the 1,680+-service catalog on [minia2a.uk](https://minia2a.uk)
- Free trial traffic from agent developers
- USDC revenue on Base — direct to your wallet
- 5% platform fee — 0% through 2026

## Programmatic API

```js
const { discover, getServices, trial, stats } = require('@minia2a/sdk');

const matches = await discover('captcha');
console.log(matches[0].name); // "Captcha Solve"

// Without a signed wallet this is an unpaid call: it returns the endpoint's
// 402 payment challenge (ok === false). It does not draw a free trial.
const { status, body } = await trial('x402-gas');
console.log(status); // 402

// Draw one of the wallet's 5 free trials by signing
//   "minia2a trial:<wallet>:<serviceId>:<unixSeconds>"   (EIP-191)
const ts = Math.floor(Date.now() / 1000);
const { ok, trialRemaining } = await trial('x402-gas', {
  wallet,
  signature: sign(`minia2a trial:${wallet}:x402-gas:${ts}`),
  timestamp: ts,
});
console.log(ok, trialRemaining); // true '4'

const marketplace = await stats();
console.log(marketplace.services, marketplace.trials.walletUsers);
```

## Links

- [minia2a.uk](https://minia2a.uk) — Web UI + full catalog
- [@x402/express](https://www.npmjs.com/package/@x402/express) — x402 payment middleware
- [x402 Protocol](https://x402.org) — Agent payment standard

---

Powered by [minia2a.uk](https://minia2a.uk) — 1,680+ services, USDC on Base
