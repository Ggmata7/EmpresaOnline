CREATE TABLE `canais_whatsapp` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`group_id` text NOT NULL,
	`categoria` text NOT NULL,
	`subcategoria` text,
	`regiao` text NOT NULL,
	`provedor` text NOT NULL,
	`visibilidade` text DEFAULT 'PRIVADO' NOT NULL,
	`ativo` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_canais_whatsapp_group_id` ON `canais_whatsapp` (`group_id`);--> statement-breakpoint
CREATE TABLE `cliques` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`produto_id` text NOT NULL,
	`canal` text NOT NULL,
	`visitor_hash` text,
	`user_agent` text,
	`criado_em` text NOT NULL,
	FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_cliques_produto_data` ON `cliques` (`produto_id`,`criado_em`);--> statement-breakpoint
CREATE TABLE `cupons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`produto_id` text NOT NULL,
	`codigo` text NOT NULL,
	`desconto_percentual` real,
	`valido_ate` text,
	`ativo` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_cupons_produto_ativo` ON `cupons` (`produto_id`,`ativo`);--> statement-breakpoint
CREATE TABLE `historico_precos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`produto_id` text NOT NULL,
	`preco` real NOT NULL,
	`preco_lista` real,
	`disponivel` integer DEFAULT true NOT NULL,
	`coletado_em` text NOT NULL,
	FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_historico_produto_data` ON `historico_precos` (`produto_id`,`coletado_em`);--> statement-breakpoint
CREATE TABLE `produtos` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`plataforma` text NOT NULL,
	`titulo` text NOT NULL,
	`categoria` text NOT NULL,
	`subcategoria` text NOT NULL,
	`regiao` text NOT NULL,
	`moeda` text NOT NULL,
	`url_original` text NOT NULL,
	`url_afiliado` text,
	`imagem_url` text,
	`ativo` integer DEFAULT true NOT NULL,
	`atualizado_em` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_produtos_slug` ON `produtos` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_produtos_regiao_categoria_ativo` ON `produtos` (`regiao`,`categoria`,`ativo`);