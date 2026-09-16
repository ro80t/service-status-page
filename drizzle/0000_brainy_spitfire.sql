CREATE TABLE "api" (
	"domain" text NOT NULL,
	"url" text NOT NULL,
	"method" text,
	"header" jsonb,
	"body" jsonb,
	CONSTRAINT "api_domain_url_pk" PRIMARY KEY("domain","url")
);
--> statement-breakpoint
CREATE TABLE "status" (
	"domain" text NOT NULL,
	"status" integer[] NOT NULL,
	"date" date NOT NULL,
	CONSTRAINT "status_domain_date_pk" PRIMARY KEY("domain","date")
);
--> statement-breakpoint
CREATE TABLE "trigger" (
	"domain" text PRIMARY KEY NOT NULL,
	"limit" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website" (
	"domain" text PRIMARY KEY NOT NULL,
	"zone_id" text NOT NULL,
	"url" text NOT NULL,
	"label" text
);
