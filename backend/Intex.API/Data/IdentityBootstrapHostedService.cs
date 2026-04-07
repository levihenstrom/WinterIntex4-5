using Microsoft.AspNetCore.Identity;

namespace Intex.API.Data;

public class IdentityBootstrapHostedService(
    IServiceProvider serviceProvider,
    ILogger<IdentityBootstrapHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var attemptsRemaining = 5;

        while (!stoppingToken.IsCancellationRequested && attemptsRemaining-- > 0)
        {
            try
            {
                using var scope = serviceProvider.CreateScope();
                await AuthIdentityGenerator.GenerateDefaultIdentityAsync(
                    scope.ServiceProvider,
                    scope.ServiceProvider.GetRequiredService<IConfiguration>());

                logger.LogInformation("Identity bootstrap completed successfully.");
                return;
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning(
                    ex,
                    "Identity bootstrap attempt failed. Attempts remaining: {AttemptsRemaining}",
                    attemptsRemaining);

                if (attemptsRemaining <= 0)
                    return;

                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
        }
    }
}
