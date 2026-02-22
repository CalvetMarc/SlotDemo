#!/usr/bin/env python3
"""Sweep strip lengths to find target ~25% hit rate while maintaining 96.12% RTP.

For each strip length, distributes symbols proportionally to current ratios,
then computes exact hit rate and analytical RTP components.
"""

from math import comb

PAYLINES = [
    [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
    [0,0,1,0,0],[2,2,1,2,2],[1,2,2,2,1],[1,0,0,0,1],[0,1,1,1,0],
    [2,1,1,1,2],[1,0,1,0,1],[1,2,1,2,1],[0,1,0,1,0],[2,1,2,1,2],
    [0,0,1,2,2],[2,2,1,0,0],[1,0,0,1,2],[1,2,2,1,0],[0,1,2,2,1],
]
N_REELS = 5
N_ROWS = 3
N_LINES = 20
W = 7

SYM = {0:"King", 1:"Queen", 2:"Wolf", 3:"J", 4:"K", 5:"Q", 6:"A", 7:"Wild"}

# Current paytable (x totalBet)
PAY = {
    7: (0.50, 1.70, 12.50),
    0: (0.45, 1.65, 8.40),
    1: (0.40, 1.25, 4.25),
    2: (0.35, 0.85, 2.55),
    6: (0.20, 0.45, 1.70),
    4: (0.15, 0.35, 1.25),
    5: (0.10, 0.25, 0.85),
    3: (0.10, 0.20, 0.70),
}

WILD_PAYS_BASE = {3: 2, 4: 5, 5: 20}
BONUS_EVS_BASE = {0: 18, 1: 35, 2: 80}

# Current (S20) reference values
REF_LINE_RTP = 0.379888
REF_WB_RTP = 0.581344
TARGET_RTP = 0.961232

# Current frequency ratios (representative reel): King:3, Queen:3, Wolf:3, J:3, K:2, Q:3, A:2
# We keep these ratios and scale to different strip lengths
BASE_RATIOS = {0: 3, 1: 3, 2: 3, 3: 3, 4: 2, 5: 3, 6: 2}  # non-wild = 19


def distribute_symbols(strip_len):
    """Distribute symbols proportionally, always 1 wild."""
    non_wild = strip_len - 1
    base_total = sum(BASE_RATIOS.values())  # 19
    freqs = {}
    assigned = 0
    syms = sorted(BASE_RATIOS.keys())
    for sym in syms[:-1]:
        count = round(BASE_RATIOS[sym] * non_wild / base_total)
        count = max(count, 1)
        freqs[sym] = count
        assigned += count
    # Last non-wild symbol gets the remainder
    freqs[syms[-1]] = non_wild - assigned
    freqs[W] = 1
    return freqs


def build_strip(freqs, strip_len, seed=42):
    import random
    rng = random.Random(seed)
    strip = []
    for sym in sorted(freqs.keys()):
        strip.extend([sym] * freqs[sym])
    assert len(strip) == strip_len, f"{len(strip)} != {strip_len}"
    rng.shuffle(strip)
    return strip


def compute_hit_rate(strips, strip_len):
    reel_cols = []
    for r in range(N_REELS):
        cols = []
        for s in range(strip_len):
            cols.append(tuple(strips[r][(s + row) % strip_len] for row in range(N_ROWS)))
        reel_cols.append(cols)

    wild_visible = []
    for r in range(N_REELS):
        wv = [0] * strip_len
        for s in range(strip_len):
            for row in range(N_ROWS):
                if strips[r][(s + row) % strip_len] == W:
                    wv[s] = 1
                    break
        wild_visible.append(wv)

    any_line_win = [[[False]*strip_len for _ in range(strip_len)] for _ in range(strip_len)]
    for s0 in range(strip_len):
        c0 = reel_cols[0][s0]
        for s1 in range(strip_len):
            c1 = reel_cols[1][s1]
            for s2 in range(strip_len):
                c2 = reel_cols[2][s2]
                for pl in PAYLINES:
                    a, bv, cv = c0[pl[0]], c1[pl[1]], c2[pl[2]]
                    if a != W:
                        base = a
                    elif bv != W:
                        base = bv
                    elif cv != W:
                        base = cv
                    else:
                        any_line_win[s0][s1][s2] = True
                        break
                    if (a == base or a == W) and (bv == base or bv == W) and (cv == base or cv == W):
                        any_line_win[s0][s1][s2] = True
                        break

    n_w3 = sum(wild_visible[3])
    n_w4 = sum(wild_visible[4])
    sl2 = strip_len ** 2
    wild_34_any = sl2 - (strip_len - n_w3) * (strip_len - n_w4)
    wild_34_both = n_w3 * n_w4

    winning = 0
    for s0 in range(strip_len):
        wv0 = wild_visible[0][s0]
        for s1 in range(strip_len):
            wv01 = wv0 + wild_visible[1][s1]
            for s2 in range(strip_len):
                wv012 = wv01 + wild_visible[2][s2]
                if any_line_win[s0][s1][s2] or wv012 >= 3:
                    winning += sl2
                elif wv012 == 2:
                    winning += wild_34_any
                elif wv012 == 1:
                    winning += wild_34_both

    return winning / (strip_len ** N_REELS)


def compute_line_rtp(freqs, strip_len, paytable):
    w_f = freqs.get(W, 0)
    total = 0.0
    for sym in range(8):
        pays = paytable.get(sym)
        if not pays:
            continue
        is_wild = sym == W
        p = (w_f / strip_len) if is_wild else ((freqs.get(sym, 0) + w_f) / strip_len)
        w_p = w_f / strip_len
        for count in [3, 4, 5]:
            if is_wild and count < 5:
                continue
            if is_wild:
                prob = w_p ** 5
            else:
                pp = p ** count
                wp = w_p ** count
                prob = (pp - wp) * (1 - p) if count < 5 else pp - wp
            total += prob * pays[count - 3] * N_LINES
    return total


def compute_wb_rtp(strip_len, wild_pays, bonus_evs):
    p_wv = min(N_ROWS / strip_len, 1.0)  # 1 wild per strip
    wp_rtp = 0.0
    bn_rtp = 0.0
    for k in [3, 4, 5]:
        pk = comb(5, k) * p_wv**k * (1 - p_wv)**(5 - k)
        wp_rtp += pk * wild_pays.get(k, 0)
        bn_rtp += pk * bonus_evs.get(k - 3, 0)
    return wp_rtp, bn_rtp, p_wv


# ══════════════════════════════════════════════════════════
# SWEEP: strip lengths 20 to 50
# ══════════════════════════════════════════════════════════

print("SWEEP: proportional symbol distribution, 1 wild per reel")
print(f"{'SLen':>4} {'Freqs':<30} {'HitRate':>8} {'LineRTP':>9} {'WP+Bn':>9} {'P(wv)':>6}")
print("=" * 75)

results = []
for sl in range(20, 51, 2):
    freqs = distribute_symbols(sl)
    freq_str = " ".join(f"{SYM[s][0]}:{freqs[s]}" for s in sorted(freqs.keys()))
    strips = [build_strip(freqs, sl, seed=100 + i * 17) for i in range(5)]
    hr = compute_hit_rate(strips, sl)
    lr = compute_line_rtp(freqs, sl, PAY)
    wp, bn, pwv = compute_wb_rtp(sl, WILD_PAYS_BASE, BONUS_EVS_BASE)
    wb = wp + bn
    results.append((sl, freqs, hr, lr, wb, pwv))
    print(f"{sl:>4} {freq_str:<30} {hr*100:>7.2f}% {lr*100:>8.4f}% {wb*100:>8.4f}% {pwv:>5.3f}")

# ══════════════════════════════════════════════════════════
# STRATEGY A: scale only paytable (let bonus share drop)
# ══════════════════════════════════════════════════════════

print("\n\nSTRATEGY A: only scale paytable, keep wild pay & bonus EVs unchanged")
print(f"{'SLen':>4} {'HitRate':>8} {'LineRTP':>9} {'WP+Bn':>9} {'Total':>9} {'PayScale':>9} {'KingX5':>8} {'Split':>12}")
print("=" * 80)

for sl, freqs, hr, lr, wb, pwv in results:
    target_lr = TARGET_RTP - wb
    pay_scale = target_lr / lr if lr > 0 else 0
    total = target_lr + wb
    king_x5 = PAY[0][2] * pay_scale
    line_pct = target_lr / TARGET_RTP * 100
    bn_pct = wb / TARGET_RTP * 100
    print(f"{sl:>4} {hr*100:>7.2f}% {target_lr*100:>8.4f}% {wb*100:>8.4f}% {total*100:>8.4f}% {pay_scale:>8.3f}x {king_x5:>7.1f}x {line_pct:.0f}/{bn_pct:.0f}")

# ══════════════════════════════════════════════════════════
# STRATEGY B: scale BOTH paytable AND wild pay/bonus EVs
#   to maintain similar RTP distribution (~40/60 split)
# ══════════════════════════════════════════════════════════

print("\n\nSTRATEGY B: scale paytable + wild pay + bonus EVs to maintain ~40/60 split")
print(f"{'SLen':>4} {'HitRate':>8} {'LineRTP':>9} {'WP+Bn':>9} {'WBscale':>8} {'PayScale':>9} {'KingX5':>8} {'WP3':>6} {'BnEV0':>7}")
print("=" * 90)

for sl, freqs, hr, lr, wb, pwv in results:
    # Target: line RTP = 38%, WB = 58.13% (same as current)
    # Scale WB by factor to reach 58.13%
    wb_scale = REF_WB_RTP / wb if wb > 0 else 0
    new_wb = REF_WB_RTP
    # Scale line paytable to reach 37.99%
    pay_scale = REF_LINE_RTP / lr if lr > 0 else 0
    total = REF_LINE_RTP + new_wb
    king_x5 = PAY[0][2] * pay_scale
    wp3 = WILD_PAYS_BASE[3] * wb_scale
    bn_ev0 = BONUS_EVS_BASE[0] * wb_scale
    print(f"{sl:>4} {hr*100:>7.2f}% {REF_LINE_RTP*100:>8.4f}% {new_wb*100:>8.4f}% {wb_scale:>7.2f}x {pay_scale:>8.3f}x {king_x5:>7.1f}x {wp3:>5.1f}x {bn_ev0:>6.1f}x")


# ══════════════════════════════════════════════════════════
# DETAIL for interesting hit rate range (22-30%)
# ══════════════════════════════════════════════════════════

print("\n\n" + "=" * 70)
print("DETAILED: configs in 22-30% hit rate range (Strategy B)")
print("=" * 70)

for sl, freqs, hr, lr, wb, pwv in results:
    if not (22 <= hr * 100 <= 30):
        continue

    wb_scale = REF_WB_RTP / wb if wb > 0 else 0
    pay_scale = REF_LINE_RTP / lr if lr > 0 else 0

    print(f"\n--- Strip Length {sl} | Hit Rate = {hr*100:.2f}% ---")
    print(f"  Symbol frequencies: {', '.join(f'{SYM[s]}:{freqs[s]}' for s in sorted(freqs.keys()))}")
    print(f"  P(wild visible/reel) = {pwv:.4f}")
    print()
    print(f"  Wild Pay (scale {wb_scale:.2f}x):")
    for k in [3, 4, 5]:
        print(f"    {k} wilds: {WILD_PAYS_BASE[k] * wb_scale:.1f}x totalBet")
    print()
    print(f"  Bonus EVs (scale {wb_scale:.2f}x):")
    for tier in [0, 1, 2]:
        print(f"    Tier {tier}: {BONUS_EVS_BASE[tier] * wb_scale:.1f}x totalBet")
    print()
    print(f"  Paytable (scale {pay_scale:.3f}x):")
    print(f"  {'Symbol':<10} {'x3':>8} {'x4':>8} {'x5':>8}")
    for sym_id in [7, 0, 1, 2, 6, 4, 5, 3]:
        pays = PAY[sym_id]
        print(f"  {SYM[sym_id]:<10} {pays[0]*pay_scale:>8.2f} {pays[1]*pay_scale:>8.2f} {pays[2]*pay_scale:>8.2f}")
