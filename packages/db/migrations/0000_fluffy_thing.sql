CREATE TABLE "analytics_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_name" text NOT NULL,
	"session_id" text,
	"user_id" text,
	"pack_id" text,
	"concept_id" text,
	"share_token" text,
	"cohort_id" text,
	"referral_source" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"organisation_id" text,
	"kind" text NOT NULL,
	"storage_key" text NOT NULL,
	"cutout_key" text,
	"mask_key" text,
	"mime_type" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer DEFAULT 0 NOT NULL,
	"analysis" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_kits" (
	"id" text PRIMARY KEY NOT NULL,
	"organisation_id" text NOT NULL,
	"name" text NOT NULL,
	"data" jsonb NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"organisation_id" text NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"balance_after" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_wallets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"lifetime_purchased" integer DEFAULT 0 NOT NULL,
	"lifetime_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_wallets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "design_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"design_id" text NOT NULL,
	"parent_id" text,
	"label" text DEFAULT '' NOT NULL,
	"document" jsonb NOT NULL,
	"patch" jsonb,
	"qa_report" jsonb,
	"vqs" real DEFAULT 0 NOT NULL,
	"preview_key" text,
	"source" text DEFAULT 'generation' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "designs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"format" text DEFAULT 'ig-portrait' NOT NULL,
	"composition" text DEFAULT '' NOT NULL,
	"style_direction" text DEFAULT '' NOT NULL,
	"current_version_id" text,
	"vqs" real DEFAULT 0 NOT NULL,
	"exported" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"organisation_id" text,
	"project_id" text,
	"design_id" text,
	"user_id" text,
	"pack_id" text,
	"session_id" text,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exports" (
	"id" text PRIMARY KEY NOT NULL,
	"design_id" text NOT NULL,
	"version_id" text NOT NULL,
	"format" text NOT NULL,
	"file_format" text DEFAULT 'png' NOT NULL,
	"scale" real DEFAULT 1 NOT NULL,
	"storage_key" text NOT NULL,
	"watermarked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"pack_id" text NOT NULL,
	"type" text DEFAULT 'concepts' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generations" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"design_id" text,
	"plan" jsonb NOT NULL,
	"document" jsonb NOT NULL,
	"dna" jsonb NOT NULL,
	"vqs" real DEFAULT 0 NOT NULL,
	"shown" boolean DEFAULT false NOT NULL,
	"selected" boolean DEFAULT false NOT NULL,
	"planner_model" text DEFAULT '' NOT NULL,
	"composition" text DEFAULT '' NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"user_id" text NOT NULL,
	"organisation_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_user_id_organisation_id_pk" PRIMARY KEY("user_id","organisation_id")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"pack_id" text NOT NULL,
	"user_id" text,
	"product_id" text DEFAULT 'single' NOT NULL,
	"credits_granted" integer DEFAULT 1 NOT NULL,
	"amount" integer DEFAULT 299 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"provider_session_id" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"refund_status" text DEFAULT 'none',
	"refund_reason" text,
	"refunded_at" timestamp with time zone,
	"refund_amount" integer DEFAULT 0,
	"pack_definition_version" text DEFAULT '1.0',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"country" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pack_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"pack_id" text NOT NULL,
	"user_id" text,
	"kind" text DEFAULT 'subject_photo' NOT NULL,
	"storage_key" text NOT NULL,
	"original_filename" text DEFAULT '',
	"mime_type" text NOT NULL,
	"bytes" integer DEFAULT 0 NOT NULL,
	"width" integer DEFAULT 0 NOT NULL,
	"height" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pack_concepts" (
	"id" text PRIMARY KEY NOT NULL,
	"pack_id" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"visual_direction" text DEFAULT '' NOT NULL,
	"vqs" real DEFAULT 0 NOT NULL,
	"vqs_version" text DEFAULT '1.0',
	"vqs_report" jsonb,
	"document" jsonb NOT NULL,
	"preview_key" text NOT NULL,
	"thumbnail_key" text NOT NULL,
	"status" text DEFAULT 'generated' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pack_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"pack_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"token" text NOT NULL,
	"views_count" integer DEFAULT 0 NOT NULL,
	"referral_source" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pack_shares_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "pack_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"pack_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"parent_version_id" text,
	"concept_id" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"document" jsonb NOT NULL,
	"patch" jsonb,
	"edit_category" text,
	"preview_key" text NOT NULL,
	"download_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"brief" jsonb NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"selected_concept_id" text,
	"requested_formats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"download_key" text,
	"pack_definition_version" text DEFAULT '1.0',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"order_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"organisation_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'church' NOT NULL,
	"brief" jsonb NOT NULL,
	"brand_kit_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_designs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"subcategory" text DEFAULT '' NOT NULL,
	"source_url" text DEFAULT '' NOT NULL,
	"source_credit" text DEFAULT '' NOT NULL,
	"image_key" text DEFAULT '' NOT NULL,
	"thumbnail_key" text DEFAULT '' NOT NULL,
	"composition" text NOT NULL,
	"characteristics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"typography" jsonb NOT NULL,
	"palette" jsonb NOT NULL,
	"image_treatment" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"geometry" jsonb NOT NULL,
	"dna" jsonb NOT NULL,
	"style_directions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"quality_score" integer DEFAULT 0 NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"reviewed_by" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_embeddings" (
	"reference_id" text PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"dimensions" integer NOT NULL,
	"embedding" vector(1536),
	"text" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '',
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vision_metering" (
	"id" text PRIMARY KEY NOT NULL,
	"pack_id" text,
	"edit_id" text,
	"version_number" integer,
	"provider" text DEFAULT 'fastapi_rembg' NOT NULL,
	"model" text DEFAULT 'u2net' NOT NULL,
	"operation_type" text NOT NULL,
	"input_bytes" integer DEFAULT 0 NOT NULL,
	"output_bytes" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"success" boolean DEFAULT true NOT NULL,
	"estimated_cost_usd" real DEFAULT 0 NOT NULL,
	"actual_cost_usd" real,
	"currency" text DEFAULT 'usd' NOT NULL,
	"pricing_version" text DEFAULT '2026.1' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vqs_experiment_raters" (
	"id" text PRIMARY KEY NOT NULL,
	"experiment_id" text NOT NULL,
	"rater_token" text NOT NULL,
	"pseudonym" text NOT NULL,
	"experience_years" integer DEFAULT 0,
	"is_professional_designer" boolean DEFAULT true,
	"consent_given_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vqs_experiment_raters_rater_token_unique" UNIQUE("rater_token")
);
--> statement-breakpoint
CREATE TABLE "vqs_experiment_ratings" (
	"id" text PRIMARY KEY NOT NULL,
	"experiment_id" text NOT NULL,
	"sample_id" text NOT NULL,
	"rater_id" text NOT NULL,
	"visual_quality" integer NOT NULL,
	"professionalism" integer NOT NULL,
	"clarity" integer NOT NULL,
	"likelihood_to_use" integer NOT NULL,
	"willingness_to_pay_bracket" text NOT NULL,
	"qualitative_feedback" text DEFAULT '',
	"duration_ms" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vqs_experiment_samples" (
	"id" text PRIMARY KEY NOT NULL,
	"experiment_id" text NOT NULL,
	"pack_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"preview_key" text NOT NULL,
	"preview_url" text NOT NULL,
	"vqs_score" real NOT NULL,
	"vqs_report" jsonb,
	"vqs_version" text DEFAULT '1.1' NOT NULL,
	"random_order_weight" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vqs_experiments" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"vqs_version" text DEFAULT '1.1' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"target_sample_size" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_kits" ADD CONSTRAINT "brand_kits_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_wallet_id_credit_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."credit_wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_versions" ADD CONSTRAINT "design_versions_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designs" ADD CONSTRAINT "designs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_assets" ADD CONSTRAINT "pack_assets_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_concepts" ADD CONSTRAINT "pack_concepts_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_shares" ADD CONSTRAINT "pack_shares_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_versions" ADD CONSTRAINT "pack_versions_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packs" ADD CONSTRAINT "packs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_brand_kit_id_brand_kits_id_fk" FOREIGN KEY ("brand_kit_id") REFERENCES "public"."brand_kits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_embeddings" ADD CONSTRAINT "reference_embeddings_reference_id_reference_designs_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."reference_designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vqs_experiment_raters" ADD CONSTRAINT "vqs_experiment_raters_experiment_id_vqs_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."vqs_experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vqs_experiment_ratings" ADD CONSTRAINT "vqs_experiment_ratings_experiment_id_vqs_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."vqs_experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vqs_experiment_ratings" ADD CONSTRAINT "vqs_experiment_ratings_sample_id_vqs_experiment_samples_id_fk" FOREIGN KEY ("sample_id") REFERENCES "public"."vqs_experiment_samples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vqs_experiment_ratings" ADD CONSTRAINT "vqs_experiment_ratings_rater_id_vqs_experiment_raters_id_fk" FOREIGN KEY ("rater_id") REFERENCES "public"."vqs_experiment_raters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vqs_experiment_samples" ADD CONSTRAINT "vqs_experiment_samples_experiment_id_vqs_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."vqs_experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_event_name_idx" ON "analytics_events" USING btree ("event_name");--> statement-breakpoint
CREATE INDEX "analytics_pack_idx" ON "analytics_events" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "analytics_cohort_idx" ON "analytics_events" USING btree ("cohort_id");--> statement-breakpoint
CREATE INDEX "analytics_created_idx" ON "analytics_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "assets_org_idx" ON "assets" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "brand_kits_org_idx" ON "brand_kits" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "credit_org_idx" ON "credit_ledger" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "credit_tx_user_idx" ON "credit_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_tx_wallet_idx" ON "credit_transactions" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "credit_tx_ref_idx" ON "credit_transactions" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_wallets_user_idx" ON "credit_wallets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "design_versions_design_idx" ON "design_versions" USING btree ("design_id");--> statement-breakpoint
CREATE INDEX "designs_project_idx" ON "designs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "events_type_idx" ON "events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "events_design_idx" ON "events" USING btree ("design_id");--> statement-breakpoint
CREATE INDEX "events_pack_idx" ON "events" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "events_session_idx" ON "events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "exports_design_idx" ON "exports" USING btree ("design_id");--> statement-breakpoint
CREATE INDEX "generation_jobs_pack_idx" ON "generation_jobs" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "generations_project_idx" ON "generations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "orders_pack_idx" ON "orders" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pack_assets_pack_idx" ON "pack_assets" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "pack_concepts_pack_idx" ON "pack_concepts" USING btree ("pack_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pack_shares_token_idx" ON "pack_shares" USING btree ("token");--> statement-breakpoint
CREATE INDEX "pack_shares_pack_idx" ON "pack_shares" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "pack_versions_pack_idx" ON "pack_versions" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "pack_versions_pack_num_idx" ON "pack_versions" USING btree ("pack_id","version_number");--> statement-breakpoint
CREATE INDEX "packs_user_idx" ON "packs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "packs_status_idx" ON "packs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_provider_event_idx" ON "processed_webhooks" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "webhook_order_idx" ON "processed_webhooks" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "projects_org_idx" ON "projects" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "reference_category_idx" ON "reference_designs" USING btree ("category","subcategory");--> statement-breakpoint
CREATE INDEX "reference_quality_idx" ON "reference_designs" USING btree ("quality_score");--> statement-breakpoint
CREATE INDEX "reference_embedding_idx" ON "reference_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "vision_metering_pack_idx" ON "vision_metering" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "vision_metering_created_idx" ON "vision_metering" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vqs_raters_token_idx" ON "vqs_experiment_raters" USING btree ("rater_token");--> statement-breakpoint
CREATE INDEX "vqs_raters_exp_idx" ON "vqs_experiment_raters" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "vqs_ratings_exp_idx" ON "vqs_experiment_ratings" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "vqs_ratings_sample_idx" ON "vqs_experiment_ratings" USING btree ("sample_id");--> statement-breakpoint
CREATE INDEX "vqs_ratings_rater_idx" ON "vqs_experiment_ratings" USING btree ("rater_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vqs_ratings_rater_sample_idx" ON "vqs_experiment_ratings" USING btree ("rater_id","sample_id");--> statement-breakpoint
CREATE INDEX "vqs_samples_exp_idx" ON "vqs_experiment_samples" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "vqs_exp_status_idx" ON "vqs_experiments" USING btree ("status");