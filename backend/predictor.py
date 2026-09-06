"""
IOCS Prediction via Gaussian curve fitting.

Strategy:
  1. Aggregate DEI scores per choice-set size for a participant.
  2. Fit a Gaussian: f(x) = a * exp(-((x - mu)^2) / (2 * sigma^2)) + base
  3. mu is the predicted IOCS.
  4. Fallback: polynomial regression peak if Gaussian fails to converge.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import numpy as np
from scipy.optimize import curve_fit
from scipy.optimize import OptimizeWarning
import warnings


CHOICE_SET_SIZES = [3, 6, 9, 12, 18]


def _gaussian(x, a, mu, sigma, base):
    return a * np.exp(-((x - mu) ** 2) / (2 * sigma ** 2)) + base


def _fit_gaussian(
    sizes: List[float], dei_vals: List[float]
) -> Tuple[Optional[float], Optional[float], Optional[dict]]:
    """
    Fit Gaussian to (sizes, dei_vals).
    Returns (predicted_iocs, confidence, curve_params_dict).
    confidence is R² of the fit, clipped to [0, 1].
    """
    x = np.array(sizes, dtype=float)
    y = np.array(dei_vals, dtype=float)

    # Initial guess: peak near argmax
    peak_idx = int(np.argmax(y))
    a0 = float(y[peak_idx] - np.min(y)) + 0.01
    mu0 = x[peak_idx]
    sigma0 = 4.0
    base0 = float(np.min(y))

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", OptimizeWarning)
            popt, pcov = curve_fit(
                _gaussian,
                x,
                y,
                p0=[a0, mu0, sigma0, base0],
                bounds=(
                    [0, x.min(), 0.5, -1.0],
                    [2.0, x.max(), 20.0, 1.0],
                ),
                maxfev=10_000,
            )

        a_fit, mu_fit, sigma_fit, base_fit = popt

        # R² confidence
        y_pred = _gaussian(x, *popt)
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2) or 1e-9
        r2 = float(np.clip(1 - ss_res / ss_tot, 0.0, 1.0))

        params = {
            "method": "gaussian",
            "a": round(float(a_fit), 4),
            "mu": round(float(mu_fit), 4),
            "sigma": round(float(sigma_fit), 4),
            "base": round(float(base_fit), 4),
            "r2": round(r2, 4),
        }

        predicted = float(np.clip(mu_fit, x.min(), x.max()))
        return predicted, r2, params

    except Exception:
        return None, None, None


def _poly_fallback(
    sizes: List[float], dei_vals: List[float]
) -> Tuple[float, float, dict]:
    """Fit degree-2 polynomial; peak = IOCS estimate."""
    x = np.array(sizes, dtype=float)
    y = np.array(dei_vals, dtype=float)

    coeffs = np.polyfit(x, y, 2)
    p = np.poly1d(coeffs)

    # Dense evaluation
    x_dense = np.linspace(x.min(), x.max(), 500)
    y_dense = p(x_dense)
    mu_est = float(x_dense[np.argmax(y_dense)])

    # R²
    y_pred = p(x)
    ss_res = np.sum((y - y_pred) ** 2)
    ss_tot = np.sum((y - np.mean(y)) ** 2) or 1e-9
    r2 = float(np.clip(1 - ss_res / ss_tot, 0.0, 1.0))

    params = {
        "method": "polynomial",
        "coeffs": [round(float(c), 4) for c in coeffs],
        "r2": round(r2, 4),
    }
    return mu_est, r2, params


def predict_iocs(
    dei_by_trial: List[Tuple[int, float]]
) -> Tuple[float, float, dict, dict]:
    """
    Given a list of (choice_set_size, dei_score) pairs (calibration data),
    compute the predicted IOCS.

    Returns:
        predicted_iocs     – continuous optimal set size
        confidence         – R² of the fit
        curve_params       – dict describing the fit
        dei_per_size       – {size: mean_dei}
    """
    # Aggregate DEI per size
    from collections import defaultdict
    buckets: Dict[int, List[float]] = defaultdict(list)
    for size, dei in dei_by_trial:
        buckets[int(size)].append(dei)

    sizes = sorted(buckets.keys())
    means = [float(np.mean(buckets[s])) for s in sizes]
    dei_per_size = {str(s): round(float(np.mean(buckets[s])), 4) for s in sizes}

    if len(sizes) < 3:
        # Not enough data — return size with max DEI
        best = sizes[means.index(max(means))]
        return float(best), 0.0, {"method": "argmax"}, dei_per_size

    # Try Gaussian first
    predicted, r2, params = _fit_gaussian(sizes, means)

    if predicted is None or r2 is None or r2 < 0.3:
        # Fallback to polynomial
        predicted, r2, params = _poly_fallback(sizes, means)

    # Snap to nearest tested size if very close
    nearest = min(sizes, key=lambda s: abs(s - predicted))
    if abs(nearest - predicted) < 1.5:
        predicted = float(nearest)

    return round(predicted, 2), round(r2, 4), params, dei_per_size


def gaussian_curve_points(
    params: dict,
    x_min: float = 1.0,
    x_max: float = 20.0,
    n_points: int = 100,
) -> List[dict]:
    """Generate dense curve points for the frontend chart."""
    x_vals = np.linspace(x_min, x_max, n_points)

    if params.get("method") == "gaussian":
        y_vals = _gaussian(
            x_vals,
            params["a"],
            params["mu"],
            params["sigma"],
            params["base"],
        )
    elif params.get("method") == "polynomial":
        coeffs = params["coeffs"]
        p = np.poly1d(coeffs)
        y_vals = p(x_vals)
    else:
        return []

    return [
        {"x": round(float(x), 2), "y": round(float(y), 4)}
        for x, y in zip(x_vals, y_vals)
    ]
