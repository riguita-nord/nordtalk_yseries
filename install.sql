-- Optional install script (safe to run even if tables already exist)
-- Adds helpful indexes for performance.

ALTER TABLE `nordtalk_messages`
  ADD INDEX `idx_chat_id_id` (`chat_id`, `id`),
  ADD INDEX `idx_chat_created` (`chat_id`, `created_at`);

ALTER TABLE `nordtalk_chats`
  ADD INDEX `idx_user_a` (`user_a`),
  ADD INDEX `idx_user_b` (`user_b`),
  ADD INDEX `idx_last_time` (`last_time`);

ALTER TABLE `nordtalk_accounts`
  ADD UNIQUE INDEX `uniq_phone` (`phone`);

ALTER TABLE `nordtalk_group_members`
  ADD INDEX `idx_group_id` (`group_id`),
  ADD INDEX `idx_account_id` (`account_id`);
