// Stand-in for the desktop app's native side: serves the app's "render-heads" message over local
// HTTP using the REAL FaceForge.Core HeadRenderer, so the fit can be benchmarked headless.
// The request parsing mirrors MainWindow.RenderHeadsAsync (Desktop project, WPF, not referenceable).
//   BenchHost <Skyrim Data folder> [port]
using System.Net;
using System.Text.Json;
using FaceForge.Core;

var data = args[0];
var port = args.Length > 1 ? args[1] : "5199";
var catalog = EnvironmentCatalog.Build(data);
var view = catalog.View;
var morphInfo = catalog.Summary.MorphRegistry;
var bsaMorphs = catalog.BsaMorphs;

var listener = new HttpListener();
listener.Prefixes.Add($"http://127.0.0.1:{port}/");
listener.Start();
Console.WriteLine("READY");

double Num(JsonElement item, string name, double fallback) =>
    item.TryGetProperty(name, out var e) && e.TryGetDouble(out var v) ? v : fallback;

while (true)
{
    var context = listener.GetContext();
    string reply;
    try
    {
        using var doc = JsonDocument.Parse(context.Request.InputStream);
        var root = doc.RootElement;
        var male = root.TryGetProperty("sex", out var s) && string.Equals(s.GetString(), "male", StringComparison.OrdinalIgnoreCase);
        var highPoly = root.TryGetProperty("highPoly", out var hp) && hp.ValueKind == JsonValueKind.True;
        var race = root.TryGetProperty("race", out var r) && r.ValueKind == JsonValueKind.String ? r.GetString() : null;
        var size = root.TryGetProperty("size", out var z) && z.TryGetInt32(out var zi) ? Math.Clamp(zi, 128, 768) : 384;
        var items = root.TryGetProperty("requests", out var arr) && arr.ValueKind == JsonValueKind.Array
            ? arr.EnumerateArray().Take(300).ToList() : new List<JsonElement>();
        var images = new (string Id, string? Url)[items.Count];
        Parallel.For(0, items.Count, i =>
        {
            var item = items[i];
            var sliders = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
            if (item.TryGetProperty("sliders", out var so) && so.ValueKind == JsonValueKind.Object)
                foreach (var p in so.EnumerateObject())
                    if (p.Value.TryGetDouble(out var v)) sliders[p.Name] = v;
            var request = new HeadRenderer.RenderRequest(male ? "male" : "female", highPoly, race, sliders,
                Num(item, "yaw", 0), Num(item, "pitch", double.NaN), size,
                item.TryGetProperty("textured", out var t) && t.ValueKind == JsonValueKind.True,
                Num(item, "faceWidthScale", 1.0), Num(item, "faceHeightScale", 1.0),
                Num(item, "noseForward", 0.0), Num(item, "jawRaise", 0.0));
            var png = HeadRenderer.RenderPng(view, morphInfo, request, bsaMorphs);
            var id = item.TryGetProperty("id", out var ide) ? ide.GetString() ?? "" : "";
            images[i] = (id, png is null ? null : "data:image/png;base64," + Convert.ToBase64String(png));
        });
        var requestId = root.TryGetProperty("requestId", out var rid) ? rid.GetString() : null;
        reply = JsonSerializer.Serialize(new
        {
            requestId,
            images = images.Where(x => x.Url is not null).Select(x => new { id = x.Id, dataUrl = x.Url })
        });
    }
    catch (Exception e)
    {
        reply = JsonSerializer.Serialize(new { error = e.Message });
    }
    var bytes = System.Text.Encoding.UTF8.GetBytes(reply);
    context.Response.ContentType = "application/json";
    context.Response.OutputStream.Write(bytes, 0, bytes.Length);
    context.Response.Close();
}
