CREATE INDEX IF NOT EXISTS job_runs_job_name_started_at_idx
ON job_runs(job_name, started_at DESC);
