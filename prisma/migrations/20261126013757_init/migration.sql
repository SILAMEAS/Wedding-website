-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "GuestCategory" AS ENUM ('GROOM_FAMILY', 'BRIDE_FAMILY', 'FRIEND', 'COLLEAGUE', 'VIP', 'OTHER');

-- CreateEnum
CREATE TYPE "GuestSide" AS ENUM ('GROOM', 'BRIDE', 'BOTH');

-- CreateEnum
CREATE TYPE "InvitationType" AS ENUM ('INDIVIDUAL', 'FAMILY');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('ACTIVE', 'ROTATED', 'REVOKED');

-- CreateEnum
CREATE TYPE "AccessKind" AS ENUM ('LANDING', 'OPENED', 'RSVP_VIEW', 'GIFT_VIEW');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('ATTENDING', 'DECLINED', 'MAYBE');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('GUEST', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "WishStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WishVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'KHR');

-- CreateEnum
CREATE TYPE "GiftMethod" AS ENUM ('KHQR', 'BANK_TRANSFER', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "GiftSource" AS ENUM ('GUEST_NOTIFICATION', 'ADMIN_RECORD');

-- CreateEnum
CREATE TYPE "GiftStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GiftEventType" AS ENUM ('CREATED', 'VERIFIED', 'REJECTED', 'CANCELLED', 'CORRECTED', 'REOPENED', 'NOTE');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AlbumVisibility" AS ENUM ('PUBLIC', 'INVITATION_ONLY', 'UNPUBLISHED');

-- CreateEnum
CREATE TYPE "MediaPurpose" AS ENUM ('GALLERY_PHOTO', 'SITE_IMAGE', 'KHQR_IMAGE', 'WISH_PHOTO', 'GIFT_EVIDENCE');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'ATTACHED', 'DELETED');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'OWNER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "password_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "user_agent" TEXT,
    "ip_hash" TEXT,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_groups" (
    "id" UUID NOT NULL,
    "name_en" TEXT,
    "name_kh" TEXT,
    "category" "GuestCategory" NOT NULL DEFAULT 'OTHER',
    "side" "GuestSide",
    "primary_contact_guest_id" UUID,
    "notes" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guests" (
    "id" UUID NOT NULL,
    "name_en" TEXT,
    "name_kh" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "category" "GuestCategory" NOT NULL DEFAULT 'OTHER',
    "side" "GuestSide",
    "relationship" TEXT,
    "group_id" UUID,
    "notes" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "type" "InvitationType" NOT NULL,
    "guest_id" UUID,
    "group_id" UUID,
    "status" "InvitationStatus" NOT NULL DEFAULT 'ACTIVE',
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "allow_unnamed_guests" BOOLEAN NOT NULL DEFAULT false,
    "rsvp_deadline_override" TIMESTAMP(3),
    "preferred_locale" TEXT,
    "internal_label" TEXT,
    "notes" TEXT,
    "first_opened_at" TIMESTAMP(3),
    "last_opened_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation_tokens" (
    "id" UUID NOT NULL,
    "invitation_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_ciphertext" TEXT,
    "status" "TokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotated_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "invitation_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation_access_logs" (
    "id" UUID NOT NULL,
    "invitation_id" UUID NOT NULL,
    "token_id" UUID NOT NULL,
    "kind" "AccessKind" NOT NULL,
    "is_likely_bot" BOOLEAN NOT NULL DEFAULT false,
    "device_class" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rsvps" (
    "id" UUID NOT NULL,
    "invitation_id" UUID NOT NULL,
    "status" "RsvpStatus" NOT NULL,
    "unnamed_guests" INTEGER NOT NULL DEFAULT 0,
    "attending_count" INTEGER NOT NULL DEFAULT 0,
    "dietary" TEXT,
    "accessibility" TEXT,
    "note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "last_actor" "ActorType" NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rsvp_guests" (
    "id" UUID NOT NULL,
    "rsvp_id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "attending" BOOLEAN NOT NULL,
    "dietary" TEXT,

    CONSTRAINT "rsvp_guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rsvp_history" (
    "id" UUID NOT NULL,
    "rsvp_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "actor" "ActorType" NOT NULL,
    "admin_user_id" UUID,
    "reason" TEXT,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rsvp_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishes" (
    "id" UUID NOT NULL,
    "invitation_id" UUID,
    "guest_id" UUID,
    "author_name" TEXT NOT NULL,
    "relationship" TEXT,
    "message" TEXT NOT NULL,
    "original_message" TEXT,
    "photo_asset_id" UUID,
    "visibility" "WishVisibility" NOT NULL DEFAULT 'PUBLIC',
    "status" "WishStatus" NOT NULL DEFAULT 'PENDING',
    "content_hash" TEXT NOT NULL,
    "moderated_at" TIMESTAMP(3),
    "moderated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" UUID NOT NULL,
    "method" "GiftMethod" NOT NULL,
    "label" JSONB NOT NULL,
    "bank_name" TEXT,
    "account_holder" TEXT,
    "account_number" TEXT,
    "currencies" "Currency"[],
    "qr_asset_id" UUID,
    "instructions" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gifts" (
    "id" UUID NOT NULL,
    "source" "GiftSource" NOT NULL,
    "method" "GiftMethod" NOT NULL,
    "status" "GiftStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "currency" "Currency" NOT NULL,
    "notified_amount" DECIMAL(18,2),
    "received_amount" DECIMAL(18,2),
    "donor_name" TEXT NOT NULL,
    "invitation_id" UUID,
    "guest_id" UUID,
    "payment_method_id" UUID,
    "transaction_ref" TEXT,
    "transferred_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "message" TEXT,
    "evidence_asset_id" UUID,
    "admin_note" TEXT,
    "verified_at" TIMESTAMP(3),
    "verified_by_id" UUID,
    "recorded_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_events" (
    "id" UUID NOT NULL,
    "gift_id" UUID NOT NULL,
    "type" "GiftEventType" NOT NULL,
    "actor" "ActorType" NOT NULL,
    "admin_user_id" UUID,
    "reason" TEXT,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wedding_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "groom_name" JSONB NOT NULL,
    "bride_name" JSONB NOT NULL,
    "wedding_date" TIMESTAMP(3),
    "time_zone" TEXT NOT NULL DEFAULT 'Asia/Phnom_Penh',
    "invitation_message" JSONB,
    "post_wedding_message" JSONB,
    "story" JSONB,
    "hero_asset_id" UUID,
    "groom_portrait_asset_id" UUID,
    "bride_portrait_asset_id" UUID,
    "rsvp_deadline" TIMESTAMP(3),
    "rsvp_allow_maybe" BOOLEAN NOT NULL DEFAULT false,
    "wishes_public_enabled" BOOLEAN NOT NULL DEFAULT true,
    "wish_photos_enabled" BOOLEAN NOT NULL DEFAULT false,
    "gift_evidence_enabled" BOOLEAN NOT NULL DEFAULT true,
    "gift_thank_you" JSONB,
    "contacts" JSONB,
    "section_visibility" JSONB NOT NULL DEFAULT '{}',
    "music_asset_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "wedding_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_milestones" (
    "id" UUID NOT NULL,
    "occurred_on" DATE,
    "title" JSONB NOT NULL,
    "body" JSONB,
    "image_asset_id" UUID,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "story_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wedding_locations" (
    "id" UUID NOT NULL,
    "name" JSONB NOT NULL,
    "address" JSONB NOT NULL,
    "image_asset_id" UUID,
    "map_url" TEXT,
    "map_embed_url" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "parking" JSONB,
    "access" JSONB,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wedding_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wedding_events" (
    "id" UUID NOT NULL,
    "title" JSONB NOT NULL,
    "description" JSONB,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "location_id" UUID,
    "dress_code" JSONB,
    "instructions" JSONB,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wedding_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "purpose" "MediaPurpose" NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
    "public_id" TEXT NOT NULL,
    "delivery_type" TEXT NOT NULL DEFAULT 'upload',
    "format" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_albums" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "description" JSONB,
    "cover_photo_id" UUID,
    "visibility" "AlbumVisibility" NOT NULL DEFAULT 'UNPUBLISHED',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photo_albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" UUID NOT NULL,
    "album_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "caption" JSONB,
    "alt" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_check_ins" (
    "id" UUID NOT NULL,
    "invitation_id" UUID NOT NULL,
    "display_name_snapshot" TEXT NOT NULL,
    "arrived_count" INTEGER NOT NULL,
    "is_override" BOOLEAN NOT NULL DEFAULT false,
    "override_reason" TEXT,
    "note" TEXT,
    "checked_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked_in_by_id" UUID NOT NULL,
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "voided_by_id" UUID,

    CONSTRAINT "guest_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID,
    "actor_label" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "ip_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_username_key" ON "admin_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_token_hash_key" ON "admin_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "admin_sessions_admin_user_id_idx" ON "admin_sessions"("admin_user_id");

-- CreateIndex
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "guest_groups_primary_contact_guest_id_key" ON "guest_groups"("primary_contact_guest_id");

-- CreateIndex
CREATE INDEX "guest_groups_name_en_idx" ON "guest_groups"("name_en");

-- CreateIndex
CREATE INDEX "guest_groups_name_kh_idx" ON "guest_groups"("name_kh");

-- CreateIndex
CREATE INDEX "guest_groups_category_idx" ON "guest_groups"("category");

-- CreateIndex
CREATE INDEX "guests_name_en_idx" ON "guests"("name_en");

-- CreateIndex
CREATE INDEX "guests_name_kh_idx" ON "guests"("name_kh");

-- CreateIndex
CREATE INDEX "guests_group_id_idx" ON "guests"("group_id");

-- CreateIndex
CREATE INDEX "guests_category_idx" ON "guests"("category");

-- CreateIndex
CREATE INDEX "guests_archived_at_idx" ON "guests"("archived_at");

-- CreateIndex
CREATE INDEX "invitations_type_status_idx" ON "invitations"("type", "status");

-- CreateIndex
CREATE INDEX "invitations_guest_id_idx" ON "invitations"("guest_id");

-- CreateIndex
CREATE INDEX "invitations_group_id_idx" ON "invitations"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_one_live_per_guest" ON "invitations"("guest_id") WHERE (guest_id IS NOT NULL AND status <> 'REVOKED');

-- CreateIndex
CREATE UNIQUE INDEX "invitations_one_live_per_group" ON "invitations"("group_id") WHERE (group_id IS NOT NULL AND status <> 'REVOKED');

-- CreateIndex
CREATE UNIQUE INDEX "invitation_tokens_token_hash_key" ON "invitation_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "invitation_tokens_invitation_id_idx" ON "invitation_tokens"("invitation_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_tokens_one_active" ON "invitation_tokens"("invitation_id") WHERE (status = 'ACTIVE');

-- CreateIndex
CREATE INDEX "invitation_access_logs_invitation_id_occurred_at_idx" ON "invitation_access_logs"("invitation_id", "occurred_at");

-- CreateIndex
CREATE INDEX "invitation_access_logs_occurred_at_idx" ON "invitation_access_logs"("occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "rsvps_invitation_id_key" ON "rsvps"("invitation_id");

-- CreateIndex
CREATE INDEX "rsvps_status_idx" ON "rsvps"("status");

-- CreateIndex
CREATE INDEX "rsvp_guests_guest_id_idx" ON "rsvp_guests"("guest_id");

-- CreateIndex
CREATE UNIQUE INDEX "rsvp_guests_rsvp_id_guest_id_key" ON "rsvp_guests"("rsvp_id", "guest_id");

-- CreateIndex
CREATE UNIQUE INDEX "rsvp_history_rsvp_id_version_key" ON "rsvp_history"("rsvp_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "wishes_photo_asset_id_key" ON "wishes"("photo_asset_id");

-- CreateIndex
CREATE INDEX "wishes_status_visibility_created_at_idx" ON "wishes"("status", "visibility", "created_at");

-- CreateIndex
CREATE INDEX "wishes_invitation_id_idx" ON "wishes"("invitation_id");

-- CreateIndex
CREATE INDEX "wishes_content_hash_idx" ON "wishes"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_qr_asset_id_key" ON "payment_methods"("qr_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "gifts_evidence_asset_id_key" ON "gifts"("evidence_asset_id");

-- CreateIndex
CREATE INDEX "gifts_status_currency_idx" ON "gifts"("status", "currency");

-- CreateIndex
CREATE INDEX "gifts_method_idx" ON "gifts"("method");

-- CreateIndex
CREATE INDEX "gifts_transferred_at_idx" ON "gifts"("transferred_at");

-- CreateIndex
CREATE INDEX "gifts_received_at_idx" ON "gifts"("received_at");

-- CreateIndex
CREATE INDEX "gifts_invitation_id_idx" ON "gifts"("invitation_id");

-- CreateIndex
CREATE INDEX "gifts_created_at_idx" ON "gifts"("created_at");

-- CreateIndex
CREATE INDEX "gift_events_gift_id_created_at_idx" ON "gift_events"("gift_id", "created_at");

-- CreateIndex
CREATE INDEX "story_milestones_status_sort_order_idx" ON "story_milestones"("status", "sort_order");

-- CreateIndex
CREATE INDEX "wedding_locations_status_sort_order_idx" ON "wedding_locations"("status", "sort_order");

-- CreateIndex
CREATE INDEX "wedding_events_starts_at_idx" ON "wedding_events"("starts_at");

-- CreateIndex
CREATE INDEX "wedding_events_status_sort_order_idx" ON "wedding_events"("status", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_public_id_key" ON "media_assets"("public_id");

-- CreateIndex
CREATE INDEX "media_assets_status_created_at_idx" ON "media_assets"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "photo_albums_slug_key" ON "photo_albums"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "photo_albums_cover_photo_id_key" ON "photo_albums"("cover_photo_id");

-- CreateIndex
CREATE INDEX "photo_albums_visibility_sort_order_idx" ON "photo_albums"("visibility", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "photos_asset_id_key" ON "photos"("asset_id");

-- CreateIndex
CREATE INDEX "photos_album_id_sort_order_idx" ON "photos"("album_id", "sort_order");

-- CreateIndex
CREATE INDEX "guest_check_ins_invitation_id_idx" ON "guest_check_ins"("invitation_id");

-- CreateIndex
CREATE INDEX "guest_check_ins_checked_in_at_idx" ON "guest_check_ins"("checked_in_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_expires_at_idx" ON "rate_limit_buckets"("expires_at");

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_groups" ADD CONSTRAINT "guest_groups_primary_contact_guest_id_fkey" FOREIGN KEY ("primary_contact_guest_id") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "guest_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "guest_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_tokens" ADD CONSTRAINT "invitation_tokens_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_access_logs" ADD CONSTRAINT "invitation_access_logs_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_access_logs" ADD CONSTRAINT "invitation_access_logs_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "invitation_tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvp_guests" ADD CONSTRAINT "rsvp_guests_rsvp_id_fkey" FOREIGN KEY ("rsvp_id") REFERENCES "rsvps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvp_guests" ADD CONSTRAINT "rsvp_guests_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvp_history" ADD CONSTRAINT "rsvp_history_rsvp_id_fkey" FOREIGN KEY ("rsvp_id") REFERENCES "rsvps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvp_history" ADD CONSTRAINT "rsvp_history_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_photo_asset_id_fkey" FOREIGN KEY ("photo_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_moderated_by_id_fkey" FOREIGN KEY ("moderated_by_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_qr_asset_id_fkey" FOREIGN KEY ("qr_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_evidence_asset_id_fkey" FOREIGN KEY ("evidence_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_events" ADD CONSTRAINT "gift_events_gift_id_fkey" FOREIGN KEY ("gift_id") REFERENCES "gifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_events" ADD CONSTRAINT "gift_events_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_settings" ADD CONSTRAINT "wedding_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_events" ADD CONSTRAINT "wedding_events_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "wedding_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_albums" ADD CONSTRAINT "photo_albums_cover_photo_id_fkey" FOREIGN KEY ("cover_photo_id") REFERENCES "photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "photo_albums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_check_ins" ADD CONSTRAINT "guest_check_ins_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_check_ins" ADD CONSTRAINT "guest_check_ins_checked_in_by_id_fkey" FOREIGN KEY ("checked_in_by_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_check_ins" ADD CONSTRAINT "guest_check_ins_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
