"""Pydantic request/response models."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

GoalLiteral = Literal["donations", "awareness", "mixed"]

FIXED_INPUT_KEYS = frozenset(
    {
        "content_topic",
        "platform",
        "post_type",
        "media_type",
        "has_call_to_action",
        "call_to_action_type",
        "features_resident_story",
        "post_hour",
        "caption_length",
        "num_hashtags",
        "mentions_count",
        "month",
        "day_of_week",
        "is_boosted",
        "boost_budget_php",
        "follower_count_at_post",
        "sentiment_tone",
    }
)


class FixedInputs(BaseModel):
    """Optional constraints for the search grid (null / omitted = explore)."""

    content_topic: str | None = None
    platform: str | None = None
    post_type: str | None = None
    media_type: str | None = None
    has_call_to_action: bool | None = None
    call_to_action_type: str | None = None
    features_resident_story: bool | None = None
    post_hour: int | None = None

    model_config = {"extra": "allow"}

    @field_validator("has_call_to_action", "features_resident_story", mode="before")
    @classmethod
    def _coerce_binary_fixed(cls, v: Any) -> bool | None:
        if v is None:
            return None
        if isinstance(v, bool):
            return v
        if isinstance(v, (int, float)):
            if v in (0, 0.0):
                return False
            if v in (1, 1.0):
                return True
            raise ValueError("Expected 0 or 1 for numeric boolean field")
        raise ValueError("Expected boolean or 0/1")


class RecommendRequest(BaseModel):
    goal: GoalLiteral
    fixed_inputs: FixedInputs = Field(default_factory=FixedInputs)
    top_k: int = Field(default=3, ge=1, le=50)


class RecommendationItem(BaseModel):
    platform: str
    post_type: str
    media_type: str
    post_hour: int
    content_topic: str
    has_call_to_action: bool
    call_to_action_type: str
    features_resident_story: bool
    predicted_engagement_rate: float
    predicted_p_any_referral: float
    predicted_referrals_count: float | None = None
    ranking_score: float
    goal: str
    why_recommended: str


class RecommendResponse(BaseModel):
    goal: str
    top_k: int
    recommendations: list[RecommendationItem]


class PredictRequest(BaseModel):
    """Full or partial feature dict; merged with training template then derived fields applied."""

    features: dict[str, Any]

    @field_validator("features")
    @classmethod
    def non_empty(cls, v: dict[str, Any]) -> dict[str, Any]:
        if not v:
            raise ValueError("features must not be empty")
        return v


class PredictResponse(BaseModel):
    predicted_engagement_rate: float
    predicted_p_any_referral: float
    predicted_referrals_count: float | None = None
    predicted_estimated_donation_value_php: float | None = None


class SocialOptionsResponse(BaseModel):
    supported_goals: list[str]
    goal_weights: dict[str, dict[str, float]]
    candidate_dimension_fallbacks: dict[str, list[Any]]
    numeric_features: list[str]
    categorical_features: list[str]
    artifacts_loaded: bool = True


class HealthResponse(BaseModel):
    status: str
    service: str
    models_loaded: bool
