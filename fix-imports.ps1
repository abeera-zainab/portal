# Fix all @ imports to relative paths

$files = Get-ChildItem -Path "src" -Include "*.tsx","*.ts" -Recurse

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $relativePath = $file.DirectoryName.Replace((Get-Location).Path + "\src\", "").Replace("\", "/")
    $depth = ($relativePath -split "/").Count
    
    if ($depth -eq 0) { $prefix = "./" }
    else { $prefix = "../" * $depth }
    
    # Replace @ imports
    $content = $content -replace 'from [''"]@/', "from '$prefix"
    $content = $content -replace 'import\s+([^''"]+ from\s+)''@/', "import `$1'$prefix"
    $content = $content -replace 'import\s+([^''"]+ from\s+)""@/', "import `$1""$prefix"
    
    Set-Content $file.FullName -Value $content -NoNewline
}

Write-Host "All @ imports have been converted to relative paths!"
