-- +migrate Up
-- Add an optional `reason` to disbursement status history entries, so a
-- rejection (Approver: READY->DRAFT, FinanceOfficer: APPROVED->READY) can carry
-- a mandatory explanation for whoever it bounces back to.
-- +migrate StatementBegin
CREATE OR REPLACE FUNCTION create_disbursement_status_history(time_stamp TIMESTAMP WITH TIME ZONE, disb_status disbursement_status, user_id VARCHAR, reason VARCHAR DEFAULT NULL)
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

-- +migrate Down
-- +migrate StatementBegin
CREATE OR REPLACE FUNCTION create_disbursement_status_history(time_stamp TIMESTAMP WITH TIME ZONE, disb_status disbursement_status, user_id VARCHAR)
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
