---
name: Moat pool-weight math
description: Use the Moats API epoch leaderboard as the authority for current reward-pool shares.
---

The Moats API v2 leaderboard `weight` is the authoritative current reward-pool percentage and sums to 100% across a moat. Do not calculate that displayed percentage from the contract's raw `userInfo / totalPoints` counters; they are a different metric and can diverge from the epoch weight shown on moats.app. For pre-action estimates, calibrate against leaderboard points and use the API weight as the current-share baseline when available.

**Why:** For HEFE, the API reported a 21.7111% share for the wallet with 27,907 points, while the contract-counter ratio displayed 20.58%; API weights across the full leaderboard summed to 100%.

**How to apply:** Prefer each wallet's API leaderboard `weight` for its current pool share. Estimate post-action changes from the leaderboard-calibrated points model, using that weight to derive the current total contribution when possible.