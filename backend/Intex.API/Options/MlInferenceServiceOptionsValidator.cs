using Microsoft.Extensions.Options;

namespace Intex.API.Options;

public sealed class MlInferenceServiceOptionsValidator : IValidateOptions<MlInferenceServiceOptions>
{
    public ValidateOptionsResult Validate(string? name, MlInferenceServiceOptions options)
    {
        if (options.TimeoutSeconds < 1 || options.TimeoutSeconds > 300)
        {
            return ValidateOptionsResult.Fail(
                $"{MlInferenceServiceOptions.SectionName}:{nameof(MlInferenceServiceOptions.TimeoutSeconds)} must be between 1 and 300.");
        }

        if (!string.IsNullOrWhiteSpace(options.BaseUrl))
        {
            if (!Uri.TryCreate(options.BaseUrl.Trim(), UriKind.Absolute, out var uri)
                || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                return ValidateOptionsResult.Fail(
                    $"{MlInferenceServiceOptions.SectionName}:{nameof(MlInferenceServiceOptions.BaseUrl)} must be an absolute http or https URL when set.");
            }
        }

        if (!string.IsNullOrWhiteSpace(options.ApiKey)
            && string.IsNullOrWhiteSpace(options.ApiKeyHeaderName))
        {
            return ValidateOptionsResult.Fail(
                $"{MlInferenceServiceOptions.SectionName}:{nameof(MlInferenceServiceOptions.ApiKeyHeaderName)} is required when ApiKey is set.");
        }

        return ValidateOptionsResult.Success;
    }
}
