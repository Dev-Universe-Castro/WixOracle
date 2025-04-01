const oracledb = require('oracledb');

async function getConnection() {
    try {
        // Validação das variáveis de ambiente
        if (!process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_CONNECTION_STRING) {
            throw new Error('Variáveis de ambiente DB_USER, DB_PASSWORD ou DB_CONNECTION_STRING não estão definidas.');
        }

        const connection = await oracledb.getConnection({
            user: process.env.DB_USER, // Usuário do banco de dados
            password: process.env.DB_PASSWORD, // Senha do banco de dados
            connectString: process.env.DB_CONNECTION_STRING // String de conexão (host:port/service_name)
        });
        console.log('Conexão com o Oracle estabelecida com sucesso!');
        return connection;
    } catch (error) {
        console.error('Erro ao conectar ao banco de dados Oracle:', error.message);
        throw error; // Rejeita a promise com o erro para tratamento externo
    }
}

module.exports = { getConnection };