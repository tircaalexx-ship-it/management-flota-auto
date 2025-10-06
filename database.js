// Actualizare frontend pentru afișare consum
function afiseazaConsumMasini(masini) {
    const container = document.getElementById('lista-masini');
    
    container.innerHTML = masini.map(masina => `
        <div class="masina-item">
            <div class="masina-info">
                <div class="masina-numar">${masina.numar_inmatriculare}</div>
                <div class="masina-detalii">
                    ${masina.marca} ${masina.model} • ${masina.tip_combustibil}
                    ${masina.an_fabricatie ? '• An: ' + masina.an_fabricatie : ''}
                </div>
                <div class="masina-stats">
                    <span class="stat-item">📏 ${masina.km_curent} km</span>
                    <span class="stat-item">⛽ ${masina.consum_mediu ? masina.consum_mediu.toFixed(2) + ' L/100km' : 'N/A'}</span>
                    <span class="stat-item">🔧 ${masina.km_curent - masina.km_ultima_revizie} km de la revizie</span>
                </div>
                ${masina.km_curent - masina.km_ultima_revizie >= 10000 ? 
                    '<div class="alerta-revizie">🚨 REVIZIE URGENTĂ</div>' : ''}
            </div>
            <div class="masina-status">
                <span class="status-alimentare ${masina.alimentat_azi ? 'success' : 'warning'}">
                    ${masina.alimentat_azi ? '✅ Alimentat azi' : '⛔ Nealimentat'}
                </span>
            </div>
        </div>
    `).join('');
}