using System.Collections.Concurrent;

namespace Intex.API.Services;

public sealed class RefreshTokenStore
{
    private readonly ConcurrentDictionary<string, (string UserId, DateTime Expiry)> tokens = new();

    public string Create(string userId, TimeSpan lifetime)
    {
        PurgeExpired();

        var token = GenerateToken();
        tokens[token] = (userId, DateTime.UtcNow.Add(lifetime));
        return token;
    }

    public bool TryConsume(string token, out string? userId)
    {
        PurgeExpired();
        userId = null;

        if (!tokens.TryRemove(token, out var entry))
            return false;

        if (DateTime.UtcNow > entry.Expiry)
            return false;

        userId = entry.UserId;
        return true;
    }

    public bool TryGetValidUserId(string token, out string? userId)
    {
        PurgeExpired();
        userId = null;

        if (!tokens.TryGetValue(token, out var entry))
            return false;

        if (DateTime.UtcNow > entry.Expiry)
        {
            tokens.TryRemove(token, out _);
            return false;
        }

        userId = entry.UserId;
        return true;
    }

    public void Remove(string token)
    {
        if (!string.IsNullOrWhiteSpace(token))
            tokens.TryRemove(token, out _);
    }

    private static string GenerateToken()
    {
        return Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32))
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }

    private void PurgeExpired()
    {
        var now = DateTime.UtcNow;
        foreach (var key in tokens.Keys)
        {
            if (tokens.TryGetValue(key, out var entry) && now > entry.Expiry)
                tokens.TryRemove(key, out _);
        }
    }
}
