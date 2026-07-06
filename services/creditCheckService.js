// Credit Check Service - Experian Integration
const axios = require('axios');
const xml2js = require('xml2js');
const AdmZip = require('adm-zip');

// Experian API Configuration — credentials MUST be set as env vars, not in source
const COMPANY_ORIGIN = process.env.COMPANY_NAME || 'YourCompany';

if (!process.env.EXPERIAN_USERNAME || !process.env.EXPERIAN_PASSWORD) {
    console.warn('[creditCheckService] EXPERIAN_USERNAME / EXPERIAN_PASSWORD not set in env — credit checks will fail');
}

const EXPERIAN_CONFIG = {
    url: process.env.EXPERIAN_API_URL || 'https://apis.experian.co.za/NormalSearchService',
    username: process.env.EXPERIAN_USERNAME || '',
    password: process.env.EXPERIAN_PASSWORD || '',
    version: '1.0',
    origin: COMPANY_ORIGIN,
    origin_version: '0.0.1',
    testMode: process.env.EXPERIAN_TEST_MODE === 'true'
};

/**
 * Build SOAP XML request for Experian credit check
 */
function buildCreditCheckXML(userData) {
    const {
        identity_number,
        surname,
        forename,
        forename2 = '',
        forename3 = '',
        gender,
        date_of_birth, // Format: YYYYMMDD
        address1,
        address2 = '',
        address3 = '',
        address4 = '',
        postal_code,
        home_tel_code = '',
        home_tel_no = '',
        work_tel_code = '',
        work_tel_no = '',
        cell_tel_no = '',
        client_ref,
        passport_flag = 'N'
    } = userData;

    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://webServices/">
   <soapenv:Header/>
   <soapenv:Body>
      <web:DoNormalEnquiry>
         <request>
            <pUsrnme>${EXPERIAN_CONFIG.username}</pUsrnme>
            <pPasswrd>${EXPERIAN_CONFIG.password}</pPasswrd>
            <pVersion>${EXPERIAN_CONFIG.version}</pVersion>
            <pOrigin>${EXPERIAN_CONFIG.origin}</pOrigin>
            <pOrigin_Version>${EXPERIAN_CONFIG.origin_version}</pOrigin_Version>
            <pInput_Format>XML</pInput_Format>
            <pTransaction>
<![CDATA[
<Transactions>
<Search_Criteria>
<CS_Data>Y</CS_Data>
<CPA_Plus_NLR_Data>Y</CPA_Plus_NLR_Data>
<Deeds_Data>N</Deeds_Data>
<Directors_Data>N</Directors_Data>
<Identity_number>${identity_number}</Identity_number>
<Surname>${surname}</Surname>
<Forename>${forename}</Forename>
<Forename2>${forename2}</Forename2>
<Forename3>${forename3}</Forename3>
<Gender>${gender}</Gender>
<Passport_flag>${passport_flag}</Passport_flag>
<DateOfBirth>${date_of_birth}</DateOfBirth>
<Address1>${address1}</Address1>
<Address2>${address2}</Address2>
<Address3>${address3}</Address3>
<Address4>${address4}</Address4>
<PostalCode>${postal_code}</PostalCode>
<HomeTelCode>${home_tel_code}</HomeTelCode>
<HomeTelNo>${home_tel_no}</HomeTelNo>
<WorkTelCode>${work_tel_code}</WorkTelCode>
<WorkTelNo>${work_tel_no}</WorkTelNo>
<CellTelNo>${cell_tel_no}</CellTelNo>
<ResultType>XPDF2</ResultType>
<RunCodix>N</RunCodix>
<CodixParams>
<PARAMS>
<PARAM_NAME></PARAM_NAME>
<PARAM_VALUE></PARAM_VALUE>
</PARAMS>
</CodixParams>
<PinPointParams>
<PARAMS>
<PARAM_NAME></PARAM_NAME>
<PARAM_VALUE></PARAM_VALUE>
</PARAMS>
</PinPointParams>
<Adrs_Mandatory>Y</Adrs_Mandatory>
<Enq_Purpose>12</Enq_Purpose>
<Run_CompuScore>Y</Run_CompuScore>
<ClientConsent>Y</ClientConsent>
<ClientRef>${client_ref}</ClientRef>
</Search_Criteria>
</Transactions>]]></pTransaction>
         </request>
      </web:DoNormalEnquiry>
   </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Parse Experian SOAP response and extract retdata
 */
async function parseExperianResponse(soapResponse) {
    const parser = new xml2js.Parser({ explicitArray: false });
    
    try {
        const result = await parser.parseStringPromise(soapResponse);
        
        // Navigate through SOAP envelope to find retdata
        // Handle different namespace prefixes (soapenv: or S:)
        const envelope = result['soapenv:Envelope'] || result['S:Envelope'] || result['Envelope'];
        if (!envelope) {
            throw new Error('No SOAP envelope found in response');
        }
        
        const body = envelope['soapenv:Body'] || envelope['S:Body'] || envelope['Body'];
        if (!body) {
            throw new Error('No SOAP body found in response');
        }
        
        const response = body['ns2:DoNormalEnquiryResponse'] || 
                        body['web:DoNormalEnquiryResponse'] || 
                        body['DoNormalEnquiryResponse'];
        
        if (!response) {
            throw new Error('No DoNormalEnquiryResponse found in response');
        }
        
        const transReply = response['TransReplyClass'] || response['return'];
        const retdata = transReply?.retData || transReply?.retdata;
        
        if (!retdata) {
            throw new Error('No retdata found in response');
        }
        
        return retdata;
    } catch (error) {
        console.error('Error parsing Experian response:', error);
        throw error;
    }
}

/**
 * Decode base64 retdata and extract PDF/XML from ZIP
 */
async function decodeReportAssets(retdata) {
    try {
        // Decode base64 to buffer
        const decodedData = Buffer.from(retdata, 'base64');

        // Extract ZIP contents
        const zip = new AdmZip(decodedData);
        const zipEntries = zip.getEntries();
        
        let pdfBuffer = null;
        let pdfFilename = null;
        let xmlContent = null;
        let xmlFilename = null;
        
        console.log(`📦 ZIP contains ${zipEntries.length} files`);
        
        for (const entry of zipEntries) {
            console.log(`  - ${entry.entryName}`);
            
            if (entry.entryName.endsWith('.pdf')) {
                pdfBuffer = entry.getData();
                pdfFilename = entry.entryName;
                console.log('✅ PDF extracted in-memory');
            } else if (entry.entryName.endsWith('.xml')) {
                xmlContent = entry.getData().toString('utf-8');
                xmlFilename = entry.entryName;
                console.log('✅ XML extracted in-memory');
            }
        }
        
        return {
            pdfBuffer,
            pdfFilename,
            xmlContent,
            xmlFilename,
            success: true
        };
    } catch (error) {
        console.error('Error decoding/extracting ZIP:', error);
        throw error;
    }
}

/**
 * Extract comprehensive credit data from XML response
 */
async function extractCreditScore(xmlData) {
    const parser = new xml2js.Parser({ explicitArray: false });
    
    try {
        const result = await parser.parseStringPromise(xmlData);
        const root = result?.ROOT;
        
        if (!root) {
            console.error('No ROOT element found in XML');
            return null;
        }
        
        // 1. CompuSCORE - Primary Credit Score
        const compuScore = root.EnqCC_CompuSCORE?.ROW || {};
        
        // 2. Identity Verification
        const identity = root.EnqCC_DMATCHES?.ROW || {};
        
        // 3. Activity Summary
        const activities = root.EnqCC_ACTIVITIES?.ROW || {};
        
        // 4. Statistics (Adverse Events by Time Period)
        const stats = root.EnqCC_STATS?.ROW || {};
        
        // 5. Enquiry Counts
        const enqCounts = root.EnqCC_ENQ_COUNTS?.ROW || {};
        
        // 6. Search Criteria (What was submitted)
        const searchCriteria = root.EnqCC_SRCHCRITERIA?.ROW || {};
        
        // 7. NLR Summary (National Loans Register)
        const nlrSummary = root.EnqCC_NLR_SUMMARY?.Summary || {};
        const nlr12 = nlrSummary.NLR_Past_12_Months || {};
        const nlr24 = nlrSummary.NLR_Past_24_Months || {};
        const cca12 = nlrSummary.CCA_Past_12_Months || {};
        
        // 8. Previous Enquiries (convert array or single object to array)
        let previousEnquiries = [];
        if (root.EnqCC_PREVENQ?.ROW) {
            previousEnquiries = Array.isArray(root.EnqCC_PREVENQ.ROW) 
                ? root.EnqCC_PREVENQ.ROW 
                : [root.EnqCC_PREVENQ.ROW];
        }
        
        return {
            // Basic Score Info
            score: parseInt(compuScore.SCORE) || 0,
            riskType: compuScore.RISK_TYPE || 'UNKNOWN',
            thinFileIndicator: compuScore.THIN_FILE_INDICATOR || 'N',
            version: compuScore.VERSION || '',
            scoreType: compuScore.SCORE_TYPE || '',
            
            // Reference Numbers
            enquiryId: root.Enquiry_ID || '',
            clientRef: root.Client_Ref || '',
            
            // Identity Verification
            identity: {
                idNumber: identity.ID_NUMBER || '',
                name: identity.NAME || '',
                surname: identity.SURNAME || '',
                status: identity.STATUS || 'Unknown',
                deceasedDate: identity.DECEASED_DATE || null,
                countryCode: identity.COUNTRY_CODE || ''
            },
            
            // Activity Summary
            activities: {
                enquiries: parseInt(activities.ENQUIRIES) || 0,
                loans: parseInt(activities.LOANS) || 0,
                judgements: parseInt(activities.JUDGEMENTS) || 0,
                notices: parseInt(activities.NOTICES) || 0,
                collections: parseInt(activities.COLLECTIONS) || 0,
                adminOrders: parseInt(activities.ADMINORDERS) || 0,
                balance: parseInt(activities.BALANCE) || 0,
                installment: parseInt(activities.INSTALLMENT) || 0
            },
            
            // Statistics - Adverse Events Over Time
            adverseStats: {
                judgements12M: parseInt(stats.CC_JUDGE_12_CNT) || 0,
                judgements24M: parseInt(stats.CC_JUDGE_24_CNT) || 0,
                judgements36M: parseInt(stats.CC_JUDGE_36_CNT) || 0,
                notices12M: parseInt(stats.CC_NOTICE_12_CNT) || 0,
                notices24M: parseInt(stats.CC_NOTICE_24_CNT) || 0,
                notices36M: parseInt(stats.CC_NOTICE_36_CNT) || 0,
                adverse12M: parseInt(stats.CC_ADVERSE_12_CNT) || 0,
                adverse24M: parseInt(stats.CC_ADVERSE_24_CNT) || 0,
                adverse36M: parseInt(stats.CC_ADVERSE_36_CNT) || 0,
                adverseTotal: parseInt(stats.CC_ADVERSE_TOT) || 0
            },
            
            // Enquiry Counts by Type
            enquiryCounts: {
                addresses: parseInt(enqCounts.ADDR) || 0,
                adminOrders: parseInt(enqCounts.ADMORDS) || 0,
                collections: parseInt(enqCounts.COLLECTIONS) || 0,
                directMatches: parseInt(enqCounts.DMATCHES) || 0,
                judgements: parseInt(enqCounts.JUDGE) || 0,
                notices: parseInt(enqCounts.NOTICES) || 0,
                possibleMatches: parseInt(enqCounts.PMATCHES) || 0,
                previousEnquiries: parseInt(enqCounts.PREV_ENQ) || 0,
                telephoneNumbers: parseInt(enqCounts.TPHONE) || 0,
                employers: parseInt(enqCounts.EMPLOYERS) || 0,
                fraudAlerts: parseInt(enqCounts.FRAUDALERT) || 0
            },
            
            // NLR (National Loans Register) Data
            nlr: {
                past12Months: {
                    enquiriesByClient: parseInt(nlr12.Enquiries_by_client) || 0,
                    enquiriesByOthers: parseInt(nlr12.Enquiries_by_other) || 0,
                    positiveLoans: parseInt(nlr12.Positive_loans) || 0,
                    highestMonthsArrears: parseInt(nlr12.Highest_months_in_arrears) || 0
                },
                past24Months: {
                    enquiriesByClient: parseInt(nlr24.Enquiries_by_client) || 0,
                    enquiriesByOthers: parseInt(nlr24.Enquiries_by_other) || 0,
                    positiveLoans: parseInt(nlr24.Positive_loans) || 0,
                    highestMonthsArrears: parseInt(nlr24.Highest_months_in_arrears) || 0
                },
                worstMonthsArrears: parseInt(nlrSummary.NLR_WorstMonthsArrears) || 0,
                activeAccounts: parseInt(nlrSummary.NLR_ActiveAccounts) || 0,
                balanceExposure: parseInt(nlrSummary.NLR_BalanceExposure) || 0,
                monthlyInstallment: parseInt(nlrSummary.NLR_MonthlyInstallment) || 0,
                cumulativeArrears: parseInt(nlrSummary.NLR_CumulativeArrears) || 0,
                closedAccounts: parseInt(nlrSummary.NLR_ClosedAccounts) || 0
            },
            
            // CCA (Credit Consumers Act) Data
            cca: {
                past12Months: {
                    enquiriesByClient: parseInt(cca12.Enquiries_by_client) || 0,
                    enquiriesByOthers: parseInt(cca12.Enquiries_by_other) || 0,
                    positiveLoans: parseInt(cca12.Positive_loans) || 0,
                    highestMonthsArrears: parseInt(cca12.Highest_months_in_arrears) || 0
                },
                worstMonthsArrears: parseInt(nlrSummary.CCA_WorstMonthsArrears) || 0,
                activeAccounts: parseInt(nlrSummary.CCA_ActiveAccounts) || 0,
                balanceExposure: parseInt(nlrSummary.CCA_BalanceExposure) || 0,
                monthlyInstallment: parseInt(nlrSummary.CCA_MonthlyInstallment) || 0,
                cumulativeArrears: parseInt(nlrSummary.CCA_CumulativeArrears) || 0,
                closedAccounts: parseInt(nlrSummary.CCA_ClosedAccounts) || 0
            },
            
            // Account Type Summaries
            accountSummary: {
                adverseAccounts: parseInt(nlrSummary.AdverseAccounts) || 0,
                revolvingAccounts: parseInt(nlrSummary.RevolvingAccounts) || 0,
                instalmentAccounts: parseInt(nlrSummary.InstalmentAccounts) || 0,
                openAccounts: parseInt(nlrSummary.OpenAccounts) || 0,
                highestJudgement: parseInt(nlrSummary.HighestJudgement) || 0
            },
            
            // Previous Credit Enquiries (last 5 only to avoid too much data)
            previousEnquiries: previousEnquiries.slice(0, 5).map(enq => ({
                date: enq.ENQUIRY_DATE || '',
                branch: enq.BRANCH_NAME || '',
                contactPerson: enq.CONTACT_PERSON || '',
                telephone: enq.TELEPHONE_NUMBER || ''
            })),
            
            // Search Criteria (for verification)
            searchInfo: {
                idNumber: searchCriteria.CRIT_IDNUMBER || '',
                name: searchCriteria.CRIT_NAME || '',
                surname: searchCriteria.CRIT_SURNAME || '',
                dob: searchCriteria.DOB || '',
                gender: searchCriteria.GENDER || '',
                address: searchCriteria.ADDRESS || '',
                enquiryPurpose: searchCriteria.ENQUIRY_PURPOSE || '',
                loanAmount: parseInt(searchCriteria.LOAN_AMOUNT) || 0,
                netIncome: parseInt(searchCriteria.NET_INCOME) || 0
            },
            
            // Legacy fields for backward compatibility
            totalEnquiries: parseInt(activities.ENQUIRIES) || 0,
            totalLoans: parseInt(activities.LOANS) || 0,
            totalJudgements: parseInt(activities.JUDGEMENTS) || 0,
            totalCollections: parseInt(activities.COLLECTIONS) || 0
        };
        
    } catch (error) {
        console.error('Error extracting credit score:', error);
        return null;
    }
}

/**
 * Return a realistic mock credit result when EXPERIAN_TEST_MODE=true.
 * Nothing is sent to Experian — no enquiry is logged on the person's record.
 */
function buildDemoCreditScore(userData, applicationId) {
    const idNumber = userData.identity_number || '';
    // Vary the score deterministically by ID so the same person always gets the same result
    const seed = idNumber.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const score = 580 + (seed % 200); // 580–779

    return {
        score,
        riskType: score >= 700 ? 'LOW' : score >= 600 ? 'MEDIUM' : 'HIGH',
        thinFileIndicator: 'N',
        version: 'DEMO',
        scoreType: 'CompuSCORE',
        enquiryId: `DEMO-${Date.now()}`,
        clientRef: String(applicationId),
        identity: {
            idNumber,
            name: userData.forename || 'DEMO',
            surname: userData.surname || 'USER',
            status: 'Active',
            deceasedDate: null,
            countryCode: 'ZA'
        },
        activities: { enquiries: 2, loans: 3, judgements: 0, notices: 0, collections: 0, adminOrders: 0, balance: 15000, installment: 800 },
        adverseStats: { judgements12M: 0, judgements24M: 0, judgements36M: 0, notices12M: 0, notices24M: 0, notices36M: 0, adverse12M: 0, adverse24M: 0, adverse36M: 0, adverseTotal: 0 },
        enquiryCounts: { addresses: 1, adminOrders: 0, collections: 0, directMatches: 1, judgements: 0, notices: 0, possibleMatches: 0, previousEnquiries: 2, telephoneNumbers: 1, employers: 1, fraudAlerts: 0 },
        nlr: { past12Months: { enquiriesByClient: 1, enquiriesByOthers: 1, positiveLoans: 2, highestMonthsArrears: 0 }, past24Months: { enquiriesByClient: 2, enquiriesByOthers: 2, positiveLoans: 3, highestMonthsArrears: 0 }, worstMonthsArrears: 0, activeAccounts: 1, balanceExposure: 15000, monthlyInstallment: 800, cumulativeArrears: 0, closedAccounts: 2 },
        cca: { past12Months: { enquiriesByClient: 0, enquiriesByOthers: 1, positiveLoans: 1, highestMonthsArrears: 0 }, worstMonthsArrears: 0, activeAccounts: 0, balanceExposure: 0, monthlyInstallment: 0, cumulativeArrears: 0, closedAccounts: 1 },
        accountSummary: { adverseAccounts: 0, revolvingAccounts: 1, instalmentAccounts: 2, openAccounts: 1, highestJudgement: 0 },
        previousEnquiries: [{ date: '20260101', branch: 'DEMO LENDER', contactPerson: 'DEMO', telephone: '0100000000' }],
        searchInfo: { idNumber, name: userData.forename || '', surname: userData.surname || '', dob: userData.date_of_birth || '', gender: userData.gender || '', address: userData.address1 || '', enquiryPurpose: '12', loanAmount: 0, netIncome: 0 },
        totalEnquiries: 2, totalLoans: 3, totalJudgements: 0, totalCollections: 0
    };
}

/**
 * Main function: Perform credit check
 */
async function performCreditCheck(userData, applicationId, authToken = null) {
    // ── DEMO MODE — no live API call, no bureau enquiry logged ──────────────
    if (EXPERIAN_CONFIG.testMode) {
        console.log('⚠️  [DEMO MODE] Returning mock credit score — Experian NOT called');
        const creditScore = buildDemoCreditScore(userData, applicationId);
        const savedRecord = await saveCreditCheckToDatabase(
            creditScore, userData.user_id, applicationId,
            '<ROOT><DEMO>true</DEMO></ROOT>', authToken
        );
        return {
            success: true,
            creditScore,
            zipData: null,
            databaseId: savedRecord.id,
            recommendation: savedRecord.recommendation,
            riskFlags: savedRecord.risk_flags,
            message: 'DEMO MODE — mock credit check, no live bureau enquiry'
        };
    }
    // ────────────────────────────────────────────────────────────────────────

    try {
        console.log('🔍 Starting credit check for application:', applicationId);
        console.log('🔧 Experian endpoint:', EXPERIAN_CONFIG.url);
        
        // Build SOAP XML request
        const soapRequest = buildCreditCheckXML({
            ...userData,
            client_ref: applicationId.toString()
        });
        
        console.log('📤 Sending request to Experian...');
        console.log('📋 SOAP Request:', soapRequest);
        
        // Send SOAP request to Experian
        const response = await axios.post(EXPERIAN_CONFIG.url, soapRequest, {
            headers: {
                'Content-Type': 'text/xml;charset=UTF-8',
                'SOAPAction': 'DoNormalEnquiry'
            },
            timeout: 30000 // 30 second timeout
        });
        
        console.log('📥 Received response from Experian');
        console.log('📋 SOAP Response Status:', response.status);
        console.log('📋 SOAP Response Headers:', JSON.stringify(response.headers, null, 2));
        console.log('📋 SOAP Response Body:', response.data);
        
        // Parse response and extract retdata
        const retdata = await parseExperianResponse(response.data);
        console.log('📋 Extracted retdata (first 200 chars):', retdata.substring(0, 200));
        
        // Decode and extract ZIP contents
        const { pdfBuffer, pdfFilename, xmlContent } = await decodeReportAssets(retdata);
        console.log('💾 Credit report assets extracted:', { pdfFilename });
        
        // Display the extracted XML
        if (xmlContent) {
            console.log('\n');
            console.log('========================================');
            console.log('📄 DECODED XML FROM ZIP:');
            console.log('========================================');
            console.log(xmlContent);
            console.log('========================================');
            console.log('\n');
            
            // Extract credit score from XML
            const creditScore = await extractCreditScore(xmlContent);
            console.log('📊 Extracted Credit Score:', creditScore);
            
            // Save to database (pass auth token if available)
            const savedRecord = await saveCreditCheckToDatabase(
                creditScore, 
                userData.user_id, 
                applicationId, 
                xmlContent,
                authToken
            );
            
            return {
                success: true,
                creditScore,
                zipData: retdata, // Include ZIP data as base64 for download
                databaseId: savedRecord.id,
                recommendation: savedRecord.recommendation,
                riskFlags: savedRecord.risk_flags,
                message: 'Credit check completed successfully'
            };
        } else {
            throw new Error('No XML content found in ZIP');
        }
        
    } catch (error) {
        console.error('❌ Credit check failed:', error);
        console.error('Error details:', {
            code: error.code,
            message: error.message,
            response: error.response?.data,
            stack: error.stack
        });
        
        return {
            success: false,
            error: error.message,
            errorCode: error.code,
            message: 'Credit check failed'
        };
    }
}

/**
 * Save credit check results to database
 */
async function saveCreditCheckToDatabase(creditScoreData, userId, applicationId, xmlContent, authToken = null) {
    // Use the server-side supabase client with service role key (bypasses RLS)
    const { supabaseStorage } = require('../config/supabaseServer');
    const supabase = supabaseStorage; // This uses service role key
    
    try {
        console.log('💾 Saving credit check to database...');
        
        const { data, error } = await supabase
            .from('credit_checks')
            .insert({
                user_id: userId,
                application_id: applicationId,
                
                // Report info
                report_reference: creditScoreData.enquiryId,
                report_date: new Date(),
                bureau_name: 'Experian',
                
                // Personal info
                first_name: creditScoreData.identity.name,
                last_name: creditScoreData.identity.surname,
                id_number: creditScoreData.identity.idNumber,
                
                // Credit score
                credit_score: creditScoreData.score,
                score_band: creditScoreData.riskType,
                risk_category: calculateRiskCategory(creditScoreData.score),
                
                // Account summary
                total_accounts: creditScoreData.activities.loans || 0,
                open_accounts: creditScoreData.nlr.activeAccounts + creditScoreData.cca.activeAccounts,
                closed_accounts: creditScoreData.nlr.closedAccounts + creditScoreData.cca.closedAccounts,
                total_balance: creditScoreData.nlr.balanceExposure + creditScoreData.cca.balanceExposure,
                total_monthly_payment: creditScoreData.nlr.monthlyInstallment + creditScoreData.cca.monthlyInstallment,
                total_arrears_amount: creditScoreData.nlr.cumulativeArrears + creditScoreData.cca.cumulativeArrears,
                
                // Payment behavior
                accounts_in_good_standing: (creditScoreData.nlr.activeAccounts + creditScoreData.cca.activeAccounts) - creditScoreData.accountSummary.adverseAccounts,
                accounts_with_arrears: creditScoreData.accountSummary.adverseAccounts,
                accounts_in_default: 0, // Not directly available in XML
                
                // Enquiries
                total_enquiries: creditScoreData.activities.enquiries,
                enquiries_last_3_months: 0, // Not directly available
                enquiries_last_6_months: 0, // Not directly available
                enquiries_last_12_months: creditScoreData.nlr.past12Months.enquiriesByOthers + creditScoreData.cca.past12Months.enquiriesByOthers,
                
                // Judgments
                total_judgments: creditScoreData.activities.judgements,
                total_judgment_amount: creditScoreData.accountSummary.highestJudgement,
                
                // Raw data
                raw_xml_data: xmlContent,
                parsed_accounts: creditScoreData,
                parsed_enquiries: creditScoreData.previousEnquiries,
                
                // Risk assessment
                risk_flags: identifyRiskFlags(creditScoreData),
                recommendation: calculateRecommendation(creditScoreData),
                recommendation_reason: getRecommendationReason(creditScoreData),
                
                status: 'completed',
                checked_at: new Date(),
                // NCR compliance reference — proves bureau enquiry was done (required by NCR)
                ncr_reference:   `NCR-${Date.now()}-${String(applicationId).slice(0,8).toUpperCase()}`,
                reported_to_ncr: true,
                reported_at:     new Date()
            })
            .select()
            .single();
        
        if (error) {
            console.error('❌ Database save error:', error);
            throw error;
        }
        
        console.log('✅ Credit check saved to database:', data.id);
        return data;
        
    } catch (error) {
        console.error('❌ Failed to save credit check:', error);
        throw error;
    }
}

/**
 * Calculate risk category from score
 */
function calculateRiskCategory(score) {
    if (score >= 700) return 'Low Risk';
    if (score >= 600) return 'Medium Risk';
    if (score >= 500) return 'High Risk';
    return 'Very High Risk';
}

/**
 * Identify risk flags
 */
function identifyRiskFlags(creditData) {
    const flags = [];
    
    if (creditData.score < 500) flags.push('Very Low Credit Score');
    if (creditData.score >= 500 && creditData.score < 600) flags.push('Low Credit Score');
    if (creditData.activities.judgements > 0) flags.push(`${creditData.activities.judgements} Judgment(s)`);
    if (creditData.nlr.cumulativeArrears > 5000) flags.push(`High NLR Arrears (R${creditData.nlr.cumulativeArrears})`);
    if (creditData.cca.cumulativeArrears > 5000) flags.push(`High CCA Arrears (R${creditData.cca.cumulativeArrears})`);
    if (creditData.accountSummary.adverseAccounts > 0) flags.push(`${creditData.accountSummary.adverseAccounts} Adverse Account(s)`);
    if (creditData.nlr.past12Months.enquiriesByOthers > 3) flags.push('Multiple Recent Credit Enquiries');
    
    return flags;
}

/**
 * Calculate recommendation
 */
function calculateRecommendation(creditData) {
    const score = creditData.score || 0;
    const judgements = creditData.activities.judgements || 0;
    const arrears = (creditData.nlr.cumulativeArrears || 0) + (creditData.cca.cumulativeArrears || 0);
    const adverseAccounts = creditData.accountSummary.adverseAccounts || 0;
    
    // Decline criteria
    if (score < 500) return 'decline';
    if (judgements > 0) return 'decline';
    if (adverseAccounts > 2) return 'decline';
    if (arrears > 10000) return 'decline';
    
    // Review criteria
    if (score < 600) return 'review';
    if (arrears > 5000) return 'review';
    if (adverseAccounts > 0) return 'review';
    if (creditData.nlr.past12Months.enquiriesByOthers > 3) return 'review';
    
    // Approve
    return 'approve';
}

/**
 * Get recommendation reason
 */
function getRecommendationReason(creditData) {
    const recommendation = calculateRecommendation(creditData);
    const flags = identifyRiskFlags(creditData);
    
    if (recommendation === 'approve') {
        return `Good credit profile: Score ${creditData.score}, ${creditData.nlr.activeAccounts + creditData.cca.activeAccounts} active accounts, no major adverse events.`;
    }
    
    if (recommendation === 'decline') {
        return `High risk profile: ${flags.join(', ')}`;
    }
    
    return `Manual review required: ${flags.join(', ')}`;
}

module.exports = {
    performCreditCheck,
    buildCreditCheckXML,
    parseExperianResponse,
    decodeReportAssets,
    extractCreditScore,
    saveCreditCheckToDatabase
};
