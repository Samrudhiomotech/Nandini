"""
Seed the database with a demo participant who has completed calibration,
so the frontend can immediately show results without running the full experiment.
Run: python -m backend.seed_data
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from backend.database import SessionLocal, init_db
from backend.models import Participant, Trial, Response, TrialPhase
from backend.experiment import build_calibration_trials, build_validation_trials
from backend.scoring import compute_dei
from backend.predictor import predict_iocs
import random
import json

SEED_RT_BY_SIZE = {3: 4000, 6: 6000, 9: 8500, 12: 13000, 18: 22000}
# Simulate someone whose sweet spot is around size 6


def seed():
    init_db()
    db = SessionLocal()

    try:
        p = Participant(name="Demo Participant", age=25)
        db.add(p)
        db.flush()

        trials = build_calibration_trials(p.id)
        rng = random.Random(42)

        for td in trials:
            trial = Trial(
                participant_id=td["participant_id"],
                phase=TrialPhase.CALIBRATION,
                choice_set_size=td["choice_set_size"],
                correct_option_index=td["correct_option_index"],
                options_json=td["options_json"],
                trial_order=td["trial_order"],
            )
            db.add(trial)
            db.flush()

            size = td["choice_set_size"]
            # Accuracy degrades with set size for demo participant
            acc = 1 if rng.random() < max(0.3, 0.9 - (size - 3) * 0.05) else 0
            rt = SEED_RT_BY_SIZE.get(size, 10000) + rng.randint(-1000, 1000)
            conf = max(1, min(7, 7 - int((size - 3) * 0.25) + rng.randint(-1, 1)))
            diff = min(7, max(1, 2 + int((size - 3) * 0.3) + rng.randint(-1, 1)))
            reg = min(7, max(1, 1 + int((size - 3) * 0.25) + rng.randint(-1, 1)))
            sc = min(5, int((size - 3) * 0.25) + rng.randint(0, 1))

            dei = compute_dei(bool(acc), rt, conf, diff, reg, sc)
            resp = Response(
                trial_id=trial.id,
                chosen_option_index=td["correct_option_index"] if acc else rng.randint(0, size - 1),
                response_time_ms=rt,
                confidence=conf,
                perceived_difficulty=diff,
                regret=reg,
                selection_changes=sc,
                is_correct=bool(acc),
                dei_score=dei,
            )
            db.add(resp)

        db.flush()

        # Compute prediction
        pairs = []
        for trial in db.query(Trial).filter(Trial.participant_id == p.id).all():
            if trial.response:
                pairs.append((trial.choice_set_size, trial.response.dei_score))

        predicted, confidence, curve_params, dei_per_size = predict_iocs(pairs)
        p.predicted_iocs = predicted
        p.prediction_confidence = confidence

        # Build validation trials
        val_trials = build_validation_trials(p.id, predicted)
        for td in val_trials:
            vt = Trial(
                participant_id=td["participant_id"],
                phase=TrialPhase.VALIDATION,
                choice_set_size=td["choice_set_size"],
                correct_option_index=td["correct_option_index"],
                options_json=td["options_json"],
                trial_order=td["trial_order"],
            )
            db.add(vt)
            db.flush()
            size = td["choice_set_size"]
            acc = 1 if rng.random() < max(0.3, 0.85 - (size - 3) * 0.04) else 0
            rt = SEED_RT_BY_SIZE.get(size, 10000) + rng.randint(-800, 800)
            conf = max(1, min(7, 6 - int((size - 3) * 0.2) + rng.randint(-1, 1)))
            diff = min(7, max(1, 2 + int((size - 3) * 0.25)))
            reg = min(7, max(1, 1 + int((size - 3) * 0.2)))
            sc = min(5, int((size - 3) * 0.2))
            dei = compute_dei(bool(acc), rt, conf, diff, reg, sc)
            vr = Response(
                trial_id=vt.id,
                chosen_option_index=td["correct_option_index"] if acc else rng.randint(0, size - 1),
                response_time_ms=rt,
                confidence=conf,
                perceived_difficulty=diff,
                regret=reg,
                selection_changes=sc,
                is_correct=bool(acc),
                dei_score=dei,
            )
            db.add(vr)

        db.commit()
        print(f"[OK] Seeded demo participant: {p.id}")
        print(f"   Predicted IOCS: {predicted} (confidence R²={confidence:.3f})")
        print(f"   DEI per size: {dei_per_size}")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
