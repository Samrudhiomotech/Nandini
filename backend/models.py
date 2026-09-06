"""
SQLAlchemy ORM models + Pydantic request/response schemas.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import ClassVar, List, Optional

from pydantic import BaseModel, Field


from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)

from sqlalchemy.orm import relationship

from backend.database import Base

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class TrialPhase(str, enum.Enum):
    CALIBRATION = "calibration"
    VALIDATION = "validation"


# ---------------------------------------------------------------------------
# ORM Tables
# ---------------------------------------------------------------------------


class Participant(Base):
    __tablename__ = "participants"
    __allow_unmapped__ = True

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    session_token = Column(String, unique=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Prediction outputs
    predicted_iocs = Column(Float, nullable=True)
    prediction_confidence = Column(Float, nullable=True)
    validated_iocs = Column(Float, nullable=True)

    trials: ClassVar[List["Trial"]]
    trials = relationship("Trial", back_populates="participant")


class Trial(Base):
    __tablename__ = "trials"
    __allow_unmapped__ = True

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    participant_id = Column(String, ForeignKey("participants.id"), nullable=False)
    phase = Column(Enum(TrialPhase), default=TrialPhase.CALIBRATION)
    choice_set_size = Column(Integer, nullable=False)
    correct_option_index = Column(Integer, nullable=False)
    options_json = Column(Text, nullable=False)  # JSON string of Option dicts
    trial_order = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    participant = relationship("Participant", back_populates="trials")
    response = relationship("Response", back_populates="trial", uselist=False)


class Response(Base):
    __tablename__ = "responses"
    __allow_unmapped__ = True

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    trial_id = Column(String, ForeignKey("trials.id"), nullable=False, unique=True)
    chosen_option_index = Column(Integer, nullable=False)
    response_time_ms = Column(Integer, nullable=False)
    confidence = Column(Integer, nullable=False)        # 1-7
    perceived_difficulty = Column(Integer, nullable=False)  # 1-7
    regret = Column(Integer, nullable=False)            # 1-7
    selection_changes = Column(Integer, default=0)
    is_correct = Column(Boolean, nullable=False)
    dei_score = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    trial = relationship("Trial", back_populates="response")


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------


class ParticipantCreate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None


class ParticipantOut(BaseModel):
    id: str
    name: Optional[str]
    age: Optional[int]
    session_token: str
    created_at: datetime
    predicted_iocs: Optional[float]
    prediction_confidence: Optional[float]
    validated_iocs: Optional[float]

    model_config = {"from_attributes": True}


class OptionSchema(BaseModel):
    index: int
    name: str
    price: int          # USD
    battery_hours: float
    ram_gb: int
    storage_gb: int
    display_inches: float
    utility_score: float  # hidden from participant


class TrialOut(BaseModel):
    id: str
    participant_id: str
    phase: TrialPhase
    choice_set_size: int
    trial_order: int
    options: List[OptionSchema]

    model_config = {"from_attributes": True}


class ResponseCreate(BaseModel):
    chosen_option_index: int
    response_time_ms: int
    confidence: int = Field(..., ge=1, le=7)
    perceived_difficulty: int = Field(..., ge=1, le=7)
    regret: int = Field(..., ge=1, le=7)
    selection_changes: int = Field(0, ge=0)


class ResponseOut(BaseModel):
    id: str
    trial_id: str
    chosen_option_index: int
    response_time_ms: int
    confidence: int
    perceived_difficulty: int
    regret: int
    selection_changes: int
    is_correct: bool
    dei_score: float

    model_config = {"from_attributes": True}


class PredictionOut(BaseModel):
    participant_id: str
    predicted_iocs: float
    confidence: float
    curve_params: dict
    dei_per_size: dict


class ResultsOut(BaseModel):
    participant_id: str
    predicted_iocs: float
    validation_iocs: Optional[float]
    calibration_dei: dict   # {size: avg_dei}
    validation_dei: dict
    improvement_pct: Optional[float]
    message: str


class AdminSummaryOut(BaseModel):
    total_participants: int
    avg_predicted_iocs: Optional[float]
    iocs_distribution: dict   # {size_range: count}
    avg_calibration_accuracy: float
    total_trials: int
