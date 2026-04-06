namespace Intex.API.Contracts;

/// <summary>Shared query limits for paginated list endpoints.</summary>
public static class Pagination
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    public static (int page, int pageSize) Normalize(int page, int pageSize)
    {
        var p = page < 1 ? 1 : page;
        var size = pageSize < 1 ? DefaultPageSize : pageSize;
        if (size > MaxPageSize)
            size = MaxPageSize;
        return (p, size);
    }
}
