// Script pour migrer et initialiser les records dans Redis
require('dotenv').config();
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);

function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function seed() {
    console.log('🔧 Migration des records vers le nouveau format...');

    // Anciens records à migrer en all-time
    const oldFr = 26;
    const oldEn = 45;

    // Supprimer les anciennes clés
    await redis.del('cemantix_fr');
    await redis.del('cemantix_an');
    console.log('🗑️  Anciennes clés supprimées');

    // Définir les nouveaux records all-time
    await redis.set('cemantix_fr_alltime', oldFr);
    await redis.set('cemantix_en_alltime', oldEn);
    console.log(`✅ cemantix_fr_alltime = ${oldFr}`);
    console.log(`✅ cemantix_en_alltime = ${oldEn}`);

    // Définir le mois courant (les records mensuels restent non définis)
    const currentMonth = getCurrentMonth();
    await redis.set('cemantix_current_month', currentMonth);
    console.log(`📅 Mois initialisé: ${currentMonth}`);

    // Supprimer les éventuels records mensuels existants
    await redis.del('cemantix_fr_monthly');
    await redis.del('cemantix_en_monthly');
    console.log('📊 Records mensuels réinitialisés (aucun record ce mois)');

    // Vérification finale
    console.log('\n--- Vérification ---');
    console.log(`FR All-time: ${await redis.get('cemantix_fr_alltime')}`);
    console.log(`EN All-time: ${await redis.get('cemantix_en_alltime')}`);
    console.log(`FR Mensuel: ${await redis.get('cemantix_fr_monthly') || 'Non défini'}`);
    console.log(`EN Mensuel: ${await redis.get('cemantix_en_monthly') || 'Non défini'}`);
    console.log(`Mois courant: ${await redis.get('cemantix_current_month')}`);

    redis.disconnect();
    console.log('\n🎉 Migration terminée !');
}

seed().catch(console.error);
