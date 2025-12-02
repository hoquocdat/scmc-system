-- AI Usage Logs table for tracking token usage and costs
CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- User who made the request
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

    -- Request details
    action VARCHAR(100) NOT NULL,  -- e.g., 'generate_tasks', 'chat', etc.
    model VARCHAR(100) NOT NULL,   -- e.g., 'gpt-4o-mini', 'gpt-4', etc.

    -- Token usage
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,

    -- Cost tracking (in USD, stored as decimal for precision)
    estimated_cost DECIMAL(10, 6) DEFAULT 0,

    -- Request/Response metadata
    request_payload JSONB,         -- Store the input for debugging
    response_summary TEXT,         -- Brief summary of the response

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'success',  -- 'success', 'error', 'timeout'
    error_message TEXT,

    -- Timing
    duration_ms INTEGER,           -- How long the request took

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_logs_action ON ai_usage_logs(action);
CREATE INDEX idx_ai_usage_logs_created_at ON ai_usage_logs(created_at);
CREATE INDEX idx_ai_usage_logs_model ON ai_usage_logs(model);

-- Comments for documentation
COMMENT ON TABLE ai_usage_logs IS 'Tracks AI API usage for cost monitoring and analytics';
COMMENT ON COLUMN ai_usage_logs.action IS 'The type of AI action performed (e.g., generate_tasks)';
COMMENT ON COLUMN ai_usage_logs.estimated_cost IS 'Estimated cost in USD based on token pricing';
