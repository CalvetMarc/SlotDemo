"""Quick verification: compute the same values the Excel formulas would produce."""

STRIPS = [
    [0,3,1,4,2,5,0,6,3,1,5,2,4,6,0,3,1,7,5,2],
    [1,4,0,5,3,6,2,0,4,1,3,5,6,2,0,4,5,1,3,7],
    [2,5,3,0,6,1,4,2,5,3,0,6,1,4,7,2,5,3,0,6],
    [3,0,4,1,5,2,6,3,0,4,1,5,2,6,3,0,5,4,1,7],
    [4,1,5,2,0,3,6,4,1,5,2,0,3,6,4,7,1,5,2,0],
]

SYMS = ["King","Queen","Wolf","J","K","Q","A","Wild"]
OLD_PAY = {0:(9,33,168),1:(8,25,85),2:(7,17,51),3:(2,4,14),4:(3,7,25),5:(2,5,17),6:(4,9,34),7:(10,34,250)}
WILD_PAYS = {3:2, 4:5, 5:20}
BONUS_POOLS = {0:54, 1:70, 2:80}
BONUS_SKULLS = {0:2, 1:1, 2:0}
STRIP_LEN = 20
REELS = 5
ROWS = 3
LINES = 20
COMBOS = STRIP_LEN ** REELS

# Symbol frequency per reel
freq = {}
for idx in range(8):
    freq[idx] = [strip.count(idx) for strip in STRIPS]

print("=== FRECUENCIAS ===")
for idx in range(8):
    print(f"  {SYMS[idx]:6s}: {freq[idx]}")

# p_j, w_j, q_j
WILD = 7
w = [freq[WILD][j] / STRIP_LEN for j in range(5)]
print(f"\nw_j (Wild): {w}")

print("\n=== LINE RTP ===")
total_line_rtp = 0
for idx in range(8):
    is_wild = idx == WILD
    p = [(freq[idx][j] + freq[WILD][j]) / STRIP_LEN if not is_wild else freq[WILD][j] / STRIP_LEN for j in range(5)]
    q = [1 - p[j] for j in range(5)]

    for count in [3, 4, 5]:
        if is_wild and count < 5:
            continue

        if is_wild:
            prob = 1
            for j in range(5):
                prob *= w[j]
        else:
            pp = 1
            wp = 1
            for j in range(count):
                pp *= p[j]
                wp *= w[j]
            if count < 5:
                prob = (pp - wp) * q[count]
            else:
                prob = pp - wp

        hits_1 = prob * COMBOS
        hits_20 = hits_1 * LINES
        mult_new = OLD_PAY[idx][count - 3] / LINES
        rtp = prob * LINES * mult_new

        total_line_rtp += rtp
        if hits_20 > 0.5:
            print(f"  {SYMS[idx]:6s} x{count}: P={prob:.10f}  hits_20={hits_20:>12.1f}  mult={mult_new:.2f}  RTP={rtp*100:.4f}%")

print(f"\n  TOTAL LINE RTP: {total_line_rtp*100:.4f}%")

# Wild grid probabilities
p_wild_grid = freq[WILD][0] * ROWS / STRIP_LEN  # same for all reels
print(f"\n=== WILD PAY ===")
print(f"P(wild visible per reel) = {p_wild_grid}")

from math import comb
total_wild_pay_rtp = 0
for k in [3, 4, 5]:
    pk = comb(5, k) * p_wild_grid**k * (1 - p_wild_grid)**(5 - k)
    occ = pk * COMBOS
    wild_pay_rtp = pk * WILD_PAYS[k]
    total_wild_pay_rtp += wild_pay_rtp
    print(f"  {k} wilds: P={pk:.10f}  occ={occ:.1f}  wild pay={WILD_PAYS[k]}x  RTP={wild_pay_rtp*100:.4f}%")
print(f"  TOTAL WILD PAY RTP: {total_wild_pay_rtp*100:.4f}%")

# Bonus
print(f"\n=== BONUS ===")
total_bonus_rtp = 0
for i, k in enumerate([3, 4, 5]):
    pk = comb(5, k) * p_wild_grid**k * (1 - p_wild_grid)**(5 - k)
    occ = pk * COMBOS
    pool = BONUS_POOLS[i]
    skulls = BONUS_SKULLS[i]
    ev = pool / (skulls + 1)
    bonus_rtp = pk * ev
    total_bonus_rtp += bonus_rtp
    ev_total = ev + WILD_PAYS[k]
    print(f"  Tier {i} ({k}W): pool={pool}  skulls={skulls}  EV_bonus={ev:.1f}  EV_total={ev_total:.1f}  RTP={bonus_rtp*100:.4f}%")
print(f"  TOTAL BONUS RTP: {total_bonus_rtp*100:.4f}%")

print(f"\n=== TOTALS ===")
total = total_line_rtp + total_wild_pay_rtp + total_bonus_rtp
print(f"  Line RTP:     {total_line_rtp*100:.4f}%")
print(f"  Wild Pay RTP: {total_wild_pay_rtp*100:.4f}%")
print(f"  Bonus RTP:   {total_bonus_rtp*100:.4f}%")
print(f"  TOTAL RTP:   {total*100:.4f}%")
print(f"  Target:      96.1232%")
print(f"  Match: {'YES' if abs(total - 0.961232) < 0.0001 else 'NO'}")

# Verify EVs
print(f"\n=== EV VERIFICATION ===")
for i, k in enumerate([3, 4, 5]):
    pool = BONUS_POOLS[i]
    skulls = BONUS_SKULLS[i]
    ev_bonus = pool / (skulls + 1)
    ev_total = ev_bonus + WILD_PAYS[k]
    old_ev = [20, 40, 100][i]
    print(f"  {k}W: wild_pay={WILD_PAYS[k]} + bonus_ev={ev_bonus:.1f} = {ev_total:.1f} (old={old_ev}) {'OK' if abs(ev_total - old_ev) < 0.01 else 'FAIL'}")
