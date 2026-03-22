Config = {}

-- ySeries custom app key (must be unique)
Config.AppKey = 'nordtalk'

-- Display name
Config.AppName = 'NordTalk'

-- If true, app appears on home screen by default. If false, it will be downloadable via AddApp.
Config.DefaultApp = false

-- ySeries OS icon (yos/humanoid). You can swap to local file by putting an image in yseries build folder,
-- but a URL is the easiest.
Config.Icon = {
  yos = 'https://i.ibb.co/QY127HV/app-icon-placeholder.png',
  humanoid = 'https://i.ibb.co/QY127HV/app-icon-placeholder.png'
}

-- NUI url
-- IMPORTANT: ySeries expects a URL, not a file path.
Config.UI = "https://cfx-nui-" .. GetCurrentResourceName() .. "/ui/index.html"

-- DB table names (match your screenshots)
Config.Tables = {
  accounts = 'nordtalk_accounts',
  chats = 'nordtalk_chats',
  messages = 'nordtalk_messages',
  groups = 'nordtalk_groups',
  group_members = 'nordtalk_group_members',
  calls = 'nordtalk_calls'
}

-- Security / limits
Config.MessageMaxLen = 2000
Config.ListLimit = 50
Config.MessagesPageSize = 50
