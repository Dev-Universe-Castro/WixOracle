const express = require('express');
const https = require('https');
const fs = require('fs');
require('dotenv').config({ path: './config.env' });
const { executeQuery } = require('./queryExecutor'); // Importa o executor de consultas adaptado para Oracle
const oracledb = require('oracledb');

const app = express();
app.use(express.json());

// Middleware para validar a chave secreta
function validateSecretKey(req, res, next) {
    const providedKey = req.body?.requestContext?.settings?.secretKey;
    if (!providedKey || providedKey !== process.env.SECRET_KEY) {
        console.warn('Tentativa de acesso não autorizado.');
        return res.status(403).json({ error: 'Acesso não autorizado' });
    }
    next();
}

app.use(express.json());

// Configuração do HTTPS
const options = {
    key: fs.readFileSync('/etc/letsencrypt/live/www.nutripaws.com.br/privkey.pem'), // Caminho para a chave privada
    cert: fs.readFileSync('/etc/letsencrypt/live/www.nutripaws.com.br/fullchain.pem') // Caminho para o certificado
};

// Inicializa o servidor HTTPS
const PORT_HTTPS = 3000; // Porta padrão para HTTPS
https.createServer(options, app).listen(PORT_HTTPS, () => {
    console.log(`Servidor HTTPS rodando na porta ${PORT_HTTPS}`);
});

// Redirecionamento de HTTP para HTTPS (opcional)
const http = require('http');
const PORT_HTTP = 8000; // Porta padrão para HTTP
http.createServer((req, res) => {
    res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
    res.end();
}).listen(PORT_HTTP, () => {
    console.log(`Redirecionamento HTTP para HTTPS rodando na porta ${PORT_HTTP}`);
});

app.use(express.json())

