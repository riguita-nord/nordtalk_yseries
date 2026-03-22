# NordTalk (ySeries Custom App)

WhatsApp-style **DM chat** app for **ySeries Phone** using your existing tables:

- nordtalk_accounts
- nordtalk_chats
- nordtalk_messages
- nordtalk_groups
- nordtalk_group_members
- nordtalk_calls (not used in v1 UI)

## Requirements
- yseries phone
- ox_lib
- oxmysql

## Install
1) Put `nordtalk_yseries` in your resources folder
2) Ensure start order:
   - oxmysql
   - ox_lib
   - yseries
   - nordtalk_yseries

3) (Optional) Run `install.sql` to add indexes.

## Notes
- App is registered via `exports.yseries:AddCustomApp({...})` per documentation.
- Phone number is resolved server-side via `exports.yseries:GetPhoneNumberBySourceId(source)`.

## What works (v1)
- DMs: create chat by phone, list chats, read messages, send messages, realtime push.
- Groups: create group + add members (basic). Full group messaging can be added next.

## Config
Edit `config.lua` for key/name/icon/UI, plus table names if needed.


## Add to ySeries config (Config.CustomApps)
Add this to `config.customApps.lua` (docs: Custom apps):
{
  key = "nordtalk",
  name = "NordTalk",
  defaultApp = true,
  ui = "https://cfx-nui-nordtalk_yseries/ui/index.html",
  icon = {
    yos = "https://cdn-icons-png.flaticon.com/512/733/733585.png",
    humanoid = "https://cdn-icons-png.flaticon.com/512/733/733585.png",
  },
}

## PC usage (inside FiveM)
Use `/nordtalk` to open the UI as a standalone NUI for desktop RP/testing.
Use the top-left back button to close.
