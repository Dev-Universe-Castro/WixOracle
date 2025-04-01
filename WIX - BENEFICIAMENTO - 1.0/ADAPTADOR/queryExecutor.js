const oracledb = require('oracledb');
const { getConnection } = require('./oracleConnector');

// Função para executar consultas SQL
async function executeQuery(sql, binds = {}) {
    let connection;
    try {
        // Obtém uma conexão com o banco de dados
        connection = await getConnection();

        // Logs detalhados para depuração
        console.log('SQL Query:', sql);
        console.log('Bind Variables:', binds);

        // Executa a consulta
        const result = await connection.execute(sql, binds, { autoCommit: true, outFormat: oracledb.OUT_FORMAT_OBJECT });

        // Retorna as linhas ou um array vazio se não houver resultados
        return result.rows || [];
    } catch (error) {
        // Logs detalhados em caso de erro
        console.error('Erro ao executar consulta:', error.message);
        console.error('Consulta SQL:', sql);
        console.error('Bind Variables:', binds);

        // Lança o erro para ser tratado pelo chamador
        throw error;
    } finally {
        // Fecha a conexão, se estiver aberta
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Erro ao fechar a conexão:', err.message);
            }
        }
    }
}

module.exports = { executeQuery };