namespace Intex.API;

/// <summary>
/// Relative paths to bundled ML exports under <see cref="Microsoft.AspNetCore.Hosting.IWebHostEnvironment.ContentRootPath"/>.
/// Content is copied on publish via <c>App_Data/ml/**</c> in the project file.
/// </summary>
public static class MlArtifactLayout
{
    public const string Root = "App_Data/ml";

    public const string Reintegration = "App_Data/ml/reintegration";

    public const string Donors = "App_Data/ml/donors";

    public const string Social = "App_Data/ml/social";
}
