using System.Reflection;

namespace FaceForge.Core;

/// <summary>
/// The product version, read from this assembly's informational version (set from the csproj, which
/// build.ps1 checks against VERSION.txt). Code that states the version uses this instead of a literal,
/// so a release bump cannot leave an old number in an export or a request header.
/// </summary>
public static class AppVersion
{
    public static string Current { get; } = Read();

    private static string Read()
    {
        var informational = typeof(AppVersion).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        // The SDK may append "+<commit>" source metadata; the product version is what precedes it.
        var version = informational?.Split('+')[0].Trim();
        return string.IsNullOrEmpty(version)
            ? typeof(AppVersion).Assembly.GetName().Version?.ToString(3) ?? "0.0.0"
            : version;
    }
}
