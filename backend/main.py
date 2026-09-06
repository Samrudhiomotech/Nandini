"""
FastAPI application — Adaptive Choice Architecture Experimental Platform.
"""
from __future__ import annotations

import json
from collections import defaultdict
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.database import get_db, init_db
from backend.experiment import build_calibration_trials, build_validation_trials
from backend.models import (
    AdminSummaryOut,
    Participant,
    ParticipantCreate,
    ParticipantOut,
    PredictionOut,
    Response,
    ResponseCreate,
    ResponseOut,
    ResultsOut,
    Trial,
    TrialOut,
    TrialPhase,
    OptionSchema,
)
from backend.predictor import gaussian_curve_points, predict_iocs
from backend.scoring import compute_dei

app = FastAPI(
    title="Adaptive Choice Architecture API",
    description=(
        "Backend for the ACA Experimental Platform: manage participants, "
        "serve decision trials, score DEI, and predict IOCS."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Participants
# ---------------------------------------------------------------------------


@app.post("/participants", response_model=ParticipantOut, status_code=201)
def create_participant(body: ParticipantCreate, db: Session = Depends(get_db)):
    participant = Participant(name=body.name, age=body.age)
    db.add(participant)
    db.flush()

    # Generate and persist calibration trials
    trial_dicts = build_calibration_trials(participant.id)
    for td in trial_dicts:
        trial = Trial(
            participant_id=td["participant_id"],
            phase=TrialPhase.CALIBRATION,
            choice_set_size=td["choice_set_size"],
            correct_option_index=td["correct_option_index"],
            options_json=td["options_json"],
            trial_order=td["trial_order"],
        )
        db.add(trial)

    db.commit()
    db.refresh(participant)
    return participant


@app.get("/participants/{participant_id}", response_model=ParticipantOut)
def get_participant(participant_id: str, db: Session = Depends(get_db)):
    p = db.get(Participant, participant_id)
    if not p:
        raise HTTPException(404, "Participant not found")
    return p


# ---------------------------------------------------------------------------
# Trials
# ---------------------------------------------------------------------------


@app.get("/trials/next/{participant_id}", response_model=Optional[TrialOut])
def next_trial(participant_id: str, db: Session = Depends(get_db)):
    """Return the next unanswered trial for the participant, or null if done."""
    p = db.get(Participant, participant_id)
    if not p:
        raise HTTPException(404, "Participant not found")

    # Trials without a response, ordered by trial_order
    trials: List[Trial] = (
        db.query(Trial)
        .filter(Trial.participant_id == participant_id)
        .outerjoin(Response, Trial.id == Response.trial_id)
        .filter(Response.id == None)  # noqa: E711
        .order_by(Trial.trial_order)
        .all()
    )

    if not trials:
        return None

    trial = trials[0]
    options = [OptionSchema(**opt) for opt in json.loads(trial.options_json)]
    # Strip utility_score from response to keep it hidden
    hidden_options = [
        OptionSchema(**{**opt.model_dump(), "utility_score": 0.0})
        for opt in options
    ]

    return TrialOut(
        id=trial.id,
        participant_id=trial.participant_id,
        phase=trial.phase,
        choice_set_size=trial.choice_set_size,
        trial_order=trial.trial_order,
        options=hidden_options,
    )


@app.post("/trials/{trial_id}/respond", response_model=ResponseOut, status_code=201)
def submit_response(
    trial_id: str, body: ResponseCreate, db: Session = Depends(get_db)
):
    trial = db.get(Trial, trial_id)
    if not trial:
        raise HTTPException(404, "Trial not found")

    # Check no duplicate
    existing = db.query(Response).filter(Response.trial_id == trial_id).first()
    if existing:
        raise HTTPException(409, "Response already submitted for this trial")

    is_correct = body.chosen_option_index == trial.correct_option_index
    dei = compute_dei(
        is_correct=is_correct,
        response_time_ms=body.response_time_ms,
        confidence=body.confidence,
        perceived_difficulty=body.perceived_difficulty,
        regret=body.regret,
        selection_changes=body.selection_changes,
    )

    resp = Response(
        trial_id=trial_id,
        chosen_option_index=body.chosen_option_index,
        response_time_ms=body.response_time_ms,
        confidence=body.confidence,
        perceived_difficulty=body.perceived_difficulty,
        regret=body.regret,
        selection_changes=body.selection_changes,
        is_correct=is_correct,
        dei_score=dei,
    )
    db.add(resp)
    db.commit()
    db.refresh(resp)
    return resp


# ---------------------------------------------------------------------------
# Prediction
# ---------------------------------------------------------------------------


@app.get("/participants/{participant_id}/predict", response_model=PredictionOut)
def predict(participant_id: str, db: Session = Depends(get_db)):
    p = db.get(Participant, participant_id)
    if not p:
        raise HTTPException(404, "Participant not found")

    # Gather calibration responses
    calib_trials = (
        db.query(Trial)
        .filter(
            Trial.participant_id == participant_id,
            Trial.phase == TrialPhase.CALIBRATION,
        )
        .all()
    )

    pairs = []
    for trial in calib_trials:
        if trial.response:
            pairs.append((trial.choice_set_size, trial.response.dei_score))

    if len(pairs) < 5:
        raise HTTPException(422, "Not enough calibration data (need ≥ 5 responses)")

    predicted, confidence, curve_params, dei_per_size = predict_iocs(pairs)

    # Persist prediction
    p.predicted_iocs = predicted
    p.prediction_confidence = confidence
    db.commit()

    # Build validation trials if not yet created
    val_exists = (
        db.query(Trial)
        .filter(
            Trial.participant_id == participant_id,
            Trial.phase == TrialPhase.VALIDATION,
        )
        .first()
    )
    if not val_exists:
        val_trials = build_validation_trials(participant_id, predicted)
        for td in val_trials:
            db.add(
                Trial(
                    participant_id=td["participant_id"],
                    phase=TrialPhase.VALIDATION,
                    choice_set_size=td["choice_set_size"],
                    correct_option_index=td["correct_option_index"],
                    options_json=td["options_json"],
                    trial_order=td["trial_order"],
                )
            )
        db.commit()

    curve_points = gaussian_curve_points(curve_params)
    return PredictionOut(
        participant_id=participant_id,
        predicted_iocs=predicted,
        confidence=confidence,
        curve_params={**curve_params, "curve_points": curve_points},
        dei_per_size=dei_per_size,
    )


# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------


@app.get("/participants/{participant_id}/results", response_model=ResultsOut)
def results(participant_id: str, db: Session = Depends(get_db)):
    p = db.get(Participant, participant_id)
    if not p:
        raise HTTPException(404, "Participant not found")

    if p.predicted_iocs is None:
        raise HTTPException(422, "Run /predict first")

    # Calibration DEI by size
    calib_trials = (
        db.query(Trial)
        .filter(
            Trial.participant_id == participant_id,
            Trial.phase == TrialPhase.CALIBRATION,
        )
        .all()
    )
    calib_buckets = defaultdict(list)
    for t in calib_trials:
        if t.response:
            calib_buckets[t.choice_set_size].append(t.response.dei_score)
    calibration_dei = {
        str(k): round(sum(v) / len(v), 4) for k, v in calib_buckets.items()
    }

    # Validation DEI by size
    val_trials = (
        db.query(Trial)
        .filter(
            Trial.participant_id == participant_id,
            Trial.phase == TrialPhase.VALIDATION,
        )
        .all()
    )
    val_buckets = defaultdict(list)
    for t in val_trials:
        if t.response:
            val_buckets[t.choice_set_size].append(t.response.dei_score)
    validation_dei = {
        str(k): round(sum(v) / len(v), 4) for k, v in val_buckets.items()
    }

    # Improvement: DEI at optimal vs avg of others
    iocs_key = str(int(round(p.predicted_iocs)))
    improvement_pct = None
    if iocs_key in validation_dei and len(validation_dei) > 1:
        optimal_dei = validation_dei[iocs_key]
        others = [v for k, v in validation_dei.items() if k != iocs_key]
        avg_others = sum(others) / len(others)
        if avg_others != 0:
            improvement_pct = round((optimal_dei - avg_others) / abs(avg_others) * 100, 1)

    # Validated IOCS: size with highest validation DEI
    validated_iocs: Optional[float] = None
    if val_buckets:
        validated_iocs = float(
            max(val_buckets.keys(), key=lambda k: sum(val_buckets[k]) / len(val_buckets[k]))
        )
        p.validated_iocs = validated_iocs
        db.commit()

    msg = (
        f"Your predicted optimal choice-set size is {int(round(p.predicted_iocs))}. "
        + (
            f"Validation confirmed IOCS={int(validated_iocs)}."
            if validated_iocs is not None
            else "Complete validation trials to confirm."
        )
    )

    return ResultsOut(
        participant_id=participant_id,
        predicted_iocs=p.predicted_iocs,
        validation_iocs=validated_iocs,
        calibration_dei=calibration_dei,
        validation_dei=validation_dei,
        improvement_pct=improvement_pct,
        message=msg,
    )


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------


@app.get("/admin/summary", response_model=AdminSummaryOut)
def admin_summary(db: Session = Depends(get_db)):
    participants = db.query(Participant).all()
    total = len(participants)
    predicted_list = [p.predicted_iocs for p in participants if p.predicted_iocs]
    avg_iocs = round(sum(predicted_list) / len(predicted_list), 2) if predicted_list else None

    # Distribution buckets
    distribution = {"3": 0, "6": 0, "9": 0, "12": 0, "18": 0}
    for iocs in predicted_list:
        nearest = min(distribution.keys(), key=lambda k: abs(int(k) - iocs))
        distribution[nearest] += 1

    # Accuracy stats
    all_responses = db.query(Response).all()
    correct = sum(1 for r in all_responses if r.is_correct)
    accuracy = round(correct / len(all_responses), 4) if all_responses else 0.0

    return AdminSummaryOut(
        total_participants=total,
        avg_predicted_iocs=avg_iocs,
        iocs_distribution=distribution,
        avg_calibration_accuracy=accuracy,
        total_trials=len(all_responses),
    )
