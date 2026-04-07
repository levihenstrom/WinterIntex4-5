namespace Intex.API.Options;

/// <summary>Configuration for the optional Python social ML inference service (FastAPI).</summary>
public sealed class MlInferenceServiceOptions
{
    public const string SectionName = "MlInferenceService";

    /// <summary>Base URL of the FastAPI service, e.g. https://ml.internal:8001 (no trailing slash required).</summary>
    public string BaseUrl { get; set; } = "";

    public int TimeoutSeconds { get; set; } = 60;
}
