#!/usr/bin/env python3
"""
Compare approaches to reduce hit rate to ~25%:

A) BLANKS: keep original symbol counts but add non-paying "Blank" symbols
   to lengthen the strip (dilutes ALL symbol probabilities genuinely)
B) 10 PAYLINES: reduce paylines from 20 to 10, double paytable
C) HYBRID: slightly longer strips + fewer paylines
"""

from math import comb

N_REELS = 5
N_ROWS = 3
W = 7
BLANK = 8  # new non-paying symbol

PAYLINES_20 = [
    [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
    [0,0,1,0,0],[2,2,1,2,2],[1,2,2,2,1],[1,0,0,0,1],[0,1,1,1,0],
    [2,1,1,1,2],[1,0,1,0,1],[1,2,1,2,1],[0,1,0,1,0],[2,1,2,1,2],
    [0,0,1,2,2],[2,2,1,0,0],[1,0,0,1,2],[1,2,2,1,0],[0,1,2,2,1],
]
PAYLINES_10 = PAYLINES_20[:10]

SYM = {0:"King",1:"Queen",2:"Wolf",3:"J",4:"K",5:"Q",6:"A",7:"Wild",8:"Blank"}

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

WILD_PAYS = {3: 2, 4: 5, 5: 20}
BONUS_EVS = {0: 18, 1: 35, 2: 80}

# Original symbol counts per reel (strip length 20)
ORIG_COUNTS = {0:3, 1:3, 2:3, 3:3, 4:2, 5:3, 6:2, 7:1}

TARGET_RTP = 0.961232
REF_LINE_RTP = 0.379888
REF_WB_RTP = 0.581344


def build_strip(freqs, strip_len, seed=42):
    import random
    rng = random.Random(seed)
    strip = []
    for sym in sorted(freqs.keys()):
        strip.extend([sym] * freqs[sym])
    assert len(strip) == strip_len, f"{len(strip)} != {strip_len}"
    rng.shuffle(strip)
    return strip


def compute_hit_rate(strips, strip_len, paylines):
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
                for pl in paylines:
                    a, bv, cv = c0[pl[0]], c1[pl[1]], c2[pl[2]]
                    # Blank breaks chain — treat as unique non-matching
                    if a == BLANK or bv == BLANK or cv == BLANK:
                        continue
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


def compute_line_rtp(freqs, strip_len, paytable, n_lines):
    """Analytical line RTP. Blank doesn't participate in wins."""
    w_f = freqs.get(W, 0)
    total = 0.0
    for sym in range(8):  # 0-7, excluding Blank
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
            total += prob * pays[count - 3] * n_lines
    return total


def compute_wb_rtp(strip_len, wild_pays, bonus_evs):
    p_wv = min(N_ROWS / strip_len, 1.0)
    wp_rtp = bn_rtp = 0.0
    for k in [3, 4, 5]:
        pk = comb(5, k) * p_wv**k * (1 - p_wv)**(5 - k)
        wp_rtp += pk * wild_pays.get(k, 0)
        bn_rtp += pk * bonus_evs.get(k - 3, 0)
    return wp_rtp, bn_rtp, p_wv


# ══════════════════════════════════════════════════════════
# APPROACH A: BLANKS — strip 20+N blanks, original symbol counts
# ══════════════════════════════════════════════════════════

print("=" * 85)
print("APPROACH A: add Blank symbols to lengthen strip (original symbol counts preserved)")
print("=" * 85)
print(f"{'Blanks':>6} {'SLen':>4} {'HitRate':>8} {'LineRTP':>9} {'WP+Bn':>9} {'P(wv)':>6} {'PayScale':>9} {'WBscale':>8}")
print("-" * 75)

results_a = []
for n_blanks in range(0, 21, 2):
    sl = 20 + n_blanks
    freqs = dict(ORIG_COUNTS)
    freqs[BLANK] = n_blanks
    strips = [build_strip(freqs, sl, seed=100 + i * 17) for i in range(5)]
    hr = compute_hit_rate(strips, sl, PAYLINES_20)
    lr = compute_line_rtp(freqs, sl, PAY, 20)
    wp, bn, pwv = compute_wb_rtp(sl, WILD_PAYS, BONUS_EVS)
    wb = wp + bn

    # Scale paytable to maintain same line RTP
    pay_scale = REF_LINE_RTP / lr if lr > 0 else 0
    # Scale wild pay + bonus to maintain same WB RTP
    wb_scale = REF_WB_RTP / wb if wb > 0 else 0

    results_a.append((n_blanks, sl, hr, lr, wb, pwv, pay_scale, wb_scale))
    print(f"{n_blanks:>6} {sl:>4} {hr*100:>7.2f}% {lr*100:>8.4f}% {wb*100:>8.4f}% {pwv:>5.3f} {pay_scale:>8.3f}x {wb_scale:>7.2f}x")


# ══════════════════════════════════════════════════════════
# APPROACH B: reduce paylines from 20 to 10 (same strips)
# ══════════════════════════════════════════════════════════

print("\n" + "=" * 85)
print("APPROACH B: reduce paylines to 10 (same strip length 20)")
print("=" * 85)

freqs_20 = dict(ORIG_COUNTS)
strips_20 = [build_strip(freqs_20, 20, seed=100 + i * 17) for i in range(5)]

for n_lines, pls in [(20, PAYLINES_20), (10, PAYLINES_10)]:
    hr = compute_hit_rate(strips_20, 20, pls)
    lr = compute_line_rtp(freqs_20, 20, PAY, n_lines)
    wp, bn, pwv = compute_wb_rtp(20, WILD_PAYS, BONUS_EVS)
    wb = wp + bn
    pay_scale = REF_LINE_RTP / lr if lr > 0 else 0
    print(f"  {n_lines} paylines: hit_rate={hr*100:.2f}%, line_rtp={lr*100:.4f}%, wp+bn={wb*100:.4f}%, pay_scale={pay_scale:.3f}x")


# ══════════════════════════════════════════════════════════
# APPROACH C: HYBRID — slight blanks + fewer paylines
# ══════════════════════════════════════════════════════════

print("\n" + "=" * 85)
print("APPROACH C: hybrid — blanks + reduced paylines")
print("=" * 85)
print(f"{'Blanks':>6} {'Lines':>5} {'SLen':>4} {'HitRate':>8} {'LineRTP':>9} {'WP+Bn':>9} {'PayScale':>9} {'WBscale':>8}")
print("-" * 70)

for n_blanks in [0, 2, 4, 6, 8, 10]:
    sl = 20 + n_blanks
    freqs = dict(ORIG_COUNTS)
    if n_blanks > 0:
        freqs[BLANK] = n_blanks
    for n_lines, pls in [(20, PAYLINES_20), (15, PAYLINES_20[:15]), (10, PAYLINES_10)]:
        strips = [build_strip(freqs, sl, seed=100 + i * 17) for i in range(5)]
        hr = compute_hit_rate(strips, sl, pls)
        lr = compute_line_rtp(freqs, sl, PAY, n_lines)
        wp, bn, pwv = compute_wb_rtp(sl, WILD_PAYS, BONUS_EVS)
        wb = wp + bn
        pay_scale = REF_LINE_RTP / lr if lr > 0 else 0
        wb_scale = REF_WB_RTP / wb if wb > 0 else 0
        if 22 <= hr * 100 <= 32:
            marker = " ◀◀◀"
        else:
            marker = ""
        print(f"{n_blanks:>6} {n_lines:>5} {sl:>4} {hr*100:>7.2f}% {lr*100:>8.4f}% {wb*100:>8.4f}% {pay_scale:>8.3f}x {wb_scale:>7.2f}x{marker}")


# ══════════════════════════════════════════════════════════
# BEST CANDIDATE DETAIL
# ══════════════════════════════════════════════════════════

print("\n\n" + "=" * 70)
print("DETAILED: best candidates (hit rate 22-30%)")
print("=" * 70)

# Re-check approach A for detail
for n_blanks, sl, hr, lr, wb, pwv, pay_scale, wb_scale in results_a:
    if not (22 <= hr * 100 <= 30):
        continue

    print(f"\n--- {n_blanks} blanks, strip {sl}, 20 paylines ---")
    print(f"  Hit rate: {hr*100:.2f}%")
    print(f"  P(wild visible) = {pwv:.4f}")
    print(f"  Pay scale = {pay_scale:.3f}x  |  WB scale = {wb_scale:.2f}x")
    print()
    print(f"  Scaled Wild Pay: 3→{2*wb_scale:.1f}x  4→{5*wb_scale:.1f}x  5→{20*wb_scale:.1f}x")
    print(f"  Scaled Bonus EVs: T0→{18*wb_scale:.1f}x  T1→{35*wb_scale:.1f}x  T2→{80*wb_scale:.1f}x")
    print()
    print(f"  Paytable (x totalBet):")
    print(f"  {'Symbol':<10} {'x3':>8} {'x4':>8} {'x5':>8}")
    for sym_id in [7, 0, 1, 2, 6, 4, 5, 3]:
        pays = PAY[sym_id]
        print(f"  {SYM[sym_id]:<10} {pays[0]*pay_scale:>8.2f} {pays[1]*pay_scale:>8.2f} {pays[2]*pay_scale:>8.2f}")

    new_lr = lr * pay_scale
    new_wp = wb * wb_scale  # but split between wp and bn
    wp_only, bn_only, _ = compute_wb_rtp(sl,
        {k: v*wb_scale for k,v in WILD_PAYS.items()},
        {k: v*wb_scale for k,v in BONUS_EVS.items()})
    total = new_lr + wp_only + bn_only
    print(f"\n  RTP: lines={new_lr*100:.4f}% + wp={wp_only*100:.4f}% + bonus={bn_only*100:.4f}% = {total*100:.4f}%")
    print(f"  Split: lines={new_lr/total*100:.0f}%, wp+bonus={(wp_only+bn_only)/total*100:.0f}%")
