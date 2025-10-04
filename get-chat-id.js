const axios = require('axios');

const TELEGRAM_BOT_TOKEN = '8408913155:AAE3WckVl2kyJIHZw0R5DbF95O5x_pAdlgU';

async function findChatId() {
    try {
        console.log('🔍 Caută chat ID...');
        const response = await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`);
        
        if (response.data.result.length === 0) {
            console.log('❌ NU există mesaje! Trimite /start la botul tău în Telegram.');
            return;
        }
        
        console.log('📱 Chat ID-uri găsite:');
        response.data.result.forEach((update, index) => {
            const chat = update.message.chat;
            console.log(`${index + 1}. Chat ID: ${chat.id}`);
            console.log(`   Nume: ${chat.first_name} ${chat.last_name || ''}`);
            console.log(`   Username: @${chat.username || 'N/A'}`);
            console.log('---');
        });
        
    } catch (error) {
        console.log('❌ Eroare:', error.response?.data?.description);
    }
}

findChatId();