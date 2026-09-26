Add-Type -AssemblyName System.Drawing

function Fill-Capsule($graphics, $brush, [single]$x, [single]$y, [single]$w, [single]$h) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $h
  $path.AddArc($x, $y, $d, $d, 90, 180)
  $path.AddArc(($x + $w - $d), $y, $d, $d, 270, 180)
  $path.CloseFigure()
  $graphics.FillPath($brush, $path)
  $path.Dispose()
}

function Draw-Bars($graphics, $color, [int]$canvas) {
  $brush = New-Object System.Drawing.SolidBrush $color
  $height = [single]($canvas * 0.062)
  $gap = [single]($canvas * 0.034)
  $widths = @(
    [single]($canvas * 0.26),
    [single]($canvas * 0.42),
    [single]($canvas * 0.58)
  )
  $total = ($height * 3) + ($gap * 2)
  $y = [single](($canvas - $total) / 2)
  foreach ($width in $widths) {
    $x = [single](($canvas - $width) / 2)
    Fill-Capsule $graphics $brush $x $y $width $height
    $y += $height + $gap
  }
  $brush.Dispose()
}

function New-Canvas([int]$size, $background) {
  $format = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  $bitmap = New-Object System.Drawing.Bitmap $size, $size, $format
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  if ($null -eq $background) {
    $graphics.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
  } else {
    $graphics.Clear($background)
  }
  return @{ Bitmap = $bitmap; Graphics = $graphics }
}

$ink = [System.Drawing.Color]::FromArgb(255, 16, 20, 16)
$lime = [System.Drawing.Color]::FromArgb(255, 214, 242, 92)
$white = [System.Drawing.Color]::FromArgb(255, 243, 246, 241)
$root = Split-Path $PSScriptRoot -Parent
$assets = Join-Path $root "assets"
$png = [System.Drawing.Imaging.ImageFormat]::Png

$icon = New-Canvas 1024 $ink
Draw-Bars $icon.Graphics $lime 1024
$icon.Graphics.Dispose()
$icon.Bitmap.Save((Join-Path $assets "icon.png"), $png)

$background = New-Canvas 1024 $ink
$background.Graphics.Dispose()
$background.Bitmap.Save((Join-Path $assets "android-icon-background.png"), $png)

$foreground = New-Canvas 1024 $null
Draw-Bars $foreground.Graphics $lime 1024
$foreground.Graphics.Dispose()
$foreground.Bitmap.Save((Join-Path $assets "android-icon-foreground.png"), $png)

$mono = New-Canvas 1024 $null
Draw-Bars $mono.Graphics $white 1024
$mono.Graphics.Dispose()
$mono.Bitmap.Save((Join-Path $assets "android-icon-monochrome.png"), $png)

$splash = New-Canvas 1024 $null
Draw-Bars $splash.Graphics $lime 1024
$splash.Graphics.Dispose()
$splash.Bitmap.Save((Join-Path $assets "splash-icon.png"), $png)

$favicon = New-Object System.Drawing.Bitmap 48, 48
$faviconGraphics = [System.Drawing.Graphics]::FromImage($favicon)
$faviconGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$faviconGraphics.DrawImage($icon.Bitmap, 0, 0, 48, 48)
$faviconGraphics.Dispose()
$favicon.Save((Join-Path $assets "favicon.png"), $png)

$icon.Bitmap.Dispose()
$background.Bitmap.Dispose()
$foreground.Bitmap.Dispose()
$mono.Bitmap.Dispose()
$splash.Bitmap.Dispose()
$favicon.Dispose()
