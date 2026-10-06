param(
  [Parameter(Mandatory = $true)][string]$Source
)

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class LogoKey {
  static byte[] Read(Bitmap bmp, out int stride) {
    var rect = new Rectangle(0, 0, bmp.Width, bmp.Height);
    var data = bmp.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    stride = data.Stride;
    var bytes = new byte[stride * bmp.Height];
    Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);
    bmp.UnlockBits(data);
    return bytes;
  }

  public static Rectangle Bounds(Bitmap bmp, int maxY, int threshold) {
    int stride;
    var px = Read(bmp, out stride);
    int minX = bmp.Width, minY = bmp.Height, maxX = -1, maxYFound = -1;
    for (int y = 0; y < Math.Min(maxY, bmp.Height); y++) {
      for (int x = 0; x < bmp.Width; x++) {
        int i = y * stride + x * 4;
        int m = Math.Max(px[i], Math.Max(px[i + 1], px[i + 2]));
        if (m < threshold) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxYFound) maxYFound = y;
      }
    }
    return Rectangle.FromLTRB(minX, minY, maxX + 1, maxYFound + 1);
  }

  public static Bitmap Key(Bitmap src, Rectangle crop, int bgR, int bgG, int bgB, int soft, bool white) {
    var cut = src.Clone(crop, PixelFormat.Format32bppArgb);
    int stride;
    var px = Read(cut, out stride);
    int bgMax = Math.Max(bgR, Math.Max(bgG, bgB));
    for (int y = 0; y < cut.Height; y++) {
      for (int x = 0; x < cut.Width; x++) {
        int i = y * stride + x * 4;
        int b = px[i], g = px[i + 1], r = px[i + 2];
        int m = Math.Max(r, Math.Max(g, b));
        double a = Math.Max(0, Math.Min(1, (m - bgMax - 14) / (double)soft));
        if (a <= 0) { px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0; continue; }
        if (white) { px[i] = px[i + 1] = px[i + 2] = 255; }
        else {
          px[i] = (byte)Math.Max(0, Math.Min(255, (b - bgB * (1 - a)) / a));
          px[i + 1] = (byte)Math.Max(0, Math.Min(255, (g - bgG * (1 - a)) / a));
          px[i + 2] = (byte)Math.Max(0, Math.Min(255, (r - bgR * (1 - a)) / a));
        }
        px[i + 3] = (byte)Math.Round(a * 255);
      }
    }
    var rect = new Rectangle(0, 0, cut.Width, cut.Height);
    var data = cut.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
    Marshal.Copy(px, 0, data.Scan0, px.Length);
    cut.UnlockBits(data);
    return cut;
  }
}
"@

$root = Split-Path $PSScriptRoot -Parent
$assets = Join-Path $root "assets"
$png = [System.Drawing.Imaging.ImageFormat]::Png
$ink = [System.Drawing.Color]::FromArgb(255, 16, 20, 16)

$sourceBitmap = New-Object System.Drawing.Bitmap $Source
$bg = $sourceBitmap.GetPixel(12, 12)
$bounds = [LogoKey]::Bounds($sourceBitmap, [int]($sourceBitmap.Height * 0.62), 70)
$pad = 6
$crop = [System.Drawing.Rectangle]::FromLTRB(
  [Math]::Max(0, $bounds.Left - $pad),
  [Math]::Max(0, $bounds.Top - $pad),
  [Math]::Min($sourceBitmap.Width, $bounds.Right + $pad),
  [Math]::Min($sourceBitmap.Height, $bounds.Bottom + $pad)
)
$mark = [LogoKey]::Key($sourceBitmap, $crop, $bg.R, $bg.G, $bg.B, 70, $false)
$markWhite = [LogoKey]::Key($sourceBitmap, $crop, $bg.R, $bg.G, $bg.B, 70, $true)

function Save-Centered($symbol, [int]$size, [double]$scale, $background, [string]$name) {
  $canvas = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  if ($null -eq $background) { $graphics.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0)) } else { $graphics.Clear($background) }
  $box = $size * $scale
  $ratio = [Math]::Min($box / $symbol.Width, $box / $symbol.Height)
  $w = $symbol.Width * $ratio
  $h = $symbol.Height * $ratio
  $graphics.DrawImage($symbol, [single](($size - $w) / 2), [single](($size - $h) / 2), [single]$w, [single]$h)
  $graphics.Dispose()
  $canvas.Save((Join-Path $assets $name), $png)
  $canvas.Dispose()
}

Save-Centered $mark 512 1.0 $null "logo-mark.png"
Save-Centered $mark 1024 0.62 $ink "icon.png"
Save-Centered $mark 1024 0.5 $null "android-icon-foreground.png"
Save-Centered $markWhite 1024 0.5 $null "android-icon-monochrome.png"
Save-Centered $mark 1024 0.42 $null "splash-icon.png"
Save-Centered $mark 48 0.7 $ink "favicon.png"

$background = New-Object System.Drawing.Bitmap 1024, 1024
$bgGraphics = [System.Drawing.Graphics]::FromImage($background)
$bgGraphics.Clear($ink)
$bgGraphics.Dispose()
$background.Save((Join-Path $assets "android-icon-background.png"), $png)
$background.Dispose()

$mark.Dispose()
$markWhite.Dispose()
$sourceBitmap.Dispose()
Write-Output "crop $($crop.X),$($crop.Y) $($crop.Width)x$($crop.Height) bg $($bg.R),$($bg.G),$($bg.B)"
