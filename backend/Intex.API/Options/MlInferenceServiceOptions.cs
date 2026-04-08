namespace Intex.API.Options;

/// <summary>Configuration for the optional Python social ML inference service (FastAPI).</summary>
public sealed class MlInferenceServiceOptions
{
    public const string SectionName = "MlInferenceService";

    /// <summary>Base URL of the FastAPI service, e.g. https://ml.internal:8001 (no trailing slash required).</summary>
    public string BaseUrl { get; set; } = "";

    /// <summary>HTTP client timeout for ML calls (seconds). Clamped to 1–300 when applied to <see cref="System.Net.Http.HttpClient"/>.</summary>
    public int TimeoutSeconds { get; set; } = 60;

    /// <summary>Optional shared secret sent to FastAPI when non-empty.</summary>
    public string ApiKey { get; set; } = "";

    /// <summary>Header name for <see cref="ApiKey"/> (default when key is set: X-ML-Service-Key).</summary>
    public string ApiKeyHeaderName { get; set; } = "X-ML-Service-Key";
}
