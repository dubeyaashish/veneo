// config.js
module.exports = {
  // Default to sandbox environment
  consumer_key: 'c1ff2a739418bf4bc940b461e13d9ce9f54312e55e37f0a6f1f7f8327dc3b5eb',
  consumer_secret: 'ac749d2bc5e9547a6af60caa3c8754a10c193dd35c1f5c26c47f9db370513d36',
  token: 'c635201371c288126c67700560ad45a7445f45590a3ff604c3fbc87c7855f4d6',
  token_secret: 'dfdb35719ce8adb50c3607bb504a3e0f502aeb6b99f3dbd7fd8081baa4b988a0',
  realm: '7446749_SB1',
  base_url: 'https://7446749-sb1.suitetalk.api.netsuite.com/services/rest/record/v1',
  accounting_url: 'https://7446749-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=',
  
  // Uncomment for production
  // consumer_key: '025b95a68dde1e99d0516b6a44cf14e718be8bca904bf3428e76b2074630fa62',
  // consumer_secret: '216c74d571627d47b303d141b71092d16d3e27d7a3ec78e279d8507a47713eae',
  // token: '10e50143a0fc323a9e112eddda1b1fc84fff8f5994180988a6559b7db3ebd95f',
  // token_secret: '6d8b2d604616b1d7c815eed551e5b879a1909529ba3a704c7966f1081bd59c52',
  // realm: '7446749',
  // base_url: 'https://7446749.suitetalk.api.netsuite.com/services/rest/record/v1',
  // accounting_url: 'https://7446749.app.netsuite.com/app/accounting/transactions/salesord.nl?id=',
  
  // Database configuration
  db: {
    host: 'itppg.com',
    user: 'misppg_db',
    password: 'JNN4ukBSUvnN2WDzLKJE',
    database: 'misppg_db'
  },
  
  // Telegram configuration
  telegram: {
    bot_token: '7758831305:AAEHezocpKfzGuig0gqrb1gIAGHJP1i-MA4', // Replace with your actual bot token
    bot_username: '@ppsalebuddy_bot', // Replace with your bot's username
    notification_url: 'https://itppg.com/telegram/send_message_api.php',
    group_chat_id: '-4774943682' // The group chat ID from your so.php
  }
};