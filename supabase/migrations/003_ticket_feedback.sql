-- Feedback on monitored tickets (used for RL fine-tuning training data)
CREATE TABLE IF NOT EXISTS ticket_feedback (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid UNIQUE NOT NULL REFERENCES support_tickets(ticket_id) ON DELETE CASCADE,
  feedback   text NOT NULL CHECK (feedback IN ('positive', 'negative')),
  note       text,
  updated_at timestamptz DEFAULT now()
);

-- Also add feedback columns directly on support_tickets as a fallback
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS feedback      text,
  ADD COLUMN IF NOT EXISTS feedback_note text,
  ADD COLUMN IF NOT EXISTS feedback_at   timestamptz;
