namespace Intex.API.Options;

/// <summary>Shared parsing for <see cref="MlInferenceServiceOptions.BaseUrl"/> (HttpClient + readiness checks).</summary>
public static class MlInferenceBaseUrlHelper
{
    /// <summary>Default FastAPI URL for local development when config is otherwise blank.</summary>
    public const string DevelopmentFallbackBaseUrl = "http://127.0.0.1:8001";

    /// <summary>
    /// Builds the base URI used by <see cref="System.Net.Http.HttpClient.BaseAddress"/> (trailing slash, http/https only).
    /// </summary>
    public static bool TryCreateHttpClientBaseUri(string? baseUrl, out Uri? baseUri)
    {
        baseUri = null;
        var trimmed = baseUrl?.Trim();
        if (string.IsNullOrEmpty(trimmed))
            return false;

        var withSlash = trimmed.EndsWith('/') ? trimmed : trimmed + "/";
        if (!Uri.TryCreate(withSlash, UriKind.Absolute, out var uri))
            return false;

        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            return false;

        baseUri = uri;
        return true;
    }
}
