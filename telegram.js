const axios = require('axios');

// CONFIGURATIE TELEGRAM - ACTUALIZEAZĂ CHAT_ID CU CEL CORECT!
const TELEGRAM_BOT_TOKEN = '8408913155:AAE3WckVl2kyJIHZw0R5DbF95O5x_pAdlgU';
const TELEGRAM_CHAT_ID = '6053385288'; // INLOCUIESTE CU CHAT ID-UL CORECT!

async function trimiteNotificare(mesaj) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        
        console.log('📤 Testing Telegram...');
        
        const response = await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: mesaj
        });

        console.log('✅ SUCCESS! Message sent');
        return response.data;
    } catch (error) {
        console.error('❌ ERROR:');
        console.error('Status:', error.response?.status);
        console.error('Error:', error.response?.data?.description);
        throw error;
    }
}

// Test funcție (opțional)
async function testeazaTelegram() {
    try {
        await trimiteNotificare('🔔 TEST: Aplicația flota auto este online!');
        console.log('✅ Notificare Telegram trimisă cu succes!');
    } catch (error) {
        console.log('❌ Eroare notificare Telegram');
    }
}

module.exports = { 
    trimiteNotificare,
    testeazaTelegram
};