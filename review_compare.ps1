# UTF-8 encoding fix for Japanese Windows
$newRaw = [System.IO.File]::ReadAllText("f:\開発中アプリ\肢別\output\limb_questions_2026-06-03.json", [System.Text.Encoding]::UTF8)
$oldRaw = [System.IO.File]::ReadAllText("f:\開発中アプリ\肢別\output\all_questions.json", [System.Text.Encoding]::UTF8)
$new = $newRaw | ConvertFrom-Json
$old = $oldRaw | ConvertFrom-Json

$hiraganaOrder = @("ア","イ","ウ","エ","オ","カ","キ","ク","ケ","コ")

$out = [System.Collections.Generic.List[string]]::new()
$out.Add("=== Firestore(limb_questions_2026-06-03) vs Local(all_questions.json) ===")
$out.Add("Firestore count: $($new.Count)")
$out.Add("Local    count: $($old.Count)")

$newIds = @($new | Select-Object -ExpandProperty id) | Sort-Object
$oldIds = @($old | Select-Object -ExpandProperty id) | Sort-Object

$onlyNew = @($newIds | Where-Object { $oldIds -notcontains $_ })
$onlyOld = @($oldIds | Where-Object { $newIds -notcontains $_ })
$out.Add("")
$out.Add("Only in Firestore ($($onlyNew.Count)): $($onlyNew -join ', ')")
$out.Add("Only in Local    ($($onlyOld.Count)): $($onlyOld -join ', ')")

# correctCombo diff
$out.Add("")
$out.Add("=== correctCombo diff ===")
$comboDiffCount = 0
foreach ($nq in $new) {
    $oq = $old | Where-Object { $_.id -eq $nq.id }
    if (-not $oq) { continue }
    if ($nq.correctCombo -ne $oq.correctCombo) {
        $out.Add("$($nq.id): Firestore=[$($nq.correctCombo)] Local=[$($oq.correctCombo)]")
        $comboDiffCount++
    }
}
if ($comboDiffCount -eq 0) { $out.Add("(no diff)") }

# --- correctness review on Firestore data ---
$out.Add("")
$out.Add("=== Firestore data: correctness review ===")

# [1] correctCombo missing
$missing = @($new | Where-Object { -not $_.correctCombo -or $_.correctCombo -eq "" })
$out.Add("[1] correctCombo missing ($($missing.Count) questions):")
foreach ($q in $missing) {
    $trueC  = @($q.limbs | Where-Object { $_.correct -eq $true }).Count
    $falseC = @($q.limbs | Where-Object { $_.correct -eq $false }).Count
    $out.Add("  $($q.id) | limbs=$($q.limbs.Count) true=$trueC false=$falseC")
}

# [2] limbs.correct vs correctCombo (hiragana combo type)
$out.Add("")
$out.Add("[2] limbs.correct vs correctCombo (hiragana) inconsistency:")
$inconsistCount = 0
foreach ($q in $new) {
    $combo = $q.correctCombo
    if (-not $combo -or $combo -eq "" -or $combo -match '^\d+$') { continue }
    $isWrong   = $q.questionText -match '誤っているもの|誤りはどれか'
    $isCorrect = $q.questionText -match '正しいもの'
    if (-not $isWrong -and -not $isCorrect) { continue }
    for ($i = 0; $i -lt [Math]::Min($q.limbs.Count, $hiraganaOrder.Count); $i++) {
        $inCombo = $combo -match $hiraganaOrder[$i]
        $actual  = [bool]$q.limbs[$i].correct
        $expected = if ($isWrong -and -not $isCorrect) { -not $inCombo } else { $inCombo }
        if ($expected -ne $actual) {
            $out.Add("  $($q.id) limb[$i]($($hiraganaOrder[$i])): expected=$expected actual=$actual combo=[$combo]")
            $inconsistCount++
        }
    }
}
if ($inconsistCount -eq 0) { $out.Add("  (no inconsistency)") }

# [3] limb count anomaly (non-5 for combo type)
$out.Add("")
$out.Add("[3] Limb count anomaly (combo type but not 5 limbs):")
$anomalyCount = 0
foreach ($q in $new) {
    $combo = $q.correctCombo
    if (-not $combo -or $combo -eq "" -or $combo -match '^\d+$') { continue }
    if ($q.limbs.Count -ne 5) {
        $out.Add("  $($q.id) | limbs=$($q.limbs.Count) | combo=[$combo]")
        $anomalyCount++
    }
}
if ($anomalyCount -eq 0) { $out.Add("  (no anomaly)") }

# Write output
[System.IO.File]::WriteAllLines("f:\開発中アプリ\肢別\review_result.txt", $out, [System.Text.Encoding]::UTF8)
Write-Host "Done -> review_result.txt ($($out.Count) lines)"
