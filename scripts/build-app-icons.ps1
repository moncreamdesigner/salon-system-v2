$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$logoPath = Join-Path $projectRoot 'assets\favicon.png'
$logo = [System.Drawing.Image]::FromFile($logoPath)
try {
    foreach ($size in @(192, 512)) {
        $bitmap = New-Object System.Drawing.Bitmap($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.Clear([System.Drawing.Color]::White)
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $inset = [int][Math]::Round($size * 0.10)
            $graphics.DrawImage($logo, $inset, $inset, $size - 2 * $inset, $size - 2 * $inset)
            $outputPath = Join-Path $projectRoot "assets\app-icon-$size.png"
            $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $graphics.Dispose()
            $bitmap.Dispose()
        }
    }
} finally {
    $logo.Dispose()
}