// Middleware para validar a chave secreta
function validateSecretKey(req, res, next) {
    const providedKey = req.body?.requestContext?.settings?.secretKey;

    if (!providedKey || providedKey !== process.env.SECRET_KEY) {
        console.warn('Tentativa de acesso não autorizado.');
        return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    next();
}

// Função para validar consultas SQL
function validateQuery(sql) {
    if (!sql || typeof sql !== 'string') {
        throw new Error('Consulta SQL inválida');
    }
    // Verifica se a consulta contém palavras-chave proibidas
    const forbiddenKeywords = ['DROP', 'DELETE', 'ALTER', 'TRUNCATE'];
    const upperCaseSql = sql.toUpperCase();
    for (const keyword of forbiddenKeywords) {
        if (upperCaseSql.includes(keyword)) {
            throw new Error(`Uso da palavra-chave '${keyword}' não permitido`);
        }
    }
}

app.post('/api/query/provision', validateSecretKey, (req, res) => {
    try {
        const installationId = req.body?.requestContext?.installationId;

        if (!installationId) {
            return res.status(400).json({ error: 'installationId não fornecido' });
        }

        console.log(`Provisionamento realizado para installationId: ${installationId}`);

        res.status(200).json({
            status: 'success',
            instanceId: installationId,
            message: 'Provisionamento concluído com sucesso'
        });
    } catch (err) {
        console.error('Erro no provisionamento:', err.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Endpoint para QUERY (POST)
app.post('/api/query', validateSecretKey, async (req, res) => {
    try {
        const { sql, binds } = req.body;

        // Valida se a consulta SQL foi fornecida
        if (!sql || typeof sql !== 'string') {
            return res.status(400).json({ error: 'Consulta SQL inválida' });
        }

        // Valida a consulta SQL
        validateQuery(sql);

        // Executa a consulta no banco de dados Oracle
        const result = await executeQuery(sql, binds || {});

        // Retorna os resultados
        res.json({ rows: result });
    } catch (err) {
        console.error('Erro ao executar consulta POST:', err.message);
        res.status(400).json({ error: err.message });
    }
});

// Endpoint para UPDATE/DELETE (POST)
app.post('/api/update', validateSecretKey, async (req, res) => {
    try {
        const sql = req.body.sql;

        if (!sql) {
            return res.status(400).json({ error: 'Consulta SQL inválida' });
        }

        validateQuery(sql);

        await executeQuery(sql);
        res.json({ message: 'Operação realizada com sucesso' });
    } catch (err) {
        console.error('Erro ao executar consulta POST:', err.message);
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/query/schemas/find', validateSecretKey, async (req, res) => {
    try {
        const { schemaIds } = req.body;

        // Validação dos parâmetros
        if (!Array.isArray(schemaIds) || schemaIds.length === 0) {
            return res.status(400).json({ error: 'Lista de schemaIds não fornecida ou vazia' });
        }

        // Constrói o objeto de resposta
        const schemas = [];

        for (const tableName of schemaIds) {
            // Consulta SQL para obter as colunas da tabela no Oracle
            const sqlColumns = `
                SELECT column_name, data_type, nullable 
                FROM user_tab_columns 
                WHERE table_name = :tableName
            `;
            const binds = { tableName }; // Usa um nome seguro para o bind parameter
            const columnsResult = await executeQuery(sqlColumns, binds);

            // Se a tabela não existir, ignorar e continuar
            if (!Array.isArray(columnsResult) || columnsResult.length === 0) {
                console.warn(`Tabela ${tableName} não encontrada ou resultados inválidos.`);
                continue;
            }

            // Consulta SQL para obter a chave primária da tabela
            const sqlPrimaryKey = `
                SELECT cols.column_name
                FROM user_constraints cons
                JOIN user_cons_columns cols ON cons.constraint_name = cols.constraint_name
                WHERE cons.constraint_type = 'P' AND cons.table_name = :tableName
            `;
            const primaryKeyResult = await executeQuery(sqlPrimaryKey, binds);
            const primaryKey = primaryKeyResult.length > 0 ? primaryKeyResult[0].COLUMN_NAME : null;

            // Mapeia os campos para o formato esperado pelo Wix
            const fields = {
                _owner: {
                    displayName: "_owner",
                    type: "text",
                    queryOperators: [
                        "eq", "lt", "gt", "hasSome", "and", "lte", "gte", "or", "not", "ne", "startsWith", "endsWith"
                    ]
                }
            };

            for (const column of columnsResult) {
                const fieldName = column.COLUMN_NAME || '';
                const fieldType = mapOracleTypeToWixType(column.DATA_TYPE || '');
                const isRequired = column.NULLABLE === 'N'; // Campo obrigatório se Nullable for "N"

                // Verifica se o campo é a chave primária
                if (fieldName === primaryKey) {
                    fields._id = {
                        displayName: "_id",
                        type: fieldType,
                        queryOperators: [
                            "eq", "lt", "gt", "hasSome", "and", "lte", "gte", "or", "not", "ne", "startsWith", "endsWith"
                        ],
                        required: isRequired
                    };
                } else {
                    fields[fieldName] = {
                        displayName: fieldName,
                        type: fieldType,
                        queryOperators: [
                            "eq", "lt", "gt", "hasSome", "and", "lte", "gte", "or", "not", "ne", "startsWith", "endsWith"
                        ],
                        required: isRequired
                    };
                }
            }

            // Adiciona o schema ao array de schemas
            schemas.push({
                displayName: tableName,
                id: tableName,
                allowedOperations: ["get", "find", "count", "update", "insert", "remove"],
                maxPageSize: 50,
                ttl: 3600,
                fields: fields
            });
        }

        // Retorna a resposta no formato esperado pelo Wix
        res.status(200).json({ schemas });
    } catch (err) {
        console.error('Erro ao encontrar schemas:', err.message);
        res.status(500).json({ error: 'Erro interno do servidor', details: err.message });
    }
});

// Função auxiliar para mapear tipos Oracle para tipos Wix
function mapOracleTypeToWixType(oracleType) {
    oracleType = oracleType.toUpperCase();
    if (oracleType.includes('NUMBER')) {
        return 'number';
    } else if (oracleType.includes('VARCHAR2') || oracleType.includes('CHAR')) {
        return 'text';
    } else if (oracleType.includes('DATE') || oracleType.includes('TIMESTAMP')) {
        return 'datetime';
    } else if (oracleType.includes('CLOB')) {
        return 'text';
    } else {
        return 'any'; // Tipo padrão caso não seja reconhecido
    }
}

app.post('/api/items/find', validateSecretKey, async (req, res) => {
    try {
        const { table, filter, limit, offset } = req.body;

        // Validação básica
        if (!table || typeof table !== 'string') {
            return res.status(400).json({ error: 'Nome da tabela é obrigatório e deve ser uma string.' });
        }

        // Montagem da consulta SQL
        let sql = `SELECT * FROM ${table}`; // No Oracle, não usamos escapeId
        const binds = {};

        if (filter && Object.keys(filter).length > 0) {
            const conditions = Object.entries(filter)
                .map(([key, value], index) => {
                    const bindKey = `bind${index}`;
                    binds[bindKey] = value;
                    return `"${key}" = :${bindKey}`; // No Oracle, os nomes de colunas podem ser case-sensitive
                })
                .join(' AND ');
            sql += ` WHERE ${conditions}`;
        }

        if (limit) {
            sql += ` FETCH FIRST :limit ROWS ONLY`; // No Oracle, usamos FETCH FIRST para limitar resultados
            binds.limit = limit;
        }

        if (offset) {
            sql = `SELECT * FROM (${sql}) OFFSET :offset ROWS`; // No Oracle, usamos OFFSET para pular linhas
            binds.offset = offset;
        }

        // Executa a consulta no banco de dados Oracle
        const result = await executeQuery(sql, binds);
        res.status(200).json({ items: result });
    } catch (err) {
        console.error('Erro ao encontrar itens:', err.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.post('/api/query/data/count', validateSecretKey, async (req, res) => {
    try {
        // Extrai os dados da requisição
        const { collectionName, filter } = req.body;

        // Valida se o nome da coleção foi fornecido
        if (!collectionName || typeof collectionName !== 'string') {
            return res.status(400).json({ error: 'Nome da coleção é obrigatório e deve ser uma string.' });
        }

        // Monta a consulta SQL básica
        let sql = `SELECT COUNT(*) AS "totalCount" FROM "${collectionName}"`;
        const binds = {};

        // Adiciona condições de filtro, se existirem
        if (filter && Object.keys(filter).length > 0) {
            const conditions = Object.entries(filter)
                .map(([key, value], index) => {
                    const bindKey = `bind${index}`;
                    binds[bindKey] = value;
                    return `"${key}" = :${bindKey}`; // No Oracle, os nomes de colunas podem ser case-sensitive
                })
                .join(' AND ');
            sql += ` WHERE ${conditions}`;
        }

        // Executa a consulta no banco de dados Oracle
        const result = await executeQuery(sql, binds);

        // Retorna o total de registros no formato esperado pelo Wix
        res.status(200).json({ totalCount: result[0]?.totalCount || 0 });
    } catch (err) {
        console.error('Erro ao contar itens:', err.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.get('/api/items/:table/:id', validateSecretKey, async (req, res) => {
    try {
        const { table, id } = req.params;
        const escapedTable = mysql.escapeId(table);
        const sql = `SELECT * FROM ${escapedTable} WHERE _id = ?`;
        const result = await executeQuery(sql, [id]);

        if (!result || result.length === 0) {
            return res.status(404).json({ error: 'Item não encontrado' });
        }

        res.status(200).json({ item: result[0] });
    } catch (err) {
        console.error('Erro ao obter item:', err.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para inserir dados no banco de dados
app.post('/api/query/data/insert', validateSecretKey, async (req, res) => {
    try {
        // Extrai os dados da requisição
        const { collectionName, item } = req.body;

        // Valida se o nome da coleção foi fornecido
        if (!collectionName || typeof collectionName !== 'string') {
            return res.status(400).json({ error: 'Nome da coleção é obrigatório e deve ser uma string.' });
        }

        // Determina qual campo usar para os dados (prioriza "item")
        const payload = item;

        // Valida se os dados a serem inseridos foram fornecidos
        if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
            return res.status(400).json({ error: 'Os dados a serem inseridos são obrigatórios e devem ser um objeto não vazio.' });
        }

        // Filtra os campos para incluir apenas aqueles que existem no banco de dados
        const allowedFields = ['ID', 'OWNER', 'NOME']; // Colunas no banco de dados
        const filteredPayload = {};
        for (const [key, value] of Object.entries(payload)) {
            if (allowedFields.includes(key)) {
                filteredPayload[key] = value;
            }
        }

        // Valida se há campos válidos para inserir
        if (Object.keys(filteredPayload).length === 0) {
            return res.status(400).json({ error: 'Nenhum campo válido para inserir. Os campos permitidos são: ID, OWNER, NOME.' });
        }

        // Converte o ID para número, se necessário
        if (!isNaN(filteredPayload.ID)) {
            filteredPayload.ID = Number(filteredPayload.ID);
        }

        // Verifica se o ID já existe no banco de dados
        const checkSql = `SELECT COUNT(*) AS count FROM ${collectionName} WHERE ID = :id`;
        const checkBinds = { id: filteredPayload.ID };
        const checkResult = await executeQuery(checkSql, checkBinds);

        if (checkResult[0]?.count > 0) {
            return res.status(409).json({ error: 'O ID fornecido já existe no banco de dados.' });
        }

        // Prepara os campos e valores para a inserção
        const fields = [];
        const placeholders = [];
        const binds = {};

        let index = 1; // Índice para os parâmetros nomeados no Oracle
        for (const [key, value] of Object.entries(filteredPayload)) {
            fields.push(`"${key}"`); // No Oracle, os nomes de colunas podem ser case-sensitive
            const bindKey = `bind${index}`;
            placeholders.push(`:${bindKey}`); // Placeholder para o valor
            binds[bindKey] = value; // Valor a ser inserido
            index++;
        }

        // Monta a consulta SQL de inserção
        const sql = `INSERT INTO ${collectionName} (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`;

        // Executa a consulta SQL
        await executeQuery(sql, binds);

        // Retorna a resposta no formato esperado pelo Wix
        res.status(200).json({
            _id: filteredPayload.ID, // Retorna o ID inserido
            message: 'Item inserido com sucesso.'
        });
    } catch (err) {
        console.error('Erro ao inserir item:', err.message);
        if (err.message.includes('ORA-00001')) {
            return res.status(409).json({ error: 'Violação de chave primária. O ID fornecido já existe.' });
        }
        res.status(500).json({ error: 'Erro interno do servidor', details: err.message });
    }
});

// Mapeamento de nomes de campos do Wix para nomes de colunas no banco de dados
const fieldMapping = {
    '_id': 'ID', // Mapeia _id do Wix para ID no Oracle
    '_owner': 'OWNER' // Mapeia _owner do Wix para OWNER no Oracle
};

// Função para obter o nome da coluna no banco de dados
function getColumnName(fieldName) {
    return fieldMapping[fieldName] || fieldName; // Usa o mapeamento ou o nome original
}


// Rota POST /api/query/data/find
app.post('/api/query/data/find', validateSecretKey, async (req, res) => {
    try {
        const { collectionName, filter, sort, skip, limit, returnTotalCount } = req.body;

        // Validação dos parâmetros obrigatórios
        if (!collectionName || typeof collectionName !== 'string') {
            return res.status(400).json({ error: 'O campo collectionName é obrigatório e deve ser uma string.' });
        }
        if (typeof skip !== 'number' || skip < 0) {
            return res.status(400).json({ error: 'O campo skip é obrigatório e deve ser um número não negativo.' });
        }
        if (typeof limit !== 'number' || limit <= 0) {
            return res.status(400).json({ error: 'O campo limit é obrigatório e deve ser um número positivo.' });
        }
        if (filter && typeof filter !== 'object') {
            return res.status(400).json({ error: 'O campo filter deve ser um objeto válido.' });
        }

        // Monta a consulta SQL básica
        let sql = `SELECT * FROM "${collectionName}"`; // Usa aspas duplas para nomes case-sensitive
        const binds = {};
        const conditions = [];

        // Adiciona condições de validação específicas para a tabela TGFAC
        if (collectionName === 'TGFCAB') {
            conditions.push(`CODTIPVENDA = [11, 12]`);
            conditions.push(`TIPMOV = 'V'`);
            conditions.push(`DTNEG IS NOT NULL`);
            conditions.push(`TO_DATE(DTNEG, 'YYYY-MM-DD') <= SYSDATE`);
            conditions.push(`PESOBRUTO > 0`);
        }

        // Processa o filtro, se existir
        if (filter && Object.keys(filter).length > 0) {
            const buildCondition = (condition, index) => {
                const { operator, fieldName, value } = condition;
                const columnName = getColumnName(fieldName); // Obtém o nome da coluna no banco de dados
                const bindName = `param_${index}`;
                switch (operator) {
                    case '$eq':
                        binds[bindName] = value;
                        return `"${columnName}" = :${bindName}`;
                    case '$contains':
                        binds[bindName] = `%${value}%`;
                        return `"${columnName}" LIKE :${bindName}`;
                    case '$hasSome':
                        if (!Array.isArray(value)) {
                            throw new Error(`Valor para operador $hasSome deve ser um array.`);
                        }
                        // Cria binds separados para cada valor no array
                        const placeholders = value.map((v, i) => {
                            const subBindName = `${bindName}_${i}`;
                            binds[subBindName] = v; // Adiciona cada valor ao objeto binds
                            return `:${subBindName}`;
                        });
                        return `"${columnName}" IN (${placeholders.join(', ')})`;
                    default:
                        throw new Error(`Operador de filtro '${operator}' não suportado.`);
                }
            };

            if (filter.$and && Array.isArray(filter.$and)) {
                filter.$and.forEach((condition, index) => {
                    conditions.push(buildCondition(condition, index));
                });
            } else if (filter.$hasSome) {
                conditions.push(buildCondition(filter, 0));
            } else {
                return res.status(400).json({ error: 'Estrutura de filtro inválida. Esperado $and ou $hasSome.' });
            }
        }

        // Combina as condições de validação com os filtros do usuário
        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`;
        }

        // Adiciona ordenação, se fornecida
        if (sort && Array.isArray(sort) && sort.length > 0) {
            const sortClauses = sort.map(({ fieldName, direction }) => {
                const columnName = getColumnName(fieldName); // Obtém o nome da coluna no banco de dados
                // Converte direções de ordenação
                const dir = direction.toUpperCase() === 'ASC' ? 1 : (direction.toUpperCase() === 'DESC' ? -1 : null);
                if (dir !== 1 && dir !== -1) {
                    throw new Error(`Direção de ordenação inválida para campo '${fieldName}'. Use 'ASC' ou 'DESC'.`);
                }
                return `"${columnName}" ${dir === 1 ? 'ASC' : 'DESC'}`;
            });
            sql += ` ORDER BY ${sortClauses.join(', ')}`;
        }

        // Adiciona paginação
        sql += ` OFFSET :skip ROWS FETCH NEXT :limit ROWS ONLY`;
        binds.skip = skip;
        binds.limit = limit;

        // Executa a consulta principal
        const rawData = await executeQuery(sql, binds);

        // Mapeia os dados para o formato esperado pelo Wix
        const items = rawData.map(row => ({
            _id: row.ID, // Mapeia ID para _id
            _owner: row.OWNER, // Mapeia OWNER para _owner
            ...row // Mantém os outros campos (opcional)
        }));

        // Calcula o total de registros, se necessário
        let totalCount = null;
        if (returnTotalCount) {
            const countSql = `SELECT COUNT(*) AS total FROM "${collectionName}"`;
            const countResult = await executeQuery(countSql, {});
            totalCount = countResult[0]?.total || 0;
        }

        // Retorna a resposta no formato esperado
        res.status(200).json({
            items: items,
            totalCount: totalCount
        });
    } catch (err) {
        console.error('Erro ao executar consulta:', err.message);
        res.status(500).json({ error: 'Erro interno do servidor', details: err.message });
    }
});

const validColumns = ['NOME', 'OWNER','ID']; // Adicione aqui todas as colunas válidas

// Rota POST /api/query/data/update
app.post('/api/query/data/update', validateSecretKey, async (req, res) => {
    try {
        const { collectionName, item } = req.body;

        // Valida se o nome da coleção foi fornecido
        if (!collectionName || typeof collectionName !== 'string') {
            return res.status(400).json({ error: 'Nome da coleção é obrigatório e deve ser uma string.' });
        }

        // Valida se o item contém os dados necessários
        if (!item || !item._id) {
            return res.status(400).json({ error: 'Item inválido ou ID ausente' });
        }

        // Filtra os campos válidos para atualização, ignorando _owner
        const updateFields = Object.keys(item)
            .filter(key => key !== '_id' && key !== '_owner' && validColumns.includes(getColumnName(key))) // Ignora _id e _owner
            .map((key, index) => `"${getColumnName(key)}" = :bind${index}`) // Usa o nome correto da coluna no banco de dados
            .join(', ');

        if (!updateFields) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        // Obtém o nome correto da coluna para o campo _id (chave primária)
        const idColumnName = getColumnName('_id');

        // Monta a consulta SQL final
        const sql = `UPDATE "${collectionName}" SET ${updateFields} WHERE "${idColumnName}" = :id`;
        const binds = {};

        // Preenche os valores dos parâmetros de atualização, ignorando _owner
        Object.keys(item)
            .filter(key => key !== '_id' && key !== '_owner' && validColumns.includes(getColumnName(key)))
            .forEach((key, index) => {
                binds[`bind${index}`] = item[key];
            });

        // Adiciona o valor do ID ao bind
        binds.id = item._id;

        console.log('SQL Query:', sql);
        console.log('Binds:', binds);

        // Executa a consulta de atualização
        const result = await executeQuery(sql, binds);

        // Verifica se algum registro foi afetado
        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Registro não encontrado' });
        }

        // Retorna a resposta de sucesso
        res.status(200).json({ message: 'Registro atualizado com sucesso, meu senhor!', affectedRows: result.rowsAffected });
    } catch (err) {
        console.error('Erro ao atualizar registro:', err.message, err.stack);
        res.status(500).json({ error: 'Erro interno do servidor, meu senhor!', details: err.message });
    }
});

app.post('/api/query/data/remove', validateSecretKey, async (req, res) => {
    try {
        const { collectionName, itemId } = req.body;

        // Valida se o nome da coleção foi fornecido
        if (!collectionName || typeof collectionName !== 'string') {
            return res.status(400).json({ error: 'Nome da coleção é obrigatório e deve ser uma string.' });
        }

        // Valida se o ID do item foi fornecido
        if (!itemId) {
            return res.status(400).json({ error: 'ID do item é obrigatório' });
        }

        // Monta a consulta SQL para remoção
        const sql = `DELETE FROM "${collectionName}" WHERE "ID" = :id RETURNING ROWID INTO :outputRowid`;
        const binds = {
            id: itemId,
            outputRowid: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
        };

        console.log('SQL Query:', sql);
        console.log('Binds:', binds);

        // Executa a consulta de remoção
        const result = await executeQuery(sql, binds);

        // Verifica se algum registro foi afetado
        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Registro não encontrado' });
        }

        // Retorna a resposta de sucesso
        res.status(200).json({ message: 'Registro removido com sucesso', affectedRows: result.rowsAffected });
    } catch (err) {
        console.error('Erro ao remover registro:', err.message, err.stack);
        res.status(500).json({ error: 'Erro interno do servidor', details: err.message });
    }
});

app.post('/api/query/schemas/list', validateSecretKey, async (req, res) => {
    try {
        // Consulta SQL para obter apenas as tabelas relevantes
        const sqlTables = `
            SELECT table_name 
            FROM user_tables 
            WHERE table_name IN (:tableName1, :tableName2, :tableName3, :tableName4)
        `;
        const binds = { 
            tableName1: 'AD_DIARIOBORDO', 
            tableName2: 'TGFCAB', 
            tableName3: 'TGFITE',
            tableName4: 'TGFPAR'
        };
        const tablesResult = await executeQuery(sqlTables, binds);
        if (!tablesResult || tablesResult.length === 0) {
            return res.status(404).json({ error: 'Nenhuma das tabelas foi encontrada no banco de dados' });
        }

        // Extrai os nomes das tabelas
        const tables = tablesResult.map(row => row.TABLE_NAME);

        // Constrói o objeto de resposta
        const schemas = [];
        for (const table of tables) {
            // Define as colunas permitidas para cada tabela
            const allowedColumns = {
                'AD_DIARIOBORDO': [], // Todas as colunas são permitidas
                'TGFCAB': ['PESOBRUTO', 'CODPARC', 'DTNEG', 'TIPMOV', 'NUNOTA'],
                'TGFITE': ['NUNOTA'],
                'TGFPAR': ['CODPARC', 'NOMEPARC']
            };

            // Consulta SQL para obter as colunas da tabela no Oracle
            const sqlColumns = `
                SELECT column_name, data_type, nullable, data_default 
                FROM user_tab_columns 
                WHERE table_name = :tableName
            `;
            const columnsResult = await executeQuery(sqlColumns, { tableName: table });

            // Mapeia os campos existentes na tabela para o formato esperado pelo Wix
            const fields = {};
            for (const column of columnsResult) {
                const fieldName = column.COLUMN_NAME || '';
                const fieldType = mapOracleTypeToWixType(column.DATA_TYPE || '');
                const isRequired = column.NULLABLE === 'N'; // Campo obrigatório se NULLABLE for "N"
                const isUnique = false; // Oracle não retorna diretamente informações sobre unicidade aqui

                // Verifica se a coluna está na lista de colunas permitidas
                if (allowedColumns[table].length > 0 && !allowedColumns[table].includes(fieldName)) {
                    continue; // Ignora colunas que não são necessárias
                }

                // Define operadores de consulta com base no tipo do campo
                let queryOperators = [];
                if (fieldType === 'text') {
                    queryOperators = ["eq", "lt", "gt", "hasSome", "and", "lte", "gte", "or", "not", "ne", "startsWith", "endsWith"];
                } else if (fieldType === 'number') {
                    queryOperators = ["eq", "lt", "gt", "hasSome", "and", "lte", "gte", "or", "not", "ne"];
                } else if (fieldType === 'datetime') {
                    queryOperators = ["eq", "lt", "gt", "hasSome", "and", "lte", "gte", "or", "not", "ne"];
                } else {
                    queryOperators = ["eq", "lt", "gt", "hasSome", "and", "lte", "gte", "or", "not", "ne"];
                }

                // Renomeia o campo ID para _id se for uma chave primária
                const primaryKeySql = `
                    SELECT cols.column_name 
                    FROM user_constraints cons, user_cons_columns cols 
                    WHERE cons.constraint_type = 'P' 
                      AND cons.table_name = :tableName 
                      AND cons.constraint_name = cols.constraint_name
                `;
                const primaryKeyResult = await executeQuery(primaryKeySql, { tableName: table });
                const isPrimaryKey = primaryKeyResult.some(row => row.COLUMN_NAME === fieldName);
                const finalFieldName = isPrimaryKey ? '_id' : fieldName;

                // Adiciona o campo ao objeto fields
                fields[finalFieldName] = {
                    displayName: fieldName,
                    type: fieldType,
                    required: isRequired,
                    unique: isUnique,
                    queryOperators: queryOperators
                };
            }

            // Adiciona o schema ao array de schemas
            schemas.push({
                displayName: table,
                id: table,
                allowedOperations: [
                    "get", "find", "count", "update", "insert", "remove"
                ],
                maxPageSize: 50,
                ttl: 3600,
                fields: fields
            });
        }

        // Retorna a resposta no formato esperado pelo Wix
        res.status(200).json({ schemas });
    } catch (err) {
        console.error('Erro ao listar schemas:', err.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Função para mapear tipos Oracle para tipos Wix
function mapOracleTypeToWixType(oracleType) {
    oracleType = oracleType.toLowerCase();

    if (['number', 'integer', 'float', 'decimal'].includes(oracleType)) {
        return 'number';
    } else if (['varchar2', 'nvarchar2', 'char', 'clob'].includes(oracleType)) {
        return 'text'; // Alterado para "text" em vez de "string"
    } else if (['date', 'timestamp'].includes(oracleType)) {
        return 'datetime';
    } else if (['boolean'].includes(oracleType)) {
        return 'boolean';
    } else {
        return 'any'; // Tipo padrão caso não seja reconhecido
    }
}

// Inicializa o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));