$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$logoPath = Join-Path $projectRoot 'assets\favicon.png'
$logo = [System.Drawing.Image]::FromFile($logoPath)
try {
    foreach ($size in @(192, 512)) {
        $bitmap = New-Object System.Drawing.Bitmap($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $backgroundPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        try {
            $graphics.Clear([System.Drawing.Color]::Transparent)
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
            $diameter = [single]($size * 0.40)
            $edge = [single]($size - 1)
            $farCorner = [single]($edge - $diameter)
            $backgroundPath.AddArc(0, 0, $diameter, $diameter, 180, 90)
            $backgroundPath.AddArc($farCorner, 0, $diameter, $diameter, 270, 90)
            $backgroundPath.AddArc($farCorner, $farCorner, $diameter, $diameter, 0, 90)
            $backgroundPath.AddArc(0, $farCorner, $diameter, $diameter, 90, 90)
            $backgroundPath.CloseFigure()
            $graphics.FillPath([System.Drawing.Brushes]::White, $backgroundPath)
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $inset = [int][Math]::Round($size * 0.10)
            $graphics.DrawImage($logo, $inset, $inset, $size - 2 * $inset, $size - 2 * $inset)
            $outputPath = Join-Path $projectRoot "assets\app-icon-rounded-$size.png"
            $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $backgroundPath.Dispose()
            $graphics.Dispose()
            $bitmap.Dispose()
        }
    }
} finally {
    $logo.Dispose()
}
