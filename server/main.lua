local T = Config.Tables

local function trim(s)
  if not s then return '' end
  return (tostring(s):gsub('^%s+', ''):gsub('%s+$', ''))
end

local function nowSql()
  return os.date('%Y-%m-%d %H:%M:%S')
end

local function generateCode()
  return tostring(math.random(100000, 999999))
end

local function sendVerificationSMS(phone, code)

    if not phone or not code then
        print("[NordTalk] SMS ERROR: phone/code nil")
        return
    end

    phone = tostring(phone)
    code = tostring(code)

    local message = ("NordTalk code: %s"):format(code)

    -- numero remetente (podes mudar se quiseres)
    local sender = "0881111"

    -- enviar SMS pelo yseries
    local ok, err = pcall(function()
        exports.yseries:SendMessageTo(
            sender,  -- remetente
            phone,   -- destinatario
            message  -- mensagem
        )
    end)

    if not ok then
        print("[NordTalk] SMS SEND ERROR:", err)
    else
        print("[NordTalk] SMS sent to:", phone, "code:", code)
    end

end

local VerifyCodes = {}

lib.callback.register('nordtalk:sv:login', function(src, phone)

  phone = trim(phone)

  if phone == '' then
    return { ok = false, error = 'invalid_phone' }
  end

  local acc = MySQL.single.await(
    ('SELECT * FROM `%s` WHERE phone = ? LIMIT 1'):format(T.accounts),
    { phone }
  )

  if not acc then
    return { ok = false, error = 'not_found' }
  end

  local code = generateCode()

  MySQL.update.await(
  ('UPDATE `%s` SET email_verified = 0, email_code = ? WHERE phone = ?'):format(T.accounts),
  { code, phone }
  )

  sendVerificationSMS(phone, code)

  print("[NordTalk] Login verification SMS sent to", phone, code)

  return {
    ok = false,
    error = 'email_not_verified'
  }

end)

lib.callback.register('nordtalk:sv:register', function(src, name, phone, email)

  print("[NordTalk] REGISTER RECEIVED:", name, phone, email)

  name  = trim(name)
  phone = trim(phone)
  email = trim(email)

  if name == '' or phone == '' or email == '' then
    return { ok = false, error = 'invalid_data' }
  end

  -- verificar se já existe conta
  local exists = MySQL.single.await(
    ('SELECT id FROM `%s` WHERE phone = ? LIMIT 1'):format(T.accounts),
    { phone }
  )

  if exists then
    return { ok = false, error = 'exists' }
  end

  local code = generateCode()

  MySQL.insert.await(
  ('INSERT INTO `%s` (name, phone, email, email_verified, email_code, created_at) VALUES (?, ?, ?, 0, ?, ?)'):format(T.accounts),
  { name, phone, email, code, nowSql() }
  )

  sendVerificationSMS(phone, code)

  print("[NordTalk] Register verification SMS sent to", phone, code)

  return {
    ok = true,
    verify = true
  }

end)

lib.callback.register('nordtalk:sv:verifyEmail', function(src, phone, code)

  phone = trim(phone)
  code = trim(code)

  local acc = MySQL.single.await(
    ('SELECT id, email_code FROM `%s` WHERE phone = ? LIMIT 1'):format(T.accounts),
    { phone }
  )

  if not acc then
    return { ok = false, error = 'invalid_code' }
  end

  if tostring(acc.email_code) ~= tostring(code) then
    return { ok = false, error = 'invalid_code' }
  end

  -- marcar como verificado
  MySQL.update.await(
    ('UPDATE `%s` SET email_verified = 1, email_code = NULL WHERE phone = ?'):format(T.accounts),
    { phone }
  )

  local account = MySQL.single.await(
    ('SELECT * FROM `%s` WHERE phone = ? LIMIT 1'):format(T.accounts),
    { phone }
  )

  return {
    ok = true,
    account = account
  }

end)

lib.callback.register('nordtalk:sv:restoreSession', function(src, phone)

    phone = trim(phone)

    -- telefone do dispositivo do jogador
    local devicePhone = exports.yseries:GetPhoneNumberBySourceId(src)

    if not devicePhone then
        return { ok = false, error = "no_device_phone" }
    end

    devicePhone = tostring(devicePhone)

    -- segurança: telefone da conta tem de ser o mesmo do dispositivo
    if devicePhone ~= phone then
        print("[NordTalk] Session restore blocked (phone mismatch)", devicePhone, phone)

        return {
            ok = false,
            error = "phone_mismatch"
        }
    end

    local acc = MySQL.single.await(
        ('SELECT * FROM `%s` WHERE phone = ? LIMIT 1'):format(T.accounts),
        { phone }
    )

    if not acc then
        return { ok = false }
    end

    return {
        ok = true,
        account = acc
    }

end)

