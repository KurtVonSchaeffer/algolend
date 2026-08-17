// creditScoreEngine.js — deterministic scorecard
// Input:  feature vector from creditFeatures.js
// Output: { score, band, recommendation, adverseActionCodes, subScores, affordability }
//
// Score range: 0–850 (matches Experian CompuSCORE convention so existing credit_score_bands
// rows remain compatible if they are ever populated).

const MODEL_VERSION = '1.0.0';

// ── Sub-score weights ──────────────────────────────────────────────────────────
// Income stability     200 pts
// Debt-service ratio   200 pts
// Balance behaviour    150 pts
// Credit behaviour     150 pts
// Lender load          150 pts
// Total max:           850

function scoreIncomeStability(f) {
    if (f.net_income <= 0 || f.avg_monthly_deposits <= 0) return 0;

    let pts = 0;

    // Salary regularity
    if (f.salary_regularity === 1) {
        pts += 120;
    } else if (f.avg_monthly_deposits > 0) {
        pts += 60;
    }

    // Statement depth
    if      (f.months_of_data >= 3) pts += 50;
    else if (f.months_of_data >= 2) pts += 30;
    else                            pts += 10;

    // Income consistency: min vs avg deposits
    const consistency = f.avg_monthly_deposits > 0
        ? f.min_monthly_deposits / f.avg_monthly_deposits
        : 0;
    if      (consistency >= 0.85) pts += 30;
    else if (consistency >= 0.70) pts += 20;
    else if (consistency >= 0.50) pts += 10;

    return Math.min(200, pts);
}

function scoreDebtRatio(f) {
    if (f.net_income <= 0) return 0;
    const dti = f.existing_debt_installments / f.net_income;

    if      (dti <= 0.20) return 200;
    else if (dti <= 0.30) return 175;
    else if (dti <= 0.40) return 150;
    else if (dti <= 0.50) return 100;
    else if (dti <= 0.60) return  50;
    else                  return   0;
}

function scoreBalanceBehaviour(f) {
    if (f.net_income <= 0) {
        return f.avg_closing_balance > 0 ? 30 : 0;
    }

    let pts = 0;

    // Average closing balance relative to income
    const avgRatio = f.avg_closing_balance / f.net_income;
    if      (avgRatio >= 3.0) pts += 90;
    else if (avgRatio >= 1.0) pts += 70;
    else if (avgRatio >= 0.5) pts += 50;
    else if (avgRatio >= 0.0) pts += 30;
    // negative: 0

    // Minimum balance: buffer against overdraft
    if      (f.min_closing_balance >= f.net_income * 0.5) pts += 60;
    else if (f.min_closing_balance >= 0)                   pts += 35;
    else if (f.min_closing_balance >= -1000)               pts += 10;
    // < -1000: 0

    return Math.min(150, pts);
}

function scoreCreditBehaviour(f) {
    let pts = 150;

    // Dishonored debits
    if      (f.dishonored_debits === 0) pts -= 0;
    else if (f.dishonored_debits === 1) pts -= 50;
    else if (f.dishonored_debits === 2) pts -= 90;
    else                                pts  = 0; // >= 3: zero this component

    if (f.gambling_detected)        pts = Math.max(0, pts - 40);
    if (f.large_irregular_credits)  pts = Math.max(0, pts - 25);

    return Math.max(0, pts);
}

function scoreLenderLoad(f) {
    if      (f.num_lenders === 0) return 150;
    else if (f.num_lenders === 1) return 130;
    else if (f.num_lenders === 2) return 100;
    else if (f.num_lenders === 3) return  60;
    else                          return   0;
}

// ── Hard-decline checks ────────────────────────────────────────────────────────
function hardDeclineCode(f) {
    if (f.net_income <= 0 && f.avg_monthly_deposits <= 0) return 'AA-01';
    if (f.dishonored_debits >= 4)                         return 'AA-04';
    if (f.gambling_detected && f.dishonored_debits >= 2)  return 'AA-05';

    const dti = f.net_income > 0 ? f.existing_debt_installments / f.net_income : 1;
    if (dti > 0.85)                                       return 'AA-02';

    return null;
}

// ── Adverse action codes (for NCA s92 adverse-action disclosure) ───────────────
function buildAdverseActionCodes(f, subScores) {
    const codes = [];
    const dti = f.net_income > 0 ? f.existing_debt_installments / f.net_income : 1;

    if (f.net_income <= 0 || f.avg_monthly_deposits <= 0) codes.push('AA-01'); // No/undetectable income
    if (dti > 0.50)                                        codes.push('AA-02'); // High debt-service ratio
    if (subScores.balanceBehaviour < 50)                   codes.push('AA-03'); // Weak balance history
    if (f.dishonored_debits >= 1)                          codes.push('AA-04'); // Dishonored debits
    if (f.gambling_detected)                               codes.push('AA-05'); // Gambling activity
    if (f.months_of_data < 3)                              codes.push('AA-06'); // < 3 months history
    if (f.num_lenders >= 3)                                codes.push('AA-07'); // Multiple lenders
    if (f.salary_regularity === 0 && f.net_income > 0)    codes.push('AA-08'); // Irregular income
    if (f.large_irregular_credits)                         codes.push('AA-09'); // Irregular large credits

    return codes;
}

// ── Band labels (mirrors typical South African bureau conventions) ─────────────
function scoreToBand(score) {
    if (score >= 767) return 'EXCELLENT';
    if (score >= 681) return 'GOOD';
    if (score >= 614) return 'FAIR';
    if (score >= 583) return 'AVERAGE';
    if (score >= 527) return 'BELOW_AVERAGE';
    return 'POOR';
}

function bandToRecommendation(band, hardDecline) {
    if (hardDecline) return 'decline';
    if (['EXCELLENT', 'GOOD'].includes(band)) return 'approve';
    if (band === 'FAIR')                      return 'review';
    return 'decline';
}

// ── Main export ────────────────────────────────────────────────────────────────
function score(features) {
    const f = features;

    const hardDecline = hardDeclineCode(f);

    const subScores = {
        incomeStability:  scoreIncomeStability(f),
        debtRatio:        scoreDebtRatio(f),
        balanceBehaviour: scoreBalanceBehaviour(f),
        creditBehaviour:  scoreCreditBehaviour(f),
        lenderLoad:       scoreLenderLoad(f)
    };

    const rawScore = hardDecline ? 0 :
        subScores.incomeStability  +
        subScores.debtRatio        +
        subScores.balanceBehaviour +
        subScores.creditBehaviour  +
        subScores.lenderLoad;

    const finalScore = Math.min(850, Math.max(0, Math.round(rawScore)));
    const band       = hardDecline ? 'POOR' : scoreToBand(finalScore);
    const adverseActionCodes = hardDecline
        ? [hardDecline]
        : buildAdverseActionCodes(f, subScores);

    const dti = f.net_income > 0
        ? f.existing_debt_installments / f.net_income
        : null;

    const availableIncome = f.net_income > 0
        ? f.net_income - f.existing_debt_installments
        : 0;

    return {
        score:              finalScore,
        band,
        recommendation:     bandToRecommendation(band, hardDecline),
        adverseActionCodes,
        subScores,
        dtiRatio:           dti !== null ? parseFloat(dti.toFixed(4)) : null,
        availableIncome:    parseFloat(availableIncome.toFixed(2)),
        modelVersion:       MODEL_VERSION
    };
}

module.exports = { score, MODEL_VERSION };
