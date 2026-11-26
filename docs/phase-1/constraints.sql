-- =============================================================================
-- Hand-written migration (Phase 2): constraints Prisma cannot express.
-- Applied right after the Prisma-generated init migration.
-- Each rule here gets an integration test against a real PostgreSQL instance.
-- =============================================================================

-- ---------------------------------------------------------------- guests
ALTER TABLE guests ADD CONSTRAINT guests_has_name
  CHECK (coalesce(btrim(name_en), '') <> '' OR coalesce(btrim(name_kh), '') <> '');

ALTER TABLE guest_groups ADD CONSTRAINT guest_groups_has_name
  CHECK (coalesce(btrim(name_en), '') <> '' OR coalesce(btrim(name_kh), '') <> '');

-- Primary contact must be a member of the group.
CREATE OR REPLACE FUNCTION check_group_primary_contact() RETURNS trigger AS $$
BEGIN
  IF NEW.primary_contact_guest_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM guests g WHERE g.id = NEW.primary_contact_guest_id AND g.group_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'primary contact must belong to group' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_group_primary_contact
  BEFORE INSERT OR UPDATE OF primary_contact_guest_id ON guest_groups
  FOR EACH ROW EXECUTE FUNCTION check_group_primary_contact();

-- ------------------------------------------------------------ invitations
-- Owner XOR.
ALTER TABLE invitations ADD CONSTRAINT invitations_owner_xor CHECK (
  (type = 'INDIVIDUAL' AND guest_id IS NOT NULL AND group_id IS NULL) OR
  (type = 'FAMILY'     AND group_id IS NOT NULL AND guest_id IS NULL)
);

ALTER TABLE invitations ADD CONSTRAINT invitations_capacity_positive CHECK (capacity >= 1);

-- At most one non-revoked invitation per guest / per group.
CREATE UNIQUE INDEX invitations_one_live_per_guest
  ON invitations (guest_id) WHERE guest_id IS NOT NULL AND status <> 'REVOKED';
CREATE UNIQUE INDEX invitations_one_live_per_group
  ON invitations (group_id) WHERE group_id IS NOT NULL AND status <> 'REVOKED';

-- One ACTIVE token per invitation (rotation = mark old ROTATED + insert new, in one tx).
CREATE UNIQUE INDEX invitation_tokens_one_active
  ON invitation_tokens (invitation_id) WHERE status = 'ACTIVE';

-- ------------------------------------------------------------------- rsvp
ALTER TABLE rsvps ADD CONSTRAINT rsvps_counts_nonneg
  CHECK (unnamed_guests >= 0 AND attending_count >= 0);

-- Declined => nobody attending.
ALTER TABLE rsvps ADD CONSTRAINT rsvps_declined_zero
  CHECK (status <> 'DECLINED' OR attending_count = 0);

-- Capacity enforced at DB level as defense in depth (service also locks the
-- invitation row with SELECT ... FOR UPDATE before writing).
CREATE OR REPLACE FUNCTION check_rsvp_capacity() RETURNS trigger AS $$
DECLARE cap int; allow_unnamed boolean;
BEGIN
  SELECT capacity, allow_unnamed_guests INTO cap, allow_unnamed
    FROM invitations WHERE id = NEW.invitation_id;
  IF NEW.attending_count > cap THEN
    RAISE EXCEPTION 'rsvp exceeds invitation capacity' USING ERRCODE = '23514';
  END IF;
  IF NEW.unnamed_guests > 0 AND NOT allow_unnamed THEN
    RAISE EXCEPTION 'unnamed guests not allowed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rsvp_capacity
  BEFORE INSERT OR UPDATE ON rsvps
  FOR EACH ROW EXECUTE FUNCTION check_rsvp_capacity();

-- Participant must belong to the invitation owner.
CREATE OR REPLACE FUNCTION check_rsvp_guest_membership() RETURNS trigger AS $$
DECLARE inv invitations%ROWTYPE;
BEGIN
  SELECT i.* INTO inv FROM invitations i JOIN rsvps r ON r.invitation_id = i.id WHERE r.id = NEW.rsvp_id;
  IF inv.type = 'INDIVIDUAL' AND NEW.guest_id <> inv.guest_id THEN
    RAISE EXCEPTION 'participant not on invitation' USING ERRCODE = '23514';
  ELSIF inv.type = 'FAMILY' AND NOT EXISTS (
    SELECT 1 FROM guests g WHERE g.id = NEW.guest_id AND g.group_id = inv.group_id
  ) THEN
    RAISE EXCEPTION 'participant not in invitation group' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rsvp_guest_membership
  BEFORE INSERT OR UPDATE ON rsvp_guests
  FOR EACH ROW EXECUTE FUNCTION check_rsvp_guest_membership();

-- ------------------------------------------------------------------ wishes
ALTER TABLE wishes ADD CONSTRAINT wishes_lengths CHECK (
  char_length(author_name) BETWEEN 1 AND 80
  AND char_length(message) BETWEEN 1 AND 1000
  AND (relationship IS NULL OR char_length(relationship) <= 80)
);

-- ------------------------------------------------------------------- gifts
ALTER TABLE gifts ADD CONSTRAINT gifts_amounts_positive CHECK (
  (notified_amount IS NULL OR notified_amount > 0) AND
  (received_amount IS NULL OR received_amount > 0)
);
ALTER TABLE gifts ADD CONSTRAINT gifts_verified_has_amount CHECK (
  status <> 'VERIFIED' OR (received_amount IS NOT NULL AND verified_at IS NOT NULL)
);
ALTER TABLE gifts ADD CONSTRAINT gifts_khr_whole CHECK (
  currency <> 'KHR' OR (
    (notified_amount IS NULL OR notified_amount = trunc(notified_amount)) AND
    (received_amount IS NULL OR received_amount = trunc(received_amount))
  )
);
ALTER TABLE gifts ADD CONSTRAINT gifts_notification_has_amount CHECK (
  source <> 'GUEST_NOTIFICATION' OR notified_amount IS NOT NULL
);

-- ------------------------------------------------------------- check-ins
ALTER TABLE guest_check_ins ADD CONSTRAINT check_ins_count CHECK (arrived_count >= 1);
ALTER TABLE guest_check_ins ADD CONSTRAINT check_ins_override_reason
  CHECK (NOT is_override OR coalesce(btrim(override_reason), '') <> '');

-- ------------------------------------------------------------- content
ALTER TABLE wedding_settings ADD CONSTRAINT wedding_settings_singleton CHECK (id = 1);
ALTER TABLE wedding_events ADD CONSTRAINT wedding_events_time_order
  CHECK (ends_at IS NULL OR ends_at > starts_at);

-- --------------------------------------------- append-only history tables
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '42501';
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gift_events_append_only
  BEFORE UPDATE OR DELETE ON gift_events FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER trg_audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER trg_rsvp_history_append_only
  BEFORE UPDATE OR DELETE ON rsvp_history FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Gifts are never hard-deleted (use CANCELLED / REJECTED).
CREATE TRIGGER trg_gifts_no_delete
  BEFORE DELETE ON gifts FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- ---------------------------------------------------- search (optional)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX guests_name_en_trgm ON guests USING gin (name_en gin_trgm_ops);
CREATE INDEX guests_name_kh_trgm ON guests USING gin (name_kh gin_trgm_ops);