lib.callback.register('nordtalk:sv:logout', function(src)
  return { ok = true }
end)

local function getPhone(src)
  -- Docs: exports.yseries:GetPhoneNumberBySourceId(source) citeturn6view0
  local phone = exports.yseries:GetPhoneNumberBySourceId(src)
  if not phone or phone == '' then return nil end
  return tostring(phone)
end

local function getOrCreateAccountByPhone(phone)
  local acc = MySQL.single.await(('SELECT * FROM `%s` WHERE phone = ? LIMIT 1'):format(T.accounts), { phone })
  if acc then return acc end
  -- If you want auto-create accounts when a player opens the app:
  local id = MySQL.insert.await(
    ('INSERT INTO `%s` (phone, name, email, email_verified, created_at) VALUES (?, ?, ?, 0, ?)'):format(T.accounts),
    { phone, ('User %s'):format(phone), nil, nowSql() }
  )
  return MySQL.single.await(('SELECT * FROM `%s` WHERE id = ? LIMIT 1'):format(T.accounts), { id })
end

local function isChatMember(chat, accountId)
  if not chat then return false end
  accountId = tonumber(accountId)
  return tonumber(chat.user_a) == accountId or tonumber(chat.user_b) == accountId
end

local function ensureChatOwnership(chatId, accountId)
  local chat = MySQL.single.await(('SELECT * FROM `%s` WHERE id = ? LIMIT 1'):format(T.chats), { chatId })
  if not chat or not isChatMember(chat, accountId) then
    return nil, 'not_allowed'
  end
  return chat
end

local function getLastMessage(chatId)
  return MySQL.single.await(
    ('SELECT id, sender_id, content, created_at FROM `%s` WHERE chat_id = ? ORDER BY id DESC LIMIT 1'):format(T.messages),
    { chatId }
  )
end

local function listDmChatsForAccount(accountId, limit)
  limit = math.min(tonumber(limit or Config.ListLimit) or Config.ListLimit, 200)

  local rows = MySQL.query.await(([[
    SELECT c.*,
           a1.phone AS user_a_phone, a1.name AS user_a_name, a1.avatar AS user_a_avatar,
           a2.phone AS user_b_phone, a2.name AS user_b_name, a2.avatar AS user_b_avatar
    FROM `%s` c
    LEFT JOIN `%s` a1 ON a1.id = c.user_a
    LEFT JOIN `%s` a2 ON a2.id = c.user_b
    WHERE c.user_a = ? OR c.user_b = ?
    ORDER BY COALESCE(c.last_time, c.created_at) DESC
    LIMIT %d
  ]]):format(T.chats, T.accounts, T.accounts, limit), { accountId, accountId })

  for _, c in ipairs(rows or {}) do
    local last = getLastMessage(c.id)
    c.last_message = last and last.content or c.last_message
    c.last_time = last and last.created_at or c.last_time or c.created_at

    local other = (tonumber(c.user_a) == tonumber(accountId)) and 'b' or 'a'
    c.peer = {
      id = other == 'a' and c.user_a or c.user_b,
      phone = other == 'a' and c.user_a_phone or c.user_b_phone,
      name = other == 'a' and c.user_a_name or c.user_b_name,
      avatar = other == 'a' and c.user_a_avatar or c.user_b_avatar,
    }
  end

  return rows or {}
end

local function broadcastToChat(chatId, payload)

  local chat = MySQL.single.await(
    ('SELECT user_a, user_b FROM `%s` WHERE id = ? LIMIT 1'):format(T.chats),
    { chatId }
  )

  if not chat then return end

  local a = MySQL.single.await(
    ('SELECT phone, name FROM `%s` WHERE id = ? LIMIT 1'):format(T.accounts),
    { chat.user_a }
  )

  local b = MySQL.single.await(
    ('SELECT phone, name FROM `%s` WHERE id = ? LIMIT 1'):format(T.accounts),
    { chat.user_b }
  )

  local function push(phone, name)

    if not phone then return end

    local src = exports.yseries:GetPlayerSourceIdByPhoneNumber(tostring(phone))

    if src then
      TriggerClientEvent('nordtalk:cl:push', src, payload)
    end

  end

  push(a and a.phone, a and a.name)
  push(b and b.phone, b and b.name)

