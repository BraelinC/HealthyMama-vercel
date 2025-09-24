CREATE TABLE "communities" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"creator_id" varchar NOT NULL,
	"cover_image" text,
	"category" text NOT NULL,
	"member_count" integer DEFAULT 0,
	"is_public" boolean DEFAULT true,
	"settings" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "community_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"community_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"requirements" json NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"prize_description" text,
	"submissions" json DEFAULT '[]'::json,
	"winner_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "community_discussions" (
	"id" serial PRIMARY KEY NOT NULL,
	"community_id" integer NOT NULL,
	"meal_plan_id" integer,
	"author_id" varchar NOT NULL,
	"parent_id" integer,
	"content" text NOT NULL,
	"likes" integer DEFAULT 0,
	"is_pinned" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "community_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"community_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"points" integer DEFAULT 0,
	"level" integer DEFAULT 1,
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "creator_followers" (
	"id" serial PRIMARY KEY NOT NULL,
	"creator_id" varchar NOT NULL,
	"follower_id" varchar NOT NULL,
	"followed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "creator_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"bio" text,
	"specialties" json DEFAULT '[]'::json,
	"certifications" json DEFAULT '[]'::json,
	"follower_count" integer DEFAULT 0,
	"total_plans_shared" integer DEFAULT 0,
	"average_rating" integer,
	"verified_nutritionist" boolean DEFAULT false,
	"social_links" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "creator_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "cultural_cuisine_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"cuisine_name" text NOT NULL,
	"meals_data" json NOT NULL,
	"summary_data" json NOT NULL,
	"data_version" text DEFAULT '1.0.0' NOT NULL,
	"quality_score" integer DEFAULT 0,
	"access_count" integer DEFAULT 0,
	"last_accessed" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "food_database" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"calories_per_100g" integer NOT NULL,
	"protein_per_100g" integer,
	"carbs_per_100g" integer,
	"fat_per_100g" integer,
	"common_portion" integer DEFAULT 100,
	"category" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "food_database_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "food_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"image_url" text,
	"foods" json NOT NULL,
	"total_calories" integer NOT NULL,
	"total_protein" integer,
	"total_carbs" integer,
	"total_fat" integer,
	"meal_type" text,
	"logged_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "grocery_list_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"meal_plan_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"consolidated_ingredients" json NOT NULL,
	"shopping_url" text,
	"savings" json,
	"recommendations" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "meal_completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"meal_plan_id" integer NOT NULL,
	"day_key" text NOT NULL,
	"meal_type" text NOT NULL,
	"is_completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meal_plan_remixes" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_plan_id" integer NOT NULL,
	"remixer_id" varchar NOT NULL,
	"remixed_plan_id" integer NOT NULL,
	"community_id" integer,
	"changes_made" json NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meal_plan_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"shared_plan_id" integer NOT NULL,
	"reviewer_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"images" json DEFAULT '[]'::json,
	"tried_it" boolean DEFAULT false,
	"modifications" text,
	"helpful_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meal_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"meal_plan" json NOT NULL,
	"is_auto_saved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"profile_name" text,
	"primary_goal" text,
	"family_size" integer DEFAULT 1,
	"members" json DEFAULT '[]'::json,
	"profile_type" text DEFAULT 'family',
	"preferences" json DEFAULT '[]'::json,
	"goals" json DEFAULT '[]'::json,
	"cultural_background" json DEFAULT '[]'::json,
	"questionnaire_answers" json DEFAULT '{}'::json,
	"questionnaire_selections" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"image_url" text,
	"time_minutes" integer,
	"cuisine" text,
	"diet" text,
	"ingredients" json NOT NULL,
	"instructions" json NOT NULL,
	"nutrition_info" json,
	"video_id" text,
	"video_title" text,
	"video_channel" text,
	"is_saved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"user_id" varchar
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_meal_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"community_id" integer NOT NULL,
	"meal_plan_id" integer NOT NULL,
	"sharer_id" varchar NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"tags" json DEFAULT '[]'::json,
	"preview_images" json DEFAULT '[]'::json,
	"metrics" json DEFAULT '{}'::json,
	"likes" integer DEFAULT 0,
	"tries" integer DEFAULT 0,
	"success_rate" integer,
	"is_featured" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"achievement_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"is_unlocked" boolean DEFAULT false,
	"progress" integer DEFAULT 0,
	"max_progress" integer NOT NULL,
	"points" integer NOT NULL,
	"rarity" text NOT NULL,
	"unlocked_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_saved_cultural_meals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"cuisine_name" text NOT NULL,
	"meals_data" json NOT NULL,
	"summary_data" json NOT NULL,
	"custom_name" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"phone" varchar(20),
	"password_hash" varchar(255),
	"full_name" varchar(255),
	"google_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_challenges" ADD CONSTRAINT "community_challenges_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_challenges" ADD CONSTRAINT "community_challenges_winner_id_users_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_discussions" ADD CONSTRAINT "community_discussions_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_discussions" ADD CONSTRAINT "community_discussions_meal_plan_id_shared_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."shared_meal_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_discussions" ADD CONSTRAINT "community_discussions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_followers" ADD CONSTRAINT "creator_followers_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_followers" ADD CONSTRAINT "creator_followers_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_list_cache" ADD CONSTRAINT "grocery_list_cache_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_list_cache" ADD CONSTRAINT "grocery_list_cache_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_completions" ADD CONSTRAINT "meal_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_completions" ADD CONSTRAINT "meal_completions_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_remixes" ADD CONSTRAINT "meal_plan_remixes_original_plan_id_shared_meal_plans_id_fk" FOREIGN KEY ("original_plan_id") REFERENCES "public"."shared_meal_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_remixes" ADD CONSTRAINT "meal_plan_remixes_remixer_id_users_id_fk" FOREIGN KEY ("remixer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_remixes" ADD CONSTRAINT "meal_plan_remixes_remixed_plan_id_meal_plans_id_fk" FOREIGN KEY ("remixed_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_remixes" ADD CONSTRAINT "meal_plan_remixes_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_reviews" ADD CONSTRAINT "meal_plan_reviews_shared_plan_id_shared_meal_plans_id_fk" FOREIGN KEY ("shared_plan_id") REFERENCES "public"."shared_meal_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_reviews" ADD CONSTRAINT "meal_plan_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_meal_plans" ADD CONSTRAINT "shared_meal_plans_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_meal_plans" ADD CONSTRAINT "shared_meal_plans_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_meal_plans" ADD CONSTRAINT "shared_meal_plans_sharer_id_users_id_fk" FOREIGN KEY ("sharer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "communities_creator_idx" ON "communities" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "communities_category_idx" ON "communities" USING btree ("category");--> statement-breakpoint
CREATE INDEX "challenges_community_idx" ON "community_challenges" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "challenges_date_idx" ON "community_challenges" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "discussions_community_idx" ON "community_discussions" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "discussions_plan_idx" ON "community_discussions" USING btree ("meal_plan_id");--> statement-breakpoint
CREATE INDEX "discussions_author_idx" ON "community_discussions" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "community_user_idx" ON "community_members" USING btree ("community_id","user_id");--> statement-breakpoint
CREATE INDEX "community_members_user_idx" ON "community_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "creator_follower_idx" ON "creator_followers" USING btree ("creator_id","follower_id");--> statement-breakpoint
CREATE INDEX "followers_follower_idx" ON "creator_followers" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "creator_profiles_user_idx" ON "creator_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cuisine_name_idx" ON "cultural_cuisine_cache" USING btree ("cuisine_name");--> statement-breakpoint
CREATE INDEX "food_database_name_idx" ON "food_database" USING btree ("name");--> statement-breakpoint
CREATE INDEX "food_logs_user_idx" ON "food_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "food_logs_logged_at_idx" ON "food_logs" USING btree ("logged_at");--> statement-breakpoint
CREATE INDEX "grocery_cache_meal_plan_idx" ON "grocery_list_cache" USING btree ("meal_plan_id");--> statement-breakpoint
CREATE INDEX "grocery_cache_user_idx" ON "grocery_list_cache" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_meal_idx" ON "meal_completions" USING btree ("user_id","meal_plan_id","day_key","meal_type");--> statement-breakpoint
CREATE INDEX "remixes_original_idx" ON "meal_plan_remixes" USING btree ("original_plan_id");--> statement-breakpoint
CREATE INDEX "remixes_remixer_idx" ON "meal_plan_remixes" USING btree ("remixer_id");--> statement-breakpoint
CREATE INDEX "reviews_plan_idx" ON "meal_plan_reviews" USING btree ("shared_plan_id");--> statement-breakpoint
CREATE INDEX "reviews_reviewer_idx" ON "meal_plan_reviews" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "shared_plans_community_idx" ON "shared_meal_plans" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "shared_plans_sharer_idx" ON "shared_meal_plans" USING btree ("sharer_id");--> statement-breakpoint
CREATE INDEX "shared_plans_featured_idx" ON "shared_meal_plans" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "user_achievement_idx" ON "user_achievements" USING btree ("user_id","achievement_id");--> statement-breakpoint
CREATE INDEX "user_cuisine_idx" ON "user_saved_cultural_meals" USING btree ("user_id","cuisine_name");