"""
Lightweight checks for local explanation direction rules (logistic coefficient semantics).

Run from ml_pipeline::

    python3 -m ml_pipeline_reintegration_readiness_scorer.explanation_validation
"""

from __future__ import annotations

from .inference_explain import categorical_helps_readiness, numeric_helps_readiness


def run_checks() -> None:
    # Negative coef: higher value hurts readiness — above median => not helping
    assert numeric_helps_readiness(-2.5, True) is False
    # Negative coef: below median => helping
    assert numeric_helps_readiness(-2.5, False) is True

    # Positive coef: higher helps — above median => helping
    assert numeric_helps_readiness(1.5, True) is True
    assert numeric_helps_readiness(1.5, False) is False

    # Zero coef: defined as not helping (excluded from messaging upstream)
    assert numeric_helps_readiness(0.0, True) is False

    # If concern rate were harmful (negative coef), below typical must not be risk (must help)
    assert numeric_helps_readiness(-1.0, False) is True

    # If concern rate were beneficial (positive coef), below typical must not be positive factor
    assert numeric_helps_readiness(1.0, False) is False

    # Categorical: positive coef vs reference => helps
    assert categorical_helps_readiness(0.5) is True
    assert categorical_helps_readiness(-0.5) is False


def main() -> None:
    run_checks()
    print("explanation_validation: all checks passed")


if __name__ == "__main__":
    main()