end

local function listGroupsForAccount(accountId, limit)
  limit = math.min(tonumber(limit or Config.ListLimit) or Config.ListLimit, 200)

  local rows = MySQL.query.await(([[
    SELECT g.*,
           gm.role AS my_role
    FROM `%s` gm
    INNER JOIN `%s` g ON g.id = gm.group_id
    WHERE gm.account_id = ?
    ORDER BY g.created_at DESC
    LIMIT %d
  ]]):format(T.group_members, T.groups, limit), { accountId })

  return rows or {}
end

local function isGroupMember(groupId, accountId)
  local row = MySQL.single.await(
    ('SELECT id, role FROM `%s` WHERE group_id = ? AND account_id = ? LIMIT 1'):format(T.group_members),
    { groupId, accountId }
  )
  return row
end

local function broadcastToGroup(groupId, payload)
  local members = MySQL.query.await(
    ('SELECT a.phone FROM `%s` gm INNER JOIN `%s` a ON a.id = gm.account_id WHERE gm.group_id = ?'):format(T.group_members, T.accounts),
    { groupId }
  )
  for _, m in ipairs(members or {}) do
    local src = exports.yseries:GetPlayerSourceIdByPhoneNumber(tostring(m.phone))
    if src and tonumber(src) then
      TriggerClientEvent('nordtalk:cl:push', tonumber(src), payload)
    end
  end
end

--========================
-- Callbacks (NUI -> server)
--========================
lib.callback.register('nordtalk:sv:bootstrap', function(src)
  local phone = getPhone(src)
  if not phone then return { ok = false, error = 'no_phone' } end

  local acc = getOrCreateAccountByPhone(phone)
  if not acc then return { ok = false, error = 'account_failed' } end

  -- update last_seen
  MySQL.update.await(('UPDATE `%s` SET last_seen = ? WHERE id = ?'):format(T.accounts), { nowSql(), acc.id })

  return {
    ok = true,
    me = {
      id = acc.id,
      phone = acc.phone,
      name = acc.name,
      avatar = acc.avatar,
      bio = acc.bio
    }
  }
end)

lib.callback.register('nordtalk:sv:listChats', function(src)
  local phone = getPhone(src)
  if not phone then return { ok = false, error = 'no_phone' } end
  local acc = getOrCreateAccountByPhone(phone)
  if not acc then return { ok = false, error = 'account_failed' } end

  local chats = listDmChatsForAccount(acc.id, Config.ListLimit)
  return { ok = true, chats = chats }
end)

lib.callback.register('nordtalk:sv:listGroups', function(src)
  local phone = getPhone(src)
  if not phone then return { ok = false, error = 'no_phone' } end
  local acc = getOrCreateAccountByPhone(phone)
  if not acc then return { ok = false, error = 'account_failed' } end

  local groups = listGroupsForAccount(acc.id, Config.ListLimit)
  return { ok = true, groups = groups }
end)

lib.callback.register('nordtalk:sv:createChat', function(src, targetPhone)
  targetPhone = trim(targetPhone)
  if targetPhone == '' then return { ok = false, error = 'invalid_phone' } end

  local phone = getPhone(src)
  if not phone then return { ok = false, error = 'no_phone' } end

  local me = getOrCreateAccountByPhone(phone)
  if not me then return { ok = false, error = 'account_failed' } end

  local otherAcc = MySQL.single.await(('SELECT * FROM `%s` WHERE phone = ? LIMIT 1'):format(T.accounts), { targetPhone })
  if not otherAcc then
    -- you can choose to auto-create the target account too, but usually you only allow existing users
    return { ok = false, error = 'target_not_found' }
  end

  if tonumber(otherAcc.id) == tonumber(me.id) then
    return { ok = false, error = 'same_user' }
  end

  -- Ensure uniqueness of dm chat (order-insensitive)
  local chat = MySQL.single.await(([[
    SELECT * FROM `%s`
    WHERE (user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?)
    LIMIT 1
  ]]):format(T.chats), { me.id, otherAcc.id, otherAcc.id, me.id })

  if not chat then
    local id = MySQL.insert.await(
      ('INSERT INTO `%s` (user_a, user_b, created_at) VALUES (?, ?, ?)'):format(T.chats),
      { me.id, otherAcc.id, nowSql() }
    )
    chat = MySQL.single.await(('SELECT * FROM `%s` WHERE id = ? LIMIT 1'):format(T.chats), { id })
  end

  return {
    ok = true,
    chatId = chat.id,
    chat = chat
  }
end)

