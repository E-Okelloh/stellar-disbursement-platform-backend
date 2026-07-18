-- +migrate Up
-- Add an optional `reason` to disbursement status history entries, so a
-- rejection (Approver: READY->DRAFT, FinanceOfficer: APPROVED->READY) can carry
-- a mandatory explanation for whoever it bounces back to.
--
-- Note: CREATE OR REPLACE does NOT replace a function when the parameter list
-- changes arity — it creates a second overload instead, which then makes any
-- 3-arg call ambiguous ("is not unique") since both overloads can satisfy it.
-- The old 3-arg signature must be dropped explicitly first. CASCADE is required
-- because the disbursements.status_history column default depends on it; the
-- default is restored below using the new 4-arg function.
DROP FUNCTION IF EXISTS create_disbursement_status_history(TIMESTAMP WITH TIME ZONE, disbursement_status, VARCHAR) CASCADE;

-- +migrate StatementBegin
CREATE FUNCTION create_disbursement_status_history(time_stamp TIMESTAMP WITH TIME ZONE, disb_status disbursement_status, user_id VARCHAR, reason VARCHAR DEFAULT NULL)
RETURNS jsonb AS $$
	BEGIN
	    RETURN json_build_object(
            'timestamp', time_stamp,
            'status', disb_status,
            'user_id', user_id,
            'reason', reason
        );
	END;
$$ LANGUAGE plpgsql;
-- +migrate StatementEnd

ALTER TABLE disbursements
    ALTER COLUMN status_history SET DEFAULT ARRAY[create_disbursement_status_history(NOW(), disbursement_status('DRAFT'), NULL)];

-- +migrate Down
DROP FUNCTION IF EXISTS create_disbursement_status_history(TIMESTAMP WITH TIME ZONE, disbursement_status, VARCHAR, VARCHAR) CASCADE;

-- +migrate StatementBegin
CREATE FUNCTION create_disbursement_status_history(time_stamp TIMESTAMP WITH TIME ZONE, disb_status disbursement_status, user_id VARCHAR)
RETURNS jsonb AS $$
	BEGIN
	    RETURN json_build_object(
            'timestamp', time_stamp,
            'status', disb_status,
            'user_id', user_id
        );
	END;
$$ LANGUAGE plpgsql;
-- +migrate StatementEnd

ALTER TABLE disbursements
    ALTER COLUMN status_history SET DEFAULT ARRAY[create_disbursement_status_history(NOW(), disbursement_status('DRAFT'), NULL)];
