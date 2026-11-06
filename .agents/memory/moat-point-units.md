---
name: Moat current-points weight
description: Pool-share percentages come from the moat contract's current points over total points.
---

The current reward-pool percentage is `getCurrentPoints(user) / totalPoints() * 100` from the moat contract. The `userInfo` staking/burn counters and the API leaderboard's `weight` are different metrics and can produce different percentages. For pre-action estimates, retain the calibrated points model unless a contract-backed estimate is available.

**Why:** For ARENA, the contract's `getCurrentPoints` ratio yields about 10.20%, while the API leaderboard's epoch weight is about 7.74% and the user-info counters yield 2.56%. The user specifically chose the contract current-points ratio as the pool-weight definition.

**How to apply:** Read the total and each wallet's current points on the moat's own chain, calculate the ratio using exact integer arithmetic, and sort stakers by current points descending. Keep the API leaderboard points for its separate display score.