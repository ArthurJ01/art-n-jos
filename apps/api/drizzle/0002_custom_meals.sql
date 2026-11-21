ALTER TABLE "meal_plan_entries" DROP CONSTRAINT "meal_plan_entries_kind_check";--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_title_check" CHECK (("meal_plan_entries"."kind" = 'custom') = ("meal_plan_entries"."title" is not null));--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_kind_check" CHECK ("meal_plan_entries"."kind" in ('recipe', 'eat_out', 'custom'));