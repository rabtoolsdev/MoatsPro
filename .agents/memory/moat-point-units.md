---
name: Moat point units
description: The non-obvious unit conversion required for pre-action pool-share estimates.
---

MoatV3 position points use token base units normalized by 1e12 before the action multiplier is applied. For an 18-decimal token, one human token contributes 1e6 point units.

**Why:** Mixing human-readable token amounts with the contract's normalized point counters made a 1,000,000-token burn appear as roughly 0.00000043% of the pool instead of roughly 0.43%.

**How to apply:** Convert the entered token amount to base units, divide by 1e12, apply the stake/lock/burn multiplier, and calculate the post-action share against the updated total points.