namespace Intex.API.Services;

/// <summary>Upstream Python ML inference failure mapped to an HTTP status for API responses.</summary>
public sealed class MlInferenceUpstreamException : Exception
{
    public MlInferenceUpstreamException(int statusCode, string title, string? publicDetail = null, Exception? innerException = null)
        : base(title, innerException)
    {
        StatusCode = statusCode;
        PublicTitle = title;
        PublicDetail = publicDetail;
    }

    public int StatusCode { get; }

    /// <summary>Safe title for <see cref="Microsoft.AspNetCore.Mvc.ProblemDetails.Title"/>.</summary>
    public string PublicTitle { get; }

    /// <summary>Safe detail for clients (no URLs or stack traces).</summary>
    public string? PublicDetail { get; }
}
