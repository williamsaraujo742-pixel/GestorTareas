const { Pool } = require('pg');
require('dotenv').config();

// Creamos un "pool" de conexiones a PostgreSQL.
// Un pool es como una reserva de conexiones que se reutilizan para no abrir una nueva por cada consulta.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Necesario para conectarse a Neon (usa SSL)
    }
});

// Probamos la conexión al iniciar
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Error conectando a PostgreSQL:', err.message);
    } else {
        console.log('✅ Conectado a PostgreSQL en:', res.rows[0].now);
    }
});

module.exports = pool;