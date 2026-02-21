
export type Status = 'Pending' | 'Approved' | 'Denied' | 'Flagged';

export interface Claim {
    id: string;
    providerId: string;
    providerName: string;
    beneficiaryId: string;
    beneficiaryName: string;
    serviceDate: string;
    procedureCode: string;
    amount: number;
    status: Status;
    riskScore: number;
    aiReasoning?: string;
    flaggedDate?: string;
}

// ── DRG Clinical Validation Types ────────────────────────────────────

export type DRGValidationStatus =
    | 'Pending'
    | 'Validated'
    | 'Queried'
    | 'Upcoded'
    | 'Downcoded';

export type AdmissionType = 'Emergency' | 'Elective' | 'Urgent' | 'Newborn';

export type DischargeStatus =
    | 'Home'
    | 'SNF'
    | 'LTAC'
    | 'AMA'
    | 'Expired'
    | 'Transferred';

export interface ICD10Code {
    code: string;
    description: string;
    isPrimary: boolean;
    isMCC: boolean;
    isCC: boolean;
}

export type FindingCategory =
    | 'DRG_ASSIGNMENT'
    | 'CC_MCC_VALIDATION'
    | 'CLINICAL_CRITERIA'
    | 'CODING_SEQUENCE'
    | 'UPCODING'
    | 'DOWNCODING';

export type FindingSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

export interface DRGValidationFinding {
    ruleId: string;
    category: FindingCategory;
    severity: FindingSeverity;
    description: string;
    recommendation: string;
    financialImpact?: number;
}

export interface DRGClaim {
    id: string;
    providerId: string;
    providerName: string;
    beneficiaryId: string;
    beneficiaryName: string;

    // Inpatient admission
    admissionDate: string;
    dischargeDate: string;
    admissionType: AdmissionType;
    dischargeStatus: DischargeStatus;
    lengthOfStay: number;
    attendingPhysicianNPI: string;
    attendingPhysicianName: string;
    attendingSpecialty: string;

    // DRG assignment
    assignedDRG: string;
    assignedDRGDescription: string;
    assignedDRGWeight: number;
    msDRGBaseRate: number;
    billedAmount: number;

    // Clinical data
    primaryDiagnosis: ICD10Code;
    secondaryDiagnoses: ICD10Code[];
    principalProcedure?: string;
    clinicalNotes: string;

    // Expected DRG (populated after agent review)
    expectedDRG?: string;
    expectedDRGDescription?: string;
    expectedDRGWeight?: number;
    expectedReimbursement?: number;
    financialVariance?: number;

    // Agent output
    validationStatus: DRGValidationStatus;
    agentFindings?: DRGValidationFinding[];
    agentSummary?: string;
    agentConfidence?: number;
    reviewedAt?: string;
    riskScore: number;
}

// ── Medical Necessity Review Types ───────────────────────────────────

export type MedNecessityStatus =
    | 'Pending'
    | 'Meets Criteria'
    | 'Does Not Meet'
    | 'Observation'
    | 'Queried';

export type RecommendedLevelOfCare =
    | 'Inpatient'
    | 'Observation'
    | 'Outpatient'
    | 'Skilled Nursing'
    | 'Home';

export type MedNecessityFindingCategory =
    | 'SEVERITY_OF_ILLNESS'
    | 'INTENSITY_OF_SERVICE'
    | 'ADMISSION_CRITERIA'
    | 'LEVEL_OF_CARE'
    | 'CONTINUED_STAY'
    | 'DOCUMENTATION_GAP';

export interface MedNecessityFinding {
    ruleId: string;
    category: MedNecessityFindingCategory;
    severity: FindingSeverity;
    description: string;
    recommendation: string;
    financialImpact?: number;
}

export interface MedNecessityCriteria {
    severityOfIllness: 'Met' | 'Not Met' | 'Partially Met';
    intensityOfService: 'Met' | 'Not Met' | 'Partially Met';
    admissionCriteria: 'Met' | 'Not Met' | 'Partially Met';
    continuedStay: 'Justified' | 'Not Justified' | 'Indeterminate';
}

export interface MedNecessityClaim {
    id: string;
    providerId: string;
    providerName: string;
    beneficiaryId: string;
    beneficiaryName: string;

    // Inpatient admission
    admissionDate: string;
    dischargeDate: string;
    admissionType: AdmissionType;
    dischargeStatus: DischargeStatus;
    lengthOfStay: number;
    attendingPhysicianNPI: string;
    attendingPhysicianName: string;
    attendingSpecialty: string;

