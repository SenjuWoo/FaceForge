using System.Text.RegularExpressions;

namespace FaceForge.Core;

/// <summary>
/// Housekeeping for the unpacked interface under <c>%LOCALAPPDATA%\FaceForge\Web\&lt;version&gt;\&lt;hash&gt;</c>.
/// Each build unpacks its own copy (about 50 MB) and earlier releases never removed the previous ones.
/// </summary>
public static partial class WebBundleCache
{
    [GeneratedRegex(@"^\d+\.\d+\.\d+$")]
    private static partial Regex VersionName();

    [GeneratedRegex(@"^\.?[0-9A-Fa-f]{16}(-[0-9a-fA-F]{32})?$")]
    private static partial Regex BuildName();

    /// <summary>
    /// Removes copies the running build can never use: every build folder of an older version, other
    /// builds of the current version, and half-finished unpacks. Keeps the current copy, newer versions
    /// (another, newer FaceForge may be installed beside this one) and any name it does not recognise.
    /// Best effort: a folder another running FaceForge still holds open is skipped, never forced, and a
    /// reparse point is never followed. Returns how many folders were removed.
    /// </summary>
    public static int PruneStale(string webRoot, string currentVersion, string currentHash)
    {
        if (!Directory.Exists(webRoot) || !Version.TryParse(currentVersion, out var current)) return 0;
        var removed = 0;
        foreach (var versionDir in SafeDirectories(webRoot))
        {
            var name = Path.GetFileName(versionDir);
            if (!VersionName().IsMatch(name) || !Version.TryParse(name, out var version)) continue;
            if (version > current) continue;
            var isCurrent = version == current;
            foreach (var buildDir in SafeDirectories(versionDir))
            {
                var build = Path.GetFileName(buildDir);
                if (!BuildName().IsMatch(build)) continue;
                if (isCurrent && build.Equals(currentHash, StringComparison.OrdinalIgnoreCase)) continue;
                if (TryDelete(buildDir)) removed++;
            }
            // An older version folder that is now empty goes too; anything left in it is not ours.
            if (!isCurrent && !Directory.EnumerateFileSystemEntries(versionDir).Any())
                TryDelete(versionDir);
        }
        return removed;
    }

    private static IEnumerable<string> SafeDirectories(string parent)
    {
        try
        {
            return Directory.EnumerateDirectories(parent)
                .Where(path => !new DirectoryInfo(path).Attributes.HasFlag(FileAttributes.ReparsePoint))
                .ToList();
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            return [];
        }
    }

    private static bool TryDelete(string path)
    {
        try
        {
            Directory.Delete(path, recursive: true);
            return true;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            return false;
        }
    }
}