lib.callback.register('nordtalk:sv:getMessages', function(src, chatId, beforeId)
  chatId = tonumber(chatId)
  if not chatId then return { ok = false, error = 'invalid_chat' } end

  local phone = getPhone(src)
  if not phone then return { ok = false, error = 'no_phone' } end
  local me = getOrCreateAccountByPhone(phone)
  if not me then return { ok = false, error = 'account_failed' } end

  local chat, err = ensureChatOwnership(chatId, me.id)
  if not chat then return { ok = false, error = err or 'not_allowed' } end

  local limit = math.min(tonumber(Config.MessagesPageSize) or 50, 200)

  local q, params
  if beforeId and tonumber(beforeId) then
    q = ('SELECT m.*, a.phone as sender_phone, a.name as sender_name, a.avatar as sender_avatar FROM `%s` m LEFT JOIN `%s` a ON a.id = m.sender_id WHERE m.chat_id = ? AND m.id < ? ORDER BY m.id DESC LIMIT %d'):format(T.messages, T.accounts, limit)
    params = { chatId, beforeId }
  else
    q = ('SELECT m.*, a.phone as sender_phone, a.name as sender_name, a.avatar as sender_avatar FROM `%s` m LEFT JOIN `%s` a ON a.id = m.sender_id WHERE m.chat_id = ? ORDER BY m.id DESC LIMIT %d'):format(T.messages, T.accounts, limit)
    params = { chatId }
  end

  local rows = MySQL.query.await(q, params) or {}
  -- return ascending for UI
  table.sort(rows, function(a,b) return tonumber(a.id) < tonumber(b.id) end)

  return { ok = true, messages = rows }
end)

lib.callback.register('nordtalk:typing', function(src, chatId)

  chatId = tonumber(chatId)
  if not chatId then return { ok = false } end

  local phone = getPhone(src)
  if not phone then return { ok = false } end

  local me = getOrCreateAccountByPhone(phone)
  if not me then return { ok = false } end

  local chat = MySQL.single.await(
    ('SELECT user_a, user_b FROM `%s` WHERE id = ? LIMIT 1'):format(T.chats),
    { chatId }
  )

  if not chat then return { ok = false } end

  -- descobrir o outro participante
  local otherId = (tonumber(chat.user_a) == tonumber(me.id)) and chat.user_b or chat.user_a

  local other = MySQL.single.await(
    ('SELECT phone FROM `%s` WHERE id = ? LIMIT 1'):format(T.accounts),
    { otherId }
  )

  if not other then return { ok = false } end

  local targetSrc = exports.yseries:GetPlayerSourceIdByPhoneNumber(tostring(other.phone))

  if targetSrc then

    TriggerClientEvent("nordtalk:cl:push", targetSrc, {
      action = "nordtalk:typing",
      data = {
        chatId = chatId,
        sender = me.id
      }
    })

  end

  return { ok = true }

end)

lib.callback.register('nordtalk:sv:messageDelivered', function(src, msgId)

  msgId = tonumber(msgId)
  if not msgId then return { ok = false } end

  MySQL.update.await(
    ('UPDATE `%s` SET delivered = 1 WHERE id = ?'):format(T.messages),
    { msgId }
  )

  -- 🔥 descobrir chat da mensagem
  local row = MySQL.single.await(
    ('SELECT chat_id FROM `%s` WHERE id = ?'):format(T.messages),
    { msgId }
  )

  if row then
    broadcastToChat(row.chat_id, {
      action = "nordtalk:messageDelivered",
      data = { msgId = msgId }
    })
  end

  return { ok = true }

end)

