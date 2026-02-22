# Payline & Paytable Implementation Plan

## Overview
Add 20 paylines, paytable, and win evaluation to achieve ~96% RTP with medium volatility.

## Symbol Hierarchy
| Symbol | Tier | Freq per reel |
|--------|------|---------------|
| 1.png | Premium 1 (highest) | 3 |
| 2.png | Premium 2 | 2-3 |
| 3.png | Premium 3 | 2-3 |
| A.png | Low 1 | 2-3 |
| K.png | Low 2 | 2-3 |
| Q.png | Low 3 | 3 |
| J.png | Low 4 (lowest) | 2-3 |
| Wild | Substitutes all + triggers bonus (3+) | 1 |

## 20 Payline Patterns (row: 0=top, 1=mid, 2=bottom)
```
Line  1: [1,1,1,1,1]  middle straight
Line  2: [0,0,0,0,0]  top straight
Line  3: [2,2,2,2,2]  bottom straight
Line  4: [0,1,2,1,0]  V shape
Line  5: [2,1,0,1,2]  inverted V
Line  6: [0,0,1,0,0]  top dip
Line  7: [2,2,1,2,2]  bottom rise
Line  8: [1,2,2,2,1]  U shape
Line  9: [1,0,0,0,1]  inverted U
Line 10: [0,1,1,1,0]  flat dip
Line 11: [2,1,1,1,2]  flat rise
Line 12: [1,0,1,0,1]  zigzag up
Line 13: [1,2,1,2,1]  zigzag down
Line 14: [0,1,0,1,0]  small zigzag top
Line 15: [2,1,2,1,2]  small zigzag bottom
Line 16: [0,0,1,2,2]  descending
Line 17: [2,2,1,0,0]  ascending
Line 18: [1,0,0,1,2]  step down
Line 19: [1,2,2,1,0]  step up
Line 20: [0,1,2,2,1]  slide down
```

## Initial Paytable (multipliers of bet_per_line)
Pays for matching N consecutive symbols left-to-right:

| Symbol | x3 | x4 | x5 |
|--------|-----|------|------|
| 1.png | 30 | 100 | 500 |
| 2.png | 25 | 75 | 250 |
| 3.png | 20 | 50 | 150 |
| A.png | 10 | 25 | 100 |
| K.png | 8 | 20 | 75 |
| Q.png | 6 | 15 | 50 |
| J.png | 5 | 10 | 40 |

Wild Pay (pays on total bet, not per line, 3+ wilds anywhere):
| x3 | x4 | x5 |
|-----|-----|------|
| 2x | 5x | 20x |

*These are starting values — will be tuned by the RTP calculator.*

## Implementation Steps

### Step 1: Backend — Win evaluation logic
**File: `backend/src/services/spin-service.ts`**
- Add `PAYLINES` array (20 patterns)
- Add `PAYTABLE` map (symbol → [x3, x4, x5] multipliers)
- Add `evaluateWin(grid, betPerLine)` function:
  - For each payline: get 5 symbols, count consecutive matching (left-to-right, wild substitutes)
  - For wild pay: count total wilds in grid, lookup wild pay
  - Return `{ totalWin, lineWins: [{lineIndex, symbolId, count, payout}], wildPay }`
- Update `generateSpin()` to call `evaluateWin()` and return win details

### Step 2: Backend — RTP calculator script
**New file: `backend/src/scripts/rtp-calculator.ts`**
- Brute-force all 20^5 = 3,200,000 stop combinations
- For each: build grid, evaluate all paylines + wild pay
- Calculate RTP = totalPayouts / (totalCombinations × 20)
- Print RTP breakdown per symbol and wild pay
- Run with: `npx tsx backend/src/scripts/rtp-calculator.ts`
- Iterate paytable values until ~96% RTP

### Step 3: Update API response types
**Files: `frontend/src/shared/types.ts` + `shared/types.ts`**
- Add `LineWin` type: `{ lineIndex, symbol, count, payout }`
- Update `SpinResponse` to include `lineWins` and `wildPay`

### Step 4: Backend — Update spin route
**File: `backend/src/routes/spin.ts`**
- Pass `betPerLine` (betAmount / 20) to `generateSpin()`
- Return full win details in response

### Step 5: Frontend — Display win amount
**File: `frontend/src/Core/Game/Screens/BaseScreen/views/slot-machine-view.ts`**
- After reels stop, emit win signal with win data
- Show total win amount (no payline animation yet — that's a separate task)

### Step 6: Frontend — Win signal
**File: `frontend/src/Core/Signals/game-signals.ts`**
- Add `winDetected` signal with win details

## Out of scope (future tasks)
- Payline highlight animations
- Win celebration effects
- Info/paytable screen UI
- Free spins bonus on wild trigger
