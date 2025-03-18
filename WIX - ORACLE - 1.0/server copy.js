const express = require('express');
require('dotenv').config();
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

// Endpoint para encontrar schemas específicos
app.post('/api/query/schemas/find', validateSecretKey, async (req, res) => {
    try {
        const { schemaIds } = req.body;

        // Validação dos parâmetros
        if (!Array.isArray(schemaIds) || schemaIds.length === 0) {
            return res.status(400).json({ error: 'Lista de schemaIds não fornecida ou vazia' });
        }

        // Constrói o objeto de resposta
        const schemas = [];

        for (const table of schemaIds) {
            // Consulta SQL para obter as colunas da tabela no Oracle
            const sqlColumns = `
                SELECT column_name, data_type, nullable 
                FROM user_tab_columns 
                WHERE table_name = :table
            `;
            const columnsResult = await executeQuery(sqlColumns, { table });

            // Se a tabela não existir, ignorar e continuar
            if (!Array.isArray(columnsResult) || columnsResult.length === 0) {
                console.warn(`Tabela ${table} não encontrada ou resultados inválidos.`);
                continue;
            }

            // Mapeia os campos para o formato esperado pelo Wix
            const fields = {
                _id: {
                    displayName: "_id",
                    type: "text",
                    queryOperators: [
                        "eq", "lt", "gt", "hasSome", "and", "lte", "gte", "or", "not", "ne", "startsWith", "endsWith"
                    ]
                },
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

                fields[fieldName] = {
                    displayName: fieldName,
                    type: fieldType,
                    queryOperators: [
                        "eq", "lt", "gt", "hasSome", "and", "lte", "gte", "or", "not", "ne", "startsWith", "endsWith"
                    ],
                    required: isRequired
                };
            }

            // Adiciona o schema ao array de schemas
            schemas.push({
                displayName: table,
                id: table,
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
        res.status(500).json({ error: 'Erro interno do servidor' });
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

app.post('/api/query/data/insert', validateSecretKey, async (req, res) => {
    try {
        // Extrai os dados da requisição
        const { collectionName, item, data } = req.body;

        // Valida se o nome da coleção foi fornecido
        if (!collectionName || typeof collectionName !== 'string') {
            return res.status(400).json({ error: 'Nome da coleção é obrigatório e deve ser uma string.' });
        }

        // Determina qual campo usar para os dados (prioriza "item" sobre "data")
        const payload = item || data;

        // Valida se os dados a serem inseridos foram fornecidos
        if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
            return res.status(400).json({ error: 'Os dados a serem inseridos são obrigatórios e devem ser um objeto não vazio.' });
        }

        // Prepara os campos e valores para a inserção
        const fields = [];
        const placeholders = [];
        const binds = {};

        let index = 1; // Índice para os parâmetros nomeados no Oracle
        for (const [key, value] of Object.entries(payload)) {
            fields.push(`"${key}"`); // No Oracle, os nomes de colunas podem ser case-sensitive
            const bindKey = `bind${index}`;
            placeholders.push(`:${bindKey}`); // Placeholder para o valor
            binds[bindKey] = value; // Valor a ser inserido
            index++;
        }

        // Monta a consulta SQL de inserção
        const sql = `INSERT INTO "${collectionName}" (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING ROWID INTO :rowid`;

        // Adiciona o bind para capturar o ROWID (equivalente ao insertId no MySQL)
        binds.rowid = { type: oracledb.STRING, dir: oracledb.BIND_OUT };

        // Executa a consulta SQL
        const result = await executeQuery(sql, binds);

        // Retorna o ROWID do item inserido (se aplicável)
        const insertedRowId = result.outBinds?.rowid?.[0] || null;

        // Retorna a resposta no formato esperado pelo Wix
        res.status(200).json({
            _id: insertedRowId ? insertedRowId.toString() : null,
            message: 'Item inserido com sucesso.'
        });
    } catch (err) {
        console.error('Erro ao inserir item:', err.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.post('/api/query/data/find', validateSecretKey, async (req, res) => {
    try {
        const { collectionName, filter, sort, skip, limit, returnTotalCount } = req.body;

        // Valida se o nome da coleção foi fornecido
        if (!collectionName || typeof collectionName !== 'string') {
            return res.status(400).json({ error: 'Nome da coleção é obrigatório e deve ser uma string.' });
        }

        // Monta a consulta SQL básica
        let sql = `SELECT * FROM "${collectionName}"`;
        const binds = {};

        // Adiciona condições de filtro, se existirem
        if (filter && Object.keys(filter).length > 0) {
            const { operator, fieldName, value } = filter;

            if (!['$hasSome', '$eq'].includes(operator)) {
                return res.status(400).json({ error: 'Operador de filtro inválido' });
            }

            if (operator === '$hasSome') {
                if (!Array.isArray(value)) {
                    return res.status(400).json({ error: 'O valor do filtro deve ser um array para o operador $hasSome' });
                }
                const placeholders = value.map((_, index) => `:bind${index}`).join(', ');
                sql += ` WHERE "${fieldName}" IN (${placeholders})`;
                value.forEach((val, index) => {
                    binds[`bind${index}`] = val;
                });
            } else if (operator === '$eq') {
                sql += ` WHERE "${fieldName}" = :bindField`;
                binds.bindField = value;
            }
        }

        // Adiciona ordenação, se existir
        if (sort && sort.length > 0) {
            const sortConditions = sort.map(({ fieldName, order }) => {
                return `"${fieldName}" ${order === 'ASC' ? 'ASC' : 'DESC'}`;
            }).join(', ');
            sql += ` ORDER BY ${sortConditions}`;
        }

        // Adiciona paginação, se existir
        if (typeof skip === 'number' && typeof limit === 'number') {
            sql += ` OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
            binds.offset = skip;
            binds.limit = limit;
        }

        console.log('SQL Query:', sql);
        console.log('Binds:', binds);

        // Executa a consulta no banco de dados Oracle
        const items = await executeQuery(sql, binds);

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(200).json({ items: [] });
        }

        let totalCount = null;
        if (returnTotalCount) {
            const countSql = `SELECT COUNT(*) AS "totalCount" FROM "${collectionName}"`;
            const countResult = await executeQuery(countSql, {});
            totalCount = countResult[0]?.totalCount || 0;
        }

        // Formata os itens retornados
        const formattedItems = items.map((item) => {
            const formattedItem = { ...item };
            if (formattedItem.date_added instanceof Date) {
                formattedItem.date_added = { "$date": formattedItem.date_added.toISOString() };
            } else {
                delete formattedItem.date_added;
            }
            return formattedItem;
        });

        // Monta a resposta final
        const response = { items: formattedItems };
        if (returnTotalCount) {
            response.totalCount = totalCount;
        }

        res.status(200).json(response);
    } catch (err) {
        console.error('Erro ao buscar itens:', err.message, err.stack);
        res.status(500).json({ error: 'Erro interno do servidor', details: err.message });
    }
});

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

        // Monta a consulta SQL para atualização
        const updateFields = Object.keys(item)
            .filter(key => key !== '_id') // Ignora o campo _id, pois ele é usado na cláusula WHERE
            .map((key, index) => `"${key}" = :bind${index}`) // No Oracle, usamos parâmetros nomeados
            .join(', ');

        if (!updateFields) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        const sql = `UPDATE "${collectionName}" SET ${updateFields} WHERE "_id" = :id`;
        const binds = {};

        // Preenche os valores dos parâmetros de atualização
        Object.keys(item)
            .filter(key => key !== '_id')
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
        res.status(200).json({ message: 'Registro atualizado com sucesso', affectedRows: result.rowsAffected });
    } catch (err) {
        console.error('Erro ao atualizar registro:', err.message, err.stack);
        res.status(500).json({ error: 'Erro interno do servidor', details: err.message });
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
        const sql = `DELETE FROM "${collectionName}" WHERE "_id" = :id RETURNING ROWID INTO :rowid`;
        const binds = {
            id: itemId,
            rowid: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
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

// Endpoint para listar schemas
app.post('/api/query/schemas/list', validateSecretKey, async (req, res) => {
    try {
        // Consulta SQL para obter as tabelas no Oracle
        const sqlTables = `SELECT table_name FROM user_tables`;
        const tablesResult = await executeQuery(sqlTables);

        if (!tablesResult || tablesResult.length === 0) {
            return res.status(404).json({ error: 'Nenhuma tabela encontrada no banco de dados' });
        }

        // Extrai os nomes das tabelas
        const tables = tablesResult.map(row => row.TABLE_NAME);

        // Constrói o objeto de resposta
        const schemas = [];

        for (const table of tables) {
            const sqlColumns = `SELECT column_name, data_type, nullable, data_default 
                                FROM user_tab_columns 
                                WHERE table_name = :tableName`;
            const columnsResult = await executeQuery(sqlColumns, { tableName: table });

            // Mapeia os campos existentes na tabela para o formato esperado pelo Wix
            const fields = {};

            for (const column of columnsResult) {
                const fieldName = column.COLUMN_NAME || '';
                const fieldType = mapOracleTypeToWixType(column.DATA_TYPE || '');
                const isRequired = column.NULLABLE === 'N'; // Campo obrigatório se NULLABLE for "N"
                const isUnique = false; // Oracle não retorna diretamente informações sobre unicidade aqui

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
                const primaryKeySql = `SELECT cols.column_name 
                                        FROM user_constraints cons, user_cons_columns cols 
                                        WHERE cons.constraint_type = 'P' 
                                          AND cons.table_name = :tableName 
                                          AND cons.constraint_name = cols.constraint_name`;
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