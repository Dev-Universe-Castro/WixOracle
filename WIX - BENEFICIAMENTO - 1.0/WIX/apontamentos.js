import wixData from 'wix-data';

$w.onReady(function () {
    setupTable();
    loadData();
});

// Função para configurar as colunas da tabela
function setupTable() {
    // Define as colunas dinamicamente
    $w('#table1').columns = [
        {
            id: "colID",
            dataPath: "ID", // Corresponde ao campo no banco de dados
            label: "ID",    // Texto exibido no cabeçalho
            type: "text"    // Tipo de dado
        },
        {
            id: "colData",
            dataPath: "DATA",
            label: "Data",
            type: "date"
        },
        {
            id: "colProcesso",
            dataPath: "TPROCESSADO",
            label: "Tipo de Processo",
            type: "text"
        },
        {
            id: "colSPeneira",
            dataPath: "SPENEIRA",
            label: "S Pen",
            type: "text"
        },
        {
            id: "colSUltra",
            dataPath: "ULTRA",
            label: "S Ultra",
            type: "text"
        }
    ];
}

// Função para carregar os dados na tabela
function loadData() {
    // Consulta os dados do banco de dados, ordenando do mais novo para o mais antigo
    wixData.query("SANKHYA/AD_DIARIOBORDO")
        .descending("DATA") // Ordena pelo campo "DATA" (do mais novo para o mais antigo)
        .find()
        .then((results) => {
            if (results.items.length > 0) {
                console.log("Dados encontrados:", results.items);

                // Insere os dados na tabela
                $w('#table1').rows = results.items;
            } else {
                console.log("Nenhum dado encontrado na coleção.");
            }
        })
        .catch((error) => {
            console.error("Erro ao buscar dados:", error);
        });
}