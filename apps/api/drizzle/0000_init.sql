CREATE TABLE "recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"servings" integer,
	"prep_minutes" integer,
	"cook_minutes" integer,
	"ingredients" text[] DEFAULT '{}'::text[] NOT NULL,
	"steps" text[] DEFAULT '{}'::text[] NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"source_url" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "recipes_tags_idx" ON "recipes" USING gin ("tags");