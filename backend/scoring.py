"""
Decision Efficiency Index (DEI) computation.

DEI = w1 * accuracy
    - w2 * norm(response_time_ms)
    + w3 * norm(confidence)
    - w4 * norm(perceived_difficulty)
    - w5 * norm(regret)
    - w6 * norm(selection_changes)

Normalisations:
  - response_time_ms : [500, 60000] ms  → higher is worse
  - confidence       : [1, 7]           → higher is better
  - perceived_difficulty : [1, 7]       → higher is worse
  - regret           : [1, 7]           → higher is worse
  - selection_changes: [0, 10]          → higher is worse (capped at 10)
"""
from __future__ import annotations

WEIGHTS = {
    "accuracy":             0.35,
    "response_time":        0.20,
    "confidence":           0.15,
    "perceived_difficulty": 0.15,
    "regret":               0.10,
    "selection_changes":    0.05,
}

RT_MIN, RT_MAX = 500.0, 60_000.0
SCALE_MIN, SCALE_MAX = 1.0, 7.0
SC_MIN, SC_MAX = 0.0, 10.0


def _clamp(val: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, val))


def _norm_higher_better(val: float, lo: float, hi: float) -> float:
    """Normalise so that higher val → higher score ∈ [0,1]."""
    return (_clamp(val, lo, hi) - lo) / (hi - lo)


def _norm_lower_better(val: float, lo: float, hi: float) -> float:
    """Normalise so that lower val → higher score ∈ [0,1]."""
    return 1.0 - (_clamp(val, lo, hi) - lo) / (hi - lo)


def compute_dei(
    is_correct: bool,
    response_time_ms: int,
    confidence: int,
    perceived_difficulty: int,
    regret: int,
    selection_changes: int,
) -> float:
    """
    Returns DEI ∈ [-1, 1].
    Positive scores indicate efficient decisions; negative scores indicate overloaded ones.
    """
    accuracy = 1.0 if is_correct else 0.0

    norm_rt   = _norm_lower_better(response_time_ms, RT_MIN, RT_MAX)
    norm_conf = _norm_higher_better(confidence,           SCALE_MIN, SCALE_MAX)
    norm_diff = _norm_lower_better(perceived_difficulty,  SCALE_MIN, SCALE_MAX)
    norm_reg  = _norm_lower_better(regret,               SCALE_MIN, SCALE_MAX)
    norm_sc   = _norm_lower_better(selection_changes,    SC_MIN,    SC_MAX)

    raw = (
        WEIGHTS["accuracy"]             * accuracy
        + WEIGHTS["response_time"]      * norm_rt
        + WEIGHTS["confidence"]         * norm_conf
        - WEIGHTS["perceived_difficulty"] * (1.0 - norm_diff)   # re-penalise
        - WEIGHTS["regret"]             * (1.0 - norm_reg)
        - WEIGHTS["selection_changes"]  * (1.0 - norm_sc)
    )

    # Rescale from [−0.30, 1.0] practical range → [−1, 1]
    # Theoretical max ≈ 0.35+0.20+0.15 = 0.70, min ≈ −0.30
    dei = max(-1.0, min(1.0, round(raw, 4)))
    return dei
