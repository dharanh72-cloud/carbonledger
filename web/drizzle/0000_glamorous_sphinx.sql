CREATE TABLE `ledgerRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`userId` varchar(80) NOT NULL,
	`userName` varchar(160) NOT NULL,
	`ecoAction` varchar(160) NOT NULL,
	`projectCategory` varchar(120) NOT NULL,
	`co2Benefit` int NOT NULL,
	`fundAmount` int NOT NULL,
	`occurredAt` bigint NOT NULL,
	`notes` text,
	`leafHash` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ledgerRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE INDEX `ledgerRecords_ownerUserId_idx` ON `ledgerRecords` (`ownerUserId`);--> statement-breakpoint
CREATE INDEX `ledgerRecords_userId_idx` ON `ledgerRecords` (`userId`);