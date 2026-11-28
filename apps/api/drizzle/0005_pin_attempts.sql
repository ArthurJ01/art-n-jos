CREATE TABLE "pin_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pin_attempts_email_idx" ON "pin_attempts" USING btree ("email");