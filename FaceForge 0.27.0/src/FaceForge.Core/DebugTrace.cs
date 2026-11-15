namespace FaceForge.Core;

/// <summary>
/// Where a fit trace may be written. The folder is cleared at the start of every trace, so the name
/// that picks it must resolve to a direct child of the debug root and nothing else: "..", a rooted
/// path or a nested path would aim that delete at the folder above.
/// </summary>
public static class DebugTrace
{
    public static string? ResolveFolder(string debugRoot, string? baseName)
    {
        if (string.IsNullOrWhiteSpace(baseName)) return null;
        var name = baseName.Trim();
        if (name.Trim('.').Length == 0) return null;
        if (name.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0) return null;
        if (name.EndsWith('.') || name.EndsWith(' ')) return null;

        var root = Path.GetFullPath(debugRoot);
        var folder = Path.GetFullPath(Path.Combine(root, name));
        return string.Equals(Path.GetDirectoryName(folder), root, StringComparison.OrdinalIgnoreCase) &&
               string.Equals(Path.GetFileName(folder), name, StringComparison.OrdinalIgnoreCase)
            ? folder
            : null;
    }
}