lib.callback.register('nordtalk:sv:messageRead', function(src, chatId)

  chatId = tonumber(chatId)
  if not chatId then return { ok = false } end

  local phone = getPhone(src)
  if not phone then return { ok = false } end

  local me = getOrCreateAccountByPhone(phone)
  if not me then return { ok = false } end

  MySQL.update.await(
    ('UPDATE `%s` SET seen = 1 WHERE chat_id = ? AND sender_id != ?'):format(T.messages),
    { chatId, me.id }
  )

  -- 🔥 avisar todos no chat
  broadcastToChat(chatId, {
    action = "nordtalk:messageRead",
    data = { chatId = chatId }
  })

  return { ok = true }

end)

lib.callback.register('nordtalk:sv:sendMessage', function(src, chatId, text)
  chatId = tonumber(chatId)
  if not chatId then return { ok = false, error = 'invalid_chat' } end

  text = trim(text)
  if text == '' then return { ok = false, error = 'empty' } end
  if #text > (Config.MessageMaxLen or 2000) then
    text = text:sub(1, Config.MessageMaxLen or 2000)
  end

  local phone = getPhone(src)
  if not phone then return { ok = false, error = 'no_phone' } end
  local me = getOrCreateAccountByPhone(phone)
  if not me then return { ok = false, error = 'account_failed' } end

  local chat, err = ensureChatOwnership(chatId, me.id)
  if not chat then return { ok = false, error = err or 'not_allowed' } end

  local created = nowSql()
  local msgId = MySQL.insert.await(
    ('INSERT INTO `%s` (chat_id, sender_id, content, created_at, delivered, seen) VALUES (?, ?, ?, ?, 0, 0)'):format(T.messages),
    { chatId, me.id, text, created }
  )

  -- Update chat last_*
  MySQL.update.await(
    ('UPDATE `%s` SET last_message = ?, last_time = ? WHERE id = ?'):format(T.chats),
    { text, created, chatId }
  )

  local payload = {
    action = 'nordtalk:newMessage',
    data = {
      chatId = chatId,
      message = {
        id = msgId,
        chat_id = chatId,
        sender_id = me.id,
        sender_phone = me.phone,
        sender_name = me.name,
        sender_avatar = me.avatar,
        content = text,
        created_at = created
      }
    }
  }

  -- descobrir o outro participante
  local otherId = (tonumber(chat.user_a) == tonumber(me.id)) and chat.user_b or chat.user_a

  local other = MySQL.single.await(
  ('SELECT phone, name FROM `%s` WHERE id = ?'):format(T.accounts),
  { otherId }
  )

  -- enviar notificação
  if other then
      sendPhoneNotification(
          other.phone,
          me.name or me.phone,
          text
      )
  end

  -- enviar mensagem em tempo real
  broadcastToChat(chatId, payload)
  return { ok = true, id = msgId }
end)

--========================
-- Groups (basic)
--========================
lib.callback.register('nordtalk:sv:createGroup', function(src, name)
  name = trim(name)
  if name == '' then return { ok = false, error = 'invalid_name' } end
  if #name > 64 then name = name:sub(1, 64) end

  local phone = getPhone(src)
  if not phone then return { ok = false, error = 'no_phone' } end
  local me = getOrCreateAccountByPhone(phone)
  if not me then return { ok = false, error = 'account_failed' } end

  local gid = MySQL.insert.await(
    ('INSERT INTO `%s` (name, avatar, owner_id, created_at) VALUES (?, NULL, ?, ?)'):format(T.groups),
    { name, me.id, nowSql() }
  )

  MySQL.insert.await(
    ('INSERT INTO `%s` (group_id, account_id, role, joined_at) VALUES (?, ?, ?, ?)'):format(T.group_members),
    { gid, me.id, 'owner', nowSql() }
  )

  return { ok = true, groupId = gid }
end)

