local RESOURCE = GetCurrentResourceName()

-- Standalone mode (PC usage): open NUI without the phone iframe
local standaloneOpen = false

RegisterCommand('nordtalk', function()
  standaloneOpen = true
  SetNuiFocus(true, true)
  SendNUIMessage({ action = 'nordtalk:standaloneOpen' })
end, false)

-- Close from UI (top-left back button)
RegisterNUICallback('nordtalk:close', function(_, cb)
  if standaloneOpen then
    standaloneOpen = false
    SetNuiFocus(false, false)
  else
    -- inside ySeries app iframe
    exports.yseries:CloseApp()
  end
  cb({})
end)

RegisterNUICallback('nordtalk:login', function(data, cb)

  local phone = tostring(data and data.phone or '')

  local ok, resp = pcall(function()
    return lib.callback.await('nordtalk:sv:login', false, phone)
  end)

  cb(ok and resp or { ok = false, error = 'login_failed' })

end)

RegisterNUICallback('nordtalk:register', function(data, cb)

  local name  = tostring(data.name or '')
  local phone = tostring(data.phone or '')
  local email = tostring(data.email or '')

  print("[NordTalk] Register request:", name, phone, email)

  local ok, resp = pcall(function()
    return lib.callback.await('nordtalk:sv:register', false, name, phone, email)
  end)

  if not ok then
    print("[NordTalk] ERROR calling server:", resp)
  end

  cb(ok and resp or { ok = false, error = 'register_failed' })

end)

RegisterNUICallback('nordtalk:verifyEmail', function(data, cb)

  local phone = tostring(data and data.phone or '')
  local code  = tostring(data and data.code or '')

  local ok, resp = pcall(function()
    return lib.callback.await('nordtalk:sv:verifyEmail', false, phone, code)
  end)

  cb(ok and resp or { ok = false, error = 'verify_failed' })

end)

RegisterNUICallback('nordtalk:restoreSession', function(data, cb)

  local phone = tostring(data and data.phone or '')

  local ok, resp = pcall(function()
    return lib.callback.await('nordtalk:sv:restoreSession', false, phone)
  end)

  cb(ok and resp or { ok = false, error = 'restore_failed' })

end)

RegisterNUICallback('nordtalk:logout', function(_, cb)

  local ok, resp = pcall(function()
    return lib.callback.await('nordtalk:sv:logout', false)
  end)

  cb(ok and resp or { ok = false, error = 'logout_failed' })

end)

-- Bootstrap + data calls
RegisterNUICallback('nordtalk:bootstrap', function(_, cb)
  local ok, data = pcall(function()
    return lib.callback.await('nordtalk:sv:bootstrap', false)
  end)
  cb(ok and data or { ok = false, error = 'bootstrap_failed' })
end)

RegisterNUICallback('nordtalk:listChats', function(_, cb)
  local ok, data = pcall(function()
    return lib.callback.await('nordtalk:sv:listChats', false)
  end)
  cb(ok and data or { ok = false, error = 'list_failed' })
end)

RegisterNUICallback('nordtalk:listGroups', function(_, cb)
  local ok, data = pcall(function()
    return lib.callback.await('nordtalk:sv:listGroups', false)
  end)
  cb(ok and data or { ok = false, error = 'list_groups_failed' })
end)

RegisterNUICallback('nordtalk:messageDelivered', function(data, cb)

  local msgId = tonumber(data and data.msgId)

  local ok, resp = pcall(function()
    return lib.callback.await('nordtalk:sv:messageDelivered', false, msgId)
  end)

  cb(ok and resp or { ok = false })

end)

RegisterNUICallback('nordtalk:messageRead', function(data, cb)

  local chatId = tonumber(data and data.chatId)

  local ok, resp = pcall(function()
    return lib.callback.await('nordtalk:sv:messageRead', false, chatId)
  end)

  cb(ok and resp or { ok = false })

end)

RegisterNUICallback('nordtalk:getMessages', function(data, cb)
  local chatId = tonumber(data and data.chatId)
  local beforeId = tonumber(data and data.beforeId)
  local ok, resp = pcall(function()
    return lib.callback.await('nordtalk:sv:getMessages', false, chatId, beforeId)
  end)
  cb(ok and resp or { ok = false, error = 'messages_failed' })
end)

RegisterNUICallback('nordtalk:sendMessage', function(data, cb)
  local chatId = tonumber(data and data.chatId)
  local text = tostring(data and data.text or '')
  local ok, resp = pcall(function()
    return lib.callback.await('nordtalk:sv:sendMessage', false, chatId, text)
  end)
  cb(ok and resp or { ok = false, error = 'send_failed' })
end)

RegisterNUICallback('nordtalk:createChat', function(data, cb)
  local targetPhone = tostring(data and data.phone or '')
  local ok, resp = pcall(function()
    return lib.callback.await('nordtalk:sv:createChat', false, targetPhone)
  end)
  cb(ok and resp or { ok = false, error = 'create_chat_failed' })
end)

RegisterNUICallback('nordtalk:createGroup', function(data, cb)
  local name = tostring(data and data.name or '')
  local ok, resp = pcall(function()
    return lib.callback.await('nordtalk:sv:createGroup', false, name)
  end)
  cb(ok and resp or { ok = false, error = 'create_group_failed' })
end)

RegisterNUICallback('nordtalk:addGroupMember', function(data, cb)
  local groupId = tonumber(data and data.groupId)
  local phone = tostring(data and data.phone or '')
  local ok, resp = pcall(function()
    return lib.callback.await('nordtalk:sv:addGroupMember', false, groupId, phone)
  end)
  cb(ok and resp or { ok = false, error = 'add_member_failed' })
end)

-- Server -> UI realtime updates
RegisterNetEvent('nordtalk:cl:push', function(payload)
  SendNUIMessage(payload)
end)

RegisterNUICallback('toggle-NuiFocusKeepInput', function(focus, cb)
    if GetResourceState('yseries') == "started" then
        exports['yseries']:SetNuiFocusKeepInput(focus)
    end
    cb(true)
end)

RegisterNUICallback('nordtalk:getContacts', function(_, cb)

    local contacts = lib.callback.await('nordtalk:sv:getContacts', false)

    cb({
        ok = true,
        contacts = contacts or {}
    })

end)

RegisterNUICallback('nordtalk:inviteSMS', function(data, cb)

    local phone = tostring(data.phone or '')

    local ok = lib.callback.await('nordtalk:sv:inviteSMS', false, phone)

    cb({ ok = ok })

end)

RegisterNUICallback('nordtalk:getProfile', function(_, cb)

  local ok, resp = pcall(function()
    return lib.callback.await('nordtalk:getProfile', false)
  end)

  cb(ok and resp or { ok = false })

end)

RegisterNUICallback('nordtalk:updateProfile', function(data, cb)

  local name = tostring(data.name or '')
  local bio = tostring(data.bio or '')
  local avatar = tostring(data.avatar or '')

  local ok, resp = pcall(function()
    return lib.callback.await('nordtalk:updateProfile', false, {
      name = name,
      bio = bio,
      avatar = avatar
    })
  end)

  cb(ok and resp or { ok = false, error = 'profile_update_failed' })

  SendNUIMessage({
    action = "nordtalk:updateProfile",
    data = data
  })

end)