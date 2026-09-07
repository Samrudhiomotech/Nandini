"""
Experiment trial generation.
Each trial presents N laptop alternatives with multi-attribute specs.
One option is objectively optimal (highest utility score, computed as a
weighted sum of normalised attributes).
"""
from __future__ import annotations

import json
import random
from typing import List, Tuple

CHOICE_SET_SIZES_CALIBRATION = [3, 6, 9, 12, 18]
TRIALS_PER_SIZE = 3  # 15 calibration trials total

VALIDATION_SIZES_RELATIVE = {
    "fewer": -1,   # IOCS - 3 (floored at 3)
    "optimal": 0,  # IOCS
    "more": 1,     # IOCS + 3 (capped at 18)
}
VALIDATION_TRIALS_PER_SIZE = 3  # 9 validation trials total

# Attribute weights for true utility (hidden from participant)
WEIGHTS = {
    "battery_hours": 0.30,
    "ram_gb": 0.25,
    "storage_gb": 0.20,
    "price": -0.15,   # lower price → higher utility
    "display_inches": 0.10,
}

# Realistic ranges (Prices in Indian Rupees)
ATTR_RANGES = {
    "price":          (44900, 199900),
    "battery_hours":  (4.0, 20.0),
    "ram_gb":         [8, 16, 32, 64],
    "storage_gb":     [256, 512, 1024, 2048],
    "display_inches": [13.3, 14.0, 15.6, 16.0, 17.3],
}

BRAND_NAMES = [
    "NovaBlade", "AeroCore", "ZenBook Pro", "LuminaThin", "StormX",
    "VectorEdge", "PrismAir", "OnyxPeak", "TitanSlate", "EchoFlex",
    "QuantumBook", "NexusUltra", "PolarEdge", "VexelPro", "SkyLite",
    "ChromaForce", "OrbitBook", "HorizonMax", "IrisPro", "CelestialX",
]


def _normalise(value: float, low: float, high: float) -> float:
    if high == low:
        return 0.5
    return (value - low) / (high - low)


def _compute_utility(option: dict, pool: List[dict]) -> float:
    """Compute utility of one option relative to pool extremes."""
    price_vals   = [o["price"]          for o in pool]
    batt_vals    = [o["battery_hours"]  for o in pool]
    ram_vals     = [o["ram_gb"]         for o in pool]
    stor_vals    = [o["storage_gb"]     for o in pool]
    disp_vals    = [o["display_inches"] for o in pool]

    u = (
        WEIGHTS["battery_hours"]  * _normalise(option["battery_hours"],  min(batt_vals),  max(batt_vals))
        + WEIGHTS["ram_gb"]       * _normalise(option["ram_gb"],          min(ram_vals),   max(ram_vals))
        + WEIGHTS["storage_gb"]   * _normalise(option["storage_gb"],      min(stor_vals),  max(stor_vals))
        + WEIGHTS["price"]        * _normalise(option["price"],            min(price_vals), max(price_vals))
        + WEIGHTS["display_inches"] * _normalise(option["display_inches"], min(disp_vals),  max(disp_vals))
    )
    return round(u, 4)


def generate_option(index: int, rng: random.Random) -> dict:
    price = rng.randint(*ATTR_RANGES["price"])
    battery = round(rng.uniform(*ATTR_RANGES["battery_hours"]), 1)
    ram = rng.choice(ATTR_RANGES["ram_gb"])
    storage = rng.choice(ATTR_RANGES["storage_gb"])
    display = rng.choice(ATTR_RANGES["display_inches"])
    name = BRAND_NAMES[index % len(BRAND_NAMES)] + f" {rng.randint(10, 99)}"
    return {
        "index": index,
        "name": name,
        "price": price,
        "battery_hours": battery,
        "ram_gb": ram,
        "storage_gb": storage,
        "display_inches": display,
        "utility_score": 0.0,  # filled after pool is built
    }


def generate_trial_options(n: int, seed: int = None) -> Tuple[List[dict], int]:
    """
    Generate a pool of n laptop options.
    Returns (options_list, correct_index) where correct_index has max utility.
    """
    rng = random.Random(seed)
    pool = [generate_option(i, rng) for i in range(n)]

    # Compute utilities relative to pool
    for opt in pool:
        opt["utility_score"] = _compute_utility(opt, pool)

    correct_index = max(range(n), key=lambda i: pool[i]["utility_score"])
    return pool, correct_index


def build_calibration_trials(participant_id: str) -> List[dict]:
    """
    Build the full calibration trial list:
    TRIALS_PER_SIZE * CHOICE_SET_SIZES = 15 trials, shuffled.
    """
    tasks = []
    for size in CHOICE_SET_SIZES_CALIBRATION:
        for rep in range(TRIALS_PER_SIZE):
            seed = hash((participant_id, size, rep)) & 0xFFFFFFFF
            options, correct = generate_trial_options(size, seed=seed)
            tasks.append({
                "participant_id": participant_id,
                "phase": "calibration",
                "choice_set_size": size,
                "correct_option_index": correct,
                "options_json": json.dumps(options),
            })
    random.shuffle(tasks)
    for i, t in enumerate(tasks):
        t["trial_order"] = i
    return tasks


def build_validation_trials(participant_id: str, predicted_iocs: float) -> List[dict]:
    """
    Build 9 validation trials: 3 at IOCS-3, 3 at IOCS, 3 at IOCS+3.
    """
    iocs = round(predicted_iocs)
    sizes = {
        "fewer":   max(3, iocs - 3),
        "optimal": iocs,
        "more":    min(18, iocs + 3),
    }
    tasks = []
    for label, size in sizes.items():
        for rep in range(VALIDATION_TRIALS_PER_SIZE):
            seed = hash((participant_id, label, rep, "val")) & 0xFFFFFFFF
            options, correct = generate_trial_options(size, seed=seed)
            tasks.append({
                "participant_id": participant_id,
                "phase": "validation",
                "choice_set_size": size,
                "correct_option_index": correct,
                "options_json": json.dumps(options),
            })
    random.shuffle(tasks)
    for i, t in enumerate(tasks):
        t["trial_order"] = 100 + i
    return tasks