    // DRG / billing
    assignedDRG: string;
    assignedDRGDescription: string;
    billedAmount: number;

    // Clinical data
    primaryDiagnosis: ICD10Code;
    secondaryDiagnoses: ICD10Code[];
    principalProcedure?: string;
    clinicalNotes: string;

    // Medical necessity-specific clinical indicators
    admissionVitals: {
        bloodPressure: string;
        heartRate: number;
        temperature: number;
        respiratoryRate: number;
        o2Saturation: number;
    };
    admissionLabValues: {
        name: string;
        value: string;
        unit: string;
        abnormal: boolean;
    }[];
    treatmentsProvided: string[];
    ivMedicationsRequired: boolean;
    icuAdmission: boolean;
    surgicalProcedure: boolean;
    telemetryRequired: boolean;
    oxygenRequired: boolean;
    isolationRequired: boolean;

    // Agent output (populated after review)
    medNecessityStatus: MedNecessityStatus;
    recommendedLevelOfCare?: RecommendedLevelOfCare;
    criteriaAssessment?: MedNecessityCriteria;
    medNecessityFindings?: MedNecessityFinding[];
    agentSummary?: string;
    agentConfidence?: number;
    denialRisk?: number;
    estimatedDenialAmount?: number;
    reviewedAt?: string;
    riskScore: number;
}

// ── Readmission Review Types ────────────────────────────────────────

export type ReadmissionReviewStatus =
    | 'Pending'
    | 'Clinically Related'
    | 'Not Related'
    | 'Planned'
    | 'Potentially Preventable'
    | 'Bundle Candidate';

export type ReadmissionFindingCategory =
    | 'CLINICAL_RELATEDNESS'
    | 'DISCHARGE_ADEQUACY'
    | 'TIMING_PATTERN'
    | 'DRG_BUNDLING'
    | 'QUALITY_CONCERN'
    | 'DOCUMENTATION_GAP';

export interface ReadmissionFinding {
    ruleId: string;
    category: ReadmissionFindingCategory;
    severity: FindingSeverity;
    description: string;
    recommendation: string;
    financialImpact?: number;
}

export interface ReadmissionPair {
    id: string;

    // Index (original) admission
    indexClaimId: string;
    indexProviderId: string;
    indexProviderName: string;
    indexBeneficiaryId: string;
    indexBeneficiaryName: string;
    indexAdmissionDate: string;
    indexDischargeDate: string;
    indexAdmissionType: AdmissionType;
    indexDischargeStatus: DischargeStatus;
    indexLengthOfStay: number;
    indexAttendingPhysicianName: string;
    indexAttendingSpecialty: string;
    indexDRG: string;
    indexDRGDescription: string;
    indexBilledAmount: number;
    indexPrimaryDiagnosis: ICD10Code;
    indexSecondaryDiagnoses: ICD10Code[];
    indexClinicalNotes: string;
    indexDischargePlan?: string;

    // Readmission
    readmitClaimId: string;
    readmitProviderId: string;
    readmitProviderName: string;
    readmitAdmissionDate: string;
    readmitDischargeDate: string;
    readmitAdmissionType: AdmissionType;
    readmitDischargeStatus: DischargeStatus;
    readmitLengthOfStay: number;
    readmitAttendingPhysicianName: string;
    readmitAttendingSpecialty: string;
    readmitDRG: string;
    readmitDRGDescription: string;
    readmitBilledAmount: number;
    readmitPrimaryDiagnosis: ICD10Code;
    readmitSecondaryDiagnoses: ICD10Code[];
    readmitClinicalNotes: string;

    // Computed fields
    daysBetween: number;
    sameFacility: boolean;
    sameAttending: boolean;
    combinedBilledAmount: number;

    // HRRP target conditions
    hrrpTargetCondition?: 'AMI' | 'CHF' | 'Pneumonia' | 'COPD' | 'Hip/Knee' | 'CABG';
    isPlannedReadmission: boolean;

    // Agent output (populated after review)
    reviewStatus: ReadmissionReviewStatus;
    clinicalRelatedness?: 'Definitely Related' | 'Likely Related' | 'Possibly Related' | 'Not Related';
    preventabilityScore?: number;
    readmissionFindings?: ReadmissionFinding[];
    agentSummary?: string;
    agentConfidence?: number;
    bundleSavings?: number;
    hrrpPenaltyRisk?: number;
    reviewedAt?: string;
    riskScore: number;
}
