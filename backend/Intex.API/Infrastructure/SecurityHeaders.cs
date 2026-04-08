namespace Intex.API.Infrastructure;

public static class SecurityHeaders
{
    public const string ContentSecurityPolicy =
        "default-src 'self'; " +
        "base-uri 'self'; " +
        "frame-ancestors 'none'; " +
        "object-src 'none'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
        "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net; " +
        "frame-src 'self' https://givebutter.com; " +
        "img-src 'self' data: https: https://givebutter.com; " +
        "connect-src 'self' https://givebutter.com";

    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app)
    {
        var environment = app.ApplicationServices.GetRequiredService<IWebHostEnvironment>();
        return app.Use(async (context, next) =>
        {
            context.Response.OnStarting(() =>
            {
                if (!(environment.IsDevelopment() &&
                      (context.Request.Path.StartsWithSegments("/swagger")
                       || context.Request.Path.StartsWithSegments("/scalar"))))
                {
                    context.Response.Headers["Content-Security-Policy"] = ContentSecurityPolicy;
                    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
                    context.Response.Headers["X-Frame-Options"] = "DENY";
                    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
                }
                return Task.CompletedTask;
            });
            await next();
        });
    }
}
