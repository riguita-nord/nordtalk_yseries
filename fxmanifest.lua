fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'nordtalk_yseries'
author 'Nord Scripts'

shared_scripts {
    '@ox_lib/init.lua',
    'config.lua'
}

client_scripts {
    'client/main.lua'
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua'
}

files {
    'ui/index.html',
    'ui/style.css',
    'ui/app.js'
}

dependencies {
    'ox_lib',
    'oxmysql',
    'yseries'
}