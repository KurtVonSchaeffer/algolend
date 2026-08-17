// creditScoringPipeline.js — orchestrates feature extraction + scoring + persistence
// Called from bankStatementController after successful upload (non-blocking).
// Can also be called directly from the /api/credit-score/analyze endpoint for
// on-demand scoring of an already-stored document.

const { extractFeatures } = require('./creditFeatures');
const { score: computeScore } = require('./creditScoreEngine');
const { supabaseService } = require('../config/supabaseServer');

async function runCreditScoringPipeline({ buffer, mimeType, userId, applicationId, documentId }) {
    if (!buffer || buffer.length === 0) throw new Error('Empty buffer passed to credit scoring pipeline');
    if (!userId) throw new Error('userId is required');

    // 1. Extract feature vector via Gemini
    let features, rawGeminiResponse;
    try {
        features = await extractFeatures(buffer, mimeType);
        rawGeminiResponse = JSON.stringify(features);
    } catch (extractErr) {
        console.error('[credit-scoring] Gemini extraction failed:', extractErr.message);
        throw extractErr;
    }

    // 2. Persist features
    const { data: featureRow, error: featureErr } = await supabaseService
        .from('credit_features')
        .insert({
            user_id:                    userId,
            application_id:             applicationId || null,
            document_id:                documentId || null,
            months_of_data:             features.months_of_data,
            gross_income:               features.gross_income,
            net_income:                 features.net_income,
            avg_monthly_deposits:       features.avg_monthly_deposits,
            min_monthly_deposits:       features.min_monthly_deposits,
            avg_closing_balance:        features.avg_closing_balance,
            min_closing_balance:        features.min_closing_balance,
            existing_debt_installments: features.existing_debt_installments,
            num_lenders:                features.num_lenders,
            dishonored_debits:          features.dishonored_debits,
            salary_regularity:          features.salary_regularity,
            gambling_detected:          features.gambling_detected,
            large_irregular_credits:    features.large_irregular_credits,
            raw_gemini_response:        rawGeminiResponse
        })
        .select('id')
        .single();

    if (featureErr) throw new Error('Failed to save credit features: ' + featureErr.message);

    // 3. Run deterministic scorecard
    const result = computeScore(features);

    // 4. Persist score
    const { data: scoreRow, error: scoreErr } = await supabaseService
        .from('credit_scores')
        .insert({
            user_id:                 userId,
            application_id:          applicationId || null,
            feature_id:              featureRow.id,
            score:                   result.score,
            band:                    result.band,
            recommendation:          result.recommendation,
            adverse_action_codes:    result.adverseActionCodes,
            income_stability_score:  result.subScores.incomeStability,
            debt_ratio_score:        result.subScores.debtRatio,
            balance_behaviour_score: result.subScores.balanceBehaviour,
            credit_behaviour_score:  result.subScores.creditBehaviour,
            lender_load_score:       result.subScores.lenderLoad,
            dti_ratio:               result.dtiRatio,
            available_income:        result.availableIncome,
            model_version:           result.modelVersion
        })
        .select('id')
        .single();

    if (scoreErr) throw new Error('Failed to save credit score: ' + scoreErr.message);

    // 5. Persist automated outcome
    const outcomeMap = { approve: 'approved', review: 'review', decline: 'declined' };
    const { error: outcomeErr } = await supabaseService
        .from('credit_outcomes')
        .insert({
            user_id:             userId,
            application_id:      applicationId || null,
            score_id:            scoreRow.id,
            outcome:             outcomeMap[result.recommendation] || result.recommendation,
            adverse_action_codes: result.adverseActionCodes
        });

    if (outcomeErr) {
        console.warn('[credit-scoring] outcome insert failed (non-fatal):', outcomeErr.message);
    }

    // 6. Stamp application with latest credit score (if applicationId known)
    if (applicationId) {
        await supabaseService
            .from('loan_applications')
            .update({ ai_credit_score: result.score, ai_credit_band: result.band, updated_at: new Date().toISOString() })
            .eq('id', applicationId)
            .then(({ error }) => {
                if (error && !error.message.includes('column')) {
                    console.warn('[credit-scoring] application stamp failed:', error.message);
                }
            });
    }

    console.log(`[credit-scoring] done — userId:${userId} score:${result.score} band:${result.band} rec:${result.recommendation}`);
    return { featureId: featureRow.id, scoreId: scoreRow.id, ...result };
}

module.exports = { runCreditScoringPipeline };
