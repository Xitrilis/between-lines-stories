Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap 256,256
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = 'AntiAlias'
$graphics.Clear([System.Drawing.Color]::Transparent)
$blue = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#0073E6'))
$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$light = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#A7D7FF'))
$shape = New-Object System.Drawing.Drawing2D.GraphicsPath
$shape.AddArc(8,8,80,80,180,90)
$shape.AddArc(168,8,80,80,270,90)
$shape.AddArc(168,168,80,80,0,90)
$shape.AddArc(8,168,80,80,90,90)
$shape.CloseFigure()
$graphics.FillPath($blue,$shape)
$graphics.FillEllipse($white,51,53,154,132)
$graphics.FillPolygon($white,[System.Drawing.Point[]]@([System.Drawing.Point]::new(58,148),[System.Drawing.Point]::new(49,205),[System.Drawing.Point]::new(107,174)))
$graphics.FillEllipse($blue,65,67,126,104)
$graphics.FillEllipse($white,89,112,12,12)
$graphics.FillEllipse($white,122,112,12,12)
$graphics.FillEllipse($white,155,112,12,12)
$graphics.FillEllipse($white,190,185,48,48)
$graphics.FillEllipse($light,197,192,34,34)
New-Item -ItemType Directory -Path 'build' -Force | Out-Null
$bitmap.Save((Join-Path (Get-Location) 'build\icon.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$png = [System.IO.File]::ReadAllBytes((Join-Path (Get-Location) 'build\icon.png'))
$stream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter $stream
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
$writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
$writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$png.Length); $writer.Write([uint32]22)
$writer.Write($png)
[System.IO.File]::WriteAllBytes((Join-Path (Get-Location) 'build\icon.ico'),$stream.ToArray())
$writer.Dispose(); $stream.Dispose(); $graphics.Dispose(); $bitmap.Dispose(); $blue.Dispose(); $white.Dispose(); $light.Dispose(); $shape.Dispose()
