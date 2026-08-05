# @minia2a/sdk

The marketplace companion for [@x402/express](https://www.npmjs.com/package/@x402/express) — discover, list, and trial 299 agent-to-agent services from the command line.

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

# Register your agent (500 free credits)
minia2a register
```

## Commands

| Command | Description |
|---------|-------------|
| `minia2a discover <query>` | Search 299 services by keyword |
| `minia2a list` | Show top 20 most-used services |
| `minia2a trial <id>` | Call a service's free trial endpoint |
| `minia2a register` | Get your 500 free credits ($2.50 value) |
| `minia2a publish` | List your x402 endpoint on the marketplace |

## For @x402/express Users

Already charging agents with `@x402/express`? List your endpoint:

```bash
minia2a publish
```

Your service gets:
- Listed in the 299-service catalog on [minia2a.uk](https://minia2a.uk)
- Free trial traffic from agent developers
- USDC revenue on Base — direct to your wallet
- 5% marketplace fee only on paid calls

## Programmatic API

```js
const { discover, getServices, trial, stats } = require('@minia2a/sdk');

const matches = await discover('captcha');
console.log(matches[0].name); // "CAPTCHA Solver"

const { body } = await trial('x402-gas');
console.log(body);

const { services, walletUsers } = await stats();
```

## Links

- [minia2a.uk](https://minia2a.uk) — Web UI + full catalog
- [@x402/express](https://www.npmjs.com/package/@x402/express) — x402 payment middleware
- [x402 Protocol](https://x402.org) — Agent payment standard

---

Powered by [minia2a.uk](https://minia2a.uk) — 299 services, USDC on Base
