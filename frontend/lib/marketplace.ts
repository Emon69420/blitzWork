export type AppUser = {
  id: string;
  wallet_address: string;
  role: string | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  services_offered: string | null;
  avatar_url: string | null;
  country: string | null;
  skills: string[] | null;
  hourly_rate_display: number | null;
  is_employer: boolean;
  is_freelancer: boolean;
  reputation_score: number | null;
  created_at: string;
  updated_at: string;
};

export type JobListing = {
  id: string;
  employer_user_id: string;
  title: string;
  description: string;
  category: string | null;
  skills_required: string[] | null;
  budget_type: string;
  budget_min: number | null;
  budget_max: number | null;
  rate_per_second_mon: number | null;
  deposit_target_mon: number | null;
  status: string;
  visibility: string;
  selected_application_id: string | null;
  escrow_job_id: number | null;
  escrow_contract_address: string | null;
  created_at: string;
  updated_at: string;
};

export type JobApplication = {
  id: string;
  job_id: string;
  freelancer_user_id: string;
  cover_letter: string;
  proposed_terms: string | null;
  proposed_rate_mon: number | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Engagement = {
  id: string;
  job_id: string;
  employer_user_id: string;
  freelancer_user_id: string;
  application_id: string;
  escrow_job_id: number | null;
  escrow_contract_address: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DisputeRecord = {
  id: string;
  engagement_id: string | null;
  job_id: string | null;
  escrow_job_id: number;
  raised_by_user_id: string | null;
  raised_by_role: string | null;
  status: string;
  summary: string | null;
  freelancer_claim: string | null;
  employer_claim: string | null;
  freelancer_evidence_submitted: boolean;
  employer_evidence_submitted: boolean;
  open_for_jury: boolean;
  expires_at: string | null;
  finalized_at: string | null;
  final_freelancer_percent: number | null;
  final_employer_percent: number | null;
  final_reasoning: string | null;
  resolution_tx_hash: string | null;
  created_at: string;
  updated_at: string;
};

export type DisputeEvidence = {
  id: string;
  dispute_id: string;
  submitted_by_user_id: string | null;
  side: "employer" | "freelancer";
  evidence_type: "text" | "image" | "link" | "file";
  content_text: string | null;
  file_url: string | null;
  created_at: string;
};

export type Juror = {
  id: string;
  user_id: string;
  wallet_address: string;
  is_active: boolean;
  expertise_tags: string[] | null;
  reputation_score: number | null;
  cases_served: number;
  last_selected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DisputeJuror = {
  id: string;
  dispute_id: string;
  juror_user_id: string;
  status: string;
  assigned_at: string;
  responded_at: string | null;
};

export type JurorVote = {
  id: string;
  dispute_id: string;
  juror_user_id: string;
  freelancer_percent: number;
  employer_percent: number;
  reasoning: string | null;
  submitted_at: string;
};

export type EmployerJobWithApplications = JobListing & {
  applications: Array<
    JobApplication & {
      freelancer: AppUser | null;
      freelancer_profile: Profile | null;
    }
  >;
};

export function normalizeWalletAddress(address: string) {
  return address.trim().toLowerCase();
}

export function parseSkills(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
