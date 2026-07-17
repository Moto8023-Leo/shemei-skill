$w = New-Object -ComObject WScript.Shell
$s = $w.CreateShortcut("C:\\Users\\Public\\Desktop\\Google Chrome.lnk")
Write-Output $s.TargetPath
Write-Output $s.Arguments
