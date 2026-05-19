$json = Get-Content -Path '.\output\r3_questions.json' -Raw | ConvertFrom-Json
$r34 = $json | Where-Object { $_.id -eq 'R3-4' }
$q = $r34.questionText

# Split by '調査士：'
$parts = $q -split '調査士：'

Write-Host "Found $($parts.Count - 1) questions"

$questions = @()
for ($i = 1; $i -lt $parts.Count; $i++) {
    $fullPart = $parts[$i]
    # Get question until next newline or end
    $lines = $fullPart -split "`n"
    $qText = $lines[0]
    Write-Host "Q$i: $($qText.Substring(0, [Math]::Min(150, $qText.Length)))..."
    $questions += "調査士：　$qText"
}

Write-Host ""
Write-Host "=== Extracted Questions ===" 
$questions
