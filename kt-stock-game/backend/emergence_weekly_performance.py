"""
Emergence weekly performance vs. SOXX.

Pulls actual closing prices via yfinance for every ticker in the Emergence
list plus SOXX as benchmark, over a Friday-close -> Friday-close window, and
reports:

  1. A ranked table, best to worst performer
  2. The average AND median return of the Emergence list
  3. SOXX's return over the same window
  4. How many names beat SOXX, and how many were positive vs. negative
  5. Names whose move looks company-specific (statistical outliers) rather than
     macro, so they don't distort the read

Usage:
    python emergence_weekly_performance.py                 # last Fri -> today
    python emergence_weekly_performance.py 2026-07-10 2026-07-17

Requires: yfinance, pandas, numpy  (pip install yfinance pandas numpy)

NOTE: yfinance talks to Yahoo Finance. Some sandboxed/proxied environments
block Yahoo's hosts (query1/query2.finance.yahoo.com) at the network-policy
layer, which surfaces as repeated "no data" / 403 errors. Run this where
outbound HTTPS to Yahoo Finance is permitted (e.g. a local machine).
"""

import sys
from datetime import date, timedelta

import numpy as np
import pandas as pd
import yfinance as yf

# The 2026-07-16 Emergence list (26 names), preserving surfaced order.
EMERGENCE = [
    "SSYS", "AMSC", "DAKT", "EVLV", "CMTL", "AIP", "NL", "CDRE", "MRLN", "HAWK",
    "ROCK", "SATL", "PLAB", "CLFD", "DSGX", "CWCO", "RGR", "PKE", "RCAT", "AIRO",
    "NTGR", "EPAC", "IPGP", "BDC", "ENVX", "VICR",
]
BENCHMARK = "SOXX"

NAMES = {
    "SSYS": "Stratasys", "AMSC": "American Superconductor", "DAKT": "Daktronics",
    "EVLV": "Evolv Technologies", "CMTL": "Comtech Telecom", "AIP": "Arteris",
    "NL": "NL Industries", "CDRE": "Cadre Holdings", "MRLN": "Marlin/Merlin",
    "HAWK": "HawkEye 360", "ROCK": "Gibraltar Industries", "SATL": "Satellogic",
    "PLAB": "Photronics", "CLFD": "Clearfield", "DSGX": "Descartes Systems",
    "CWCO": "Consolidated Water", "RGR": "Sturm Ruger", "PKE": "Park Aerospace",
    "RCAT": "Red Cat Holdings", "AIRO": "AIRO Group", "NTGR": "NETGEAR",
    "EPAC": "Enerpac Tool Group", "IPGP": "IPG Photonics", "BDC": "Belden",
    "ENVX": "Enovix", "VICR": "Vicor", "SOXX": "iShares Semiconductor ETF",
}


def last_friday(today: date) -> date:
    """Most recent Friday strictly before `today` (or `today` if it is Friday)."""
    if today.weekday() == 4:  # Friday
        return today
    return today - timedelta(days=(today.weekday() - 4) % 7)


def resolve_window(argv):
    if len(argv) == 3:
        return pd.Timestamp(argv[1]), pd.Timestamp(argv[2])
    today = date.today()
    end = today
    start = last_friday(today) - timedelta(days=7)  # prior Friday
    if today.weekday() == 4:
        start = today - timedelta(days=7)
    return pd.Timestamp(start), pd.Timestamp(end)


def close_on_or_before(closes: pd.Series, anchor: pd.Timestamp):
    s = closes[closes.index <= anchor].dropna()
    if s.empty:
        return None, None
    return float(s.iloc[-1]), s.index[-1].date()


def main():
    start, end = resolve_window(sys.argv)
    tickers = EMERGENCE + [BENCHMARK]

    # Pad the download window so both anchors have a trading day at/just before.
    data = yf.download(
        tickers,
        start=(start - pd.Timedelta(days=6)).strftime("%Y-%m-%d"),
        end=(end + pd.Timedelta(days=1)).strftime("%Y-%m-%d"),
        auto_adjust=False, progress=False, group_by="ticker",
    )

    rows = []
    for t in tickers:
        df = data[t] if isinstance(data.columns, pd.MultiIndex) else data
        closes = df["Close"].dropna()
        p0, d0 = close_on_or_before(closes, start)
        p1, d1 = close_on_or_before(closes, end)
        if p0 is None or p1 is None:
            rows.append({"ticker": t, "ret": np.nan, "p0": p0, "p1": p1,
                         "d0": d0, "d1": d1})
            continue
        rows.append({"ticker": t, "ret": (p1 / p0 - 1) * 100.0,
                     "p0": p0, "p1": p1, "d0": d0, "d1": d1})

    res = pd.DataFrame(rows).set_index("ticker")
    soxx = res.loc[BENCHMARK, "ret"]
    emg = res.loc[EMERGENCE].dropna(subset=["ret"]).sort_values("ret", ascending=False)

    d0 = res["d0"].dropna().iloc[0]
    d1 = res["d1"].dropna().iloc[0]

    # 1. Ranked table
    print(f"\nWindow: {d0} close -> {d1} close\n")
    print(f"{'#':>2}  {'Ticker':<6} {'Name':<26} {'Close0':>9} {'Close1':>9} {'Ret%':>8}  vs SOXX")
    for i, (t, r) in enumerate(emg.iterrows(), 1):
        beat = "beat" if r.ret > soxx else "lag"
        print(f"{i:>2}  {t:<6} {NAMES.get(t, t):<26} {r.p0:>9.2f} {r.p1:>9.2f} "
              f"{r.ret:>+8.2f}  {beat}")

    missing = res.loc[EMERGENCE][res.loc[EMERGENCE, "ret"].isna()].index.tolist()
    if missing:
        print(f"\n  (no data returned for: {', '.join(missing)})")

    # 2. Average and median
    avg = emg["ret"].mean()
    med = emg["ret"].median()
    print(f"\nEmergence average return: {avg:+.2f}%")
    print(f"Emergence median  return: {med:+.2f}%")

    # 3. SOXX
    print(f"SOXX return             : {soxx:+.2f}%")

    # 4. Counts
    n = len(emg)
    beat = int((emg["ret"] > soxx).sum())
    pos = int((emg["ret"] > 0).sum())
    neg = int((emg["ret"] < 0).sum())
    print(f"\nOf {n} names with data: {beat} beat SOXX, {n - beat} lagged.")
    print(f"Positive: {pos}   Negative: {neg}   Flat: {n - pos - neg}")

    # 5. Company-specific / idiosyncratic movers (robust outliers via MAD z-score)
    r = emg["ret"]
    med_r = r.median()
    mad = (r - med_r).abs().median()
    scale = 1.4826 * mad if mad > 0 else r.std()
    emg = emg.assign(robust_z=(r - med_r) / scale if scale else np.nan)
    flags = emg[emg["robust_z"].abs() >= 2.5]
    print("\nLikely company-specific movers (|robust z| >= 2.5 vs. the list):")
    if flags.empty:
        print("  none — moves look broadly macro/sector-driven.")
    else:
        for t, row in flags.iterrows():
            print(f"  {t:<6} {row.ret:+.2f}%  (z={row.robust_z:+.1f}) — {NAMES.get(t, t)}")
    print("\n  Reminder: statistical flags catch magnitude, not cause. Cross-check")
    print("  flagged names for single-stock news (earnings, litigation, M&A).")


if __name__ == "__main__":
    main()
