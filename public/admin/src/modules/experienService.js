// src/services/experianService.js

import { supabase } from './supabaseClient.js';

/**
 * Simulates a call to the Experian API to get a credit score.
 * In a real application, this would be a secure backend function that makes a SOAP/REST call.
 * @param {string} userId - The UUID of the user.
 * @param {string} idNumber - The user's ID number (used for the API call).
 * @returns {Promise<{credit_score: number, max_loan_amount: number}>}
 */
export async function performCreditCheck(userId, idNumber) {
    if (!userId || !idNumber) {
        throw new Error("User ID and ID Number are required for a credit check.");
    }
    
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 1500));

    // --- SIMULATED EXPERIAN RESPONSE ---
    // Using the range defined in the Experian document [cite: 19]
    const credit_score = Math.floor(Math.random() * (710 - 480 + 1)) + 480;

    // --- SIMULATED MAX LOAN CALCULATION ---
    // A simple formula to determine max loan amount based on score
    const max_loan_amount = credit_score * 125.50; 
    
    // Update the user's profile in the database with the new data
    const { data, error } = await supabase
        .from('profiles')
        .update({
            credit_score: credit_score,
            max_loan_amount: max_loan_amount.toFixed(2),
            id_number: idNumber // Also storing the ID number for reference
        })
        .eq('id', userId)
        .select()
        .single();
    
    if (error) {
        console.error("Error updating profile with credit score:", error);
        throw new Error("Could not save your credit score. Please try again.");
    }

    return {
        credit_score: data.credit_score,
        max_loan_amount: data.max_loan_amount,
    };
}
