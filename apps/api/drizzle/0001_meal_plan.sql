CREATE TABLE "meal_plan_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"meal" text NOT NULL,
	"kind" text NOT NULL,
	"recipe_id" integer,
	"is_leftover" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_plan_entries_meal_check" CHECK ("meal_plan_entries"."meal" in ('breakfast', 'lunch', 'dinner')),
	CONSTRAINT "meal_plan_entries_kind_check" CHECK ("meal_plan_entries"."kind" in ('recipe', 'eat_out')),
	CONSTRAINT "meal_plan_entries_recipe_check" CHECK (("meal_plan_entries"."kind" = 'recipe') = ("meal_plan_entries"."recipe_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meal_plan_entries_date_idx" ON "meal_plan_entries" USING btree ("date");