lib.callback.register('nordtalk:sv:addGroupMember', function(src, groupId, phoneToAdd)
  groupId = tonumber(groupId)
  phoneToAdd = trim(phoneToAdd)
  if not groupId then return { ok = false, error = 'invalid_group' } end
  if phoneToAdd == '' then return { ok = false, error = 'invalid_phone' } end

  local phone = getPhone(src)
  if not phone then return { ok = false, error = 'no_phone' } end
  local me = getOrCreateAccountByPhone(phone)
  if not me then return { ok = false, error = 'account_failed' } end

  local myMember = isGroupMember(groupId, me.id)
  if not myMember or (myMember.role ~= 'owner' and myMember.role ~= 'admin') then
    return { ok = false, error = 'not_allowed' }
  end

  local acc = MySQL.single.await(('SELECT id, phone, name FROM `%s` WHERE phone = ? LIMIT 1'):format(T.accounts), { phoneToAdd })
  if not acc then return { ok = false, error = 'target_not_found' } end

  local exists = isGroupMember(groupId, acc.id)
  if exists then return { ok = false, error = 'already_member' } end

  MySQL.insert.await(
    ('INSERT INTO `%s` (group_id, account_id, role, joined_at) VALUES (?, ?, ?, ?)'):format(T.group_members),
    { groupId, acc.id, 'member', nowSql() }
  )

  broadcastToGroup(groupId, { action = 'nordtalk:groupMemberAdded', data = { groupId = groupId, account = acc } })
  return { ok = true }
end)

lib.callback.register('nordtalk:sv:getContacts', function(source)

    local phoneNumber = exports.yseries:GetPhoneNumberBySourceId(source)

    if not phoneNumber then
        return {}
    end

    local sim = MySQL.single.await([[
        SELECT phone_imei
        FROM yphone_sim_cards
        WHERE sim_number = ?
    ]], { phoneNumber })

    if not sim then
        return {}
    end

    local contacts = MySQL.query.await([[
        SELECT name, number as phone
        FROM yphone_contacts
        WHERE phone_imei = ?
        ORDER BY name ASC
    ]], { sim.phone_imei })

    return contacts or {}

end)

lib.callback.register('nordtalk:sv:inviteSMS', function(source, phone)

    local playerNumber = exports.yseries:GetPhoneNumberBySourceId(source)

    local text = "Olá! Estou a usar o NordTalk. Instala a app para falarmos!"

    -- enviar SMS via phone
    TriggerEvent("yseries:sendMessage", playerNumber, phone, text)

    return true

end)

lib.callback.register('nordtalk:updateProfile', function(src, data)

  local phone = getPhone(src)
  if not phone then return { ok = false } end

  local acc = getOrCreateAccountByPhone(phone)
  if not acc then return { ok = false } end

  local name = trim(data.name)
  local bio = trim(data.bio)
  local avatar = trim(data.avatar)

  MySQL.update.await(
    ('UPDATE `%s` SET name = ?, bio = ?, avatar = ? WHERE id = ?'):format(T.accounts),
    { name, bio, avatar, acc.id }
  )

  return { ok = true }

end)

local function sendPhoneNotification(phone, title, message)
    if not phone then return end

    phone = tostring(phone)
    title = title and tostring(title) or "Nova mensagem"
    message = message and tostring(message) or ""

    local ok, err = pcall(function()
        exports.yseries:SendNotification({
            app = "nordtalk",
            title = title,
            message = message,
            timeout = 5000,
            icon = "fa-solid fa-comments"
        }, "phoneNumber", phone)
    end)

    if not ok then
        print(("[NordTalk] SendNotification error for %s: %s"):format(phone, tostring(err)))
    else
        print(("[NordTalk] Notification sent to %s: %s"):format(phone, message))
    end
end

CreateThread(function()

    while true do

        local rows = MySQL.query.await([[
            SELECT id, chat_id, sender_id, content
            FROM nordtalk_messages
            WHERE notified = 0
            LIMIT 50
        ]])

        for _, msg in ipairs(rows) do

            local chat = MySQL.single.await(
                ('SELECT user_a, user_b FROM `%s` WHERE id = ?'):format(T.chats),
                { msg.chat_id }
            )

            if chat then

                local sender = MySQL.single.await(
                    ('SELECT phone, name FROM `%s` WHERE id = ?'):format(T.accounts),
                    { msg.sender_id }
                )

                local otherId = (chat.user_a == msg.sender_id) and chat.user_b or chat.user_a

                local other = MySQL.single.await(
                    ('SELECT phone FROM `%s` WHERE id = ?'):format(T.accounts),
                    { otherId }
                )

                if other and sender and other.phone ~= sender.phone then
                  print("Watcher message:", msg.content)
                    sendPhoneNotification(
                        other.phone,
                        sender.name or sender.phone or "User",
                        msg.content or ""
                    )
                end

            end

            MySQL.update.await(
                "UPDATE nordtalk_messages SET notified = 1 WHERE id = ?",
                { msg.id }
            )

        end

        Wait(100)

    end

end)