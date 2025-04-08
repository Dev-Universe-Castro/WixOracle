// Guia de API: https://www.wix.com/velo/reference/api-overview/introduction
import { session } from 'wix-storage'
import wixLocation from 'wix-location';
import { local } from 'wix-storage';
import wixData from 'wix-data';

var logado = JSON.parse(session.getItem("logado"))

$w.onReady(function () {
    if (logado) {
        console.log("logado")
        $w("#section4").show()
    } else {
        session.clear()
        setTimeout(() => {
            wixLocation.to("https://metalcoredeveloper.wixstudio.com/producao")
        }, 1);
    }
    

    graficosProducao()
    graficosSaidas()
    graficoProducaoExpedicao()

});

//nomeTXT
var usuario = JSON.parse(session.getItem("usuario"))
var nome = usuario.nome

var animacaoBollean = false

$w.onReady(function () {

    $w("#button5").label = nome
    console.log(JSON.parse(session.getItem("usuario")))

});

$w('#button5').onClick((event) => {
    let animacao = {

        "direction": "top",
        "duration": 500
    }

})

/*$w('#button6').onClick((event) => {
    session.clear()
    setTimeout(() => {
        wixLocation.to("https://metalcoredeveloper.wixstudio.com/producao")
    }, 200);
})*/

function graficosProducao() {
    // Arrays para armazenar os dados
    let datas = [];
    let tProcessada = [];
    let TNHORA = [];

    // Consulta 1: Obter todos os dados brutos ordenados por DATA
    wixData.query("SANKHYA/AD_DIARIOBORDO")
        .descending("DATA") // Ordenar datas de forma decrescente
        .limit(100) // Limitar a 15 registros
        .find()
        .then((results) => {
            console.log("Total de registros retornados:", results.items.length); // Log para verificar quantos registros foram retornados

            // Processar os dados brutos para calcular soma e média
            let dataMap = {}; // Usado para agrupar dados por DATA

            results.items.forEach((item) => {
                const data = item.DATA; // Data do registro
                if (!dataMap[data]) {
                    dataMap[data] = {
                        TPROCESSADO: 0, // Inicializa a soma de TPROCESSADO
                        TNHORA: 0, // Inicializa a soma de TNHORA
                        count: 0 // Contagem de registros para calcular média
                    };
                }

                // Somar valores
                dataMap[data].TPROCESSADO += item.TPROCESSADO || 0;
                dataMap[data].TNHORA += item.TNHORA || 0; // Soma TNHORA
                dataMap[data].count += 1; // Incrementar contagem
            });

            // Extrair dados processados para arrays
            Object.keys(dataMap).forEach((data) => {
                const formattedDate = formatData(data);
                if (formattedDate === "00/00/0000") {
                    console.warn(`Data inválida ignorada: ${data}`);
                    return; // Ignora datas inválidas
                }

                datas.push(formattedDate); // Data formatada
                tProcessada.push(parseFloat((dataMap[data].TPROCESSADO).toFixed(0))); // Soma de TPROCESSADO

                // Calcular a média de TNHORA
                const mediaTNHORA = dataMap[data].count > 0 ? parseFloat((dataMap[data].TNHORA / dataMap[data].count).toFixed(0)) : 0;
                TNHORA.push(mediaTNHORA); // Média de TNHORA
            });

            // Função para formatar a data
            function formatData(rawDate) {
                // Tentativa 1: Formato "DDT.../MM/YYYY"
                let match = rawDate.match(/^(\d{2})T.*?\/(\d{2})\/(\d{4})$/);
                if (match) {
                    const [_, dia, mes, ano] = match;
                    return `${dia}/${mes}/${ano}`;
                }

                // Tentativa 2: Formato ISO 8601 ("YYYY-MM-DDTHH:mm:ssZ")
                match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})T/);
                if (match) {
                    const [_, ano, mes, dia] = match;
                    return `${dia}/${mes}/${ano}`;
                }

                // Se nenhum formato corresponder, retorna uma mensagem de erro ou uma data padrão
                console.warn(`Data inválida ou formato desconhecido: ${rawDate}`);
                return "00/00/0000"; // Retorna uma data padrão ou uma string vazia
            }

            // Garantir que os dados estejam em ordem crescente
            datas.reverse();
            tProcessada.reverse();
            TNHORA.reverse();

            // Enviar dados para o front-end
            let dados = {
                title: "               ",
                labels: datas,
                datasets: [{
                        name: 'PESO PROCESSADO',
                        data: tProcessada,
                        type: 'column',
                        backgroundColor: '#FF903A',
                        borderColor: '#FF903A',
                        borderWidth: 1
                    },
                    {
                        name: 'TON/HORA',
                        data: TNHORA,
                        type: 'line',
                        borderColor: 'rgba(0, 0, 0, 1)',
                        borderWidth: 2,
                        fill: false
                    }
                ]
            };

            console.log("Dados enviados para o gráfico:", dados)

            // Enviar dados para o iframe
            $w("#imageX4").hide()
            $w("#html2").postMessage(dados)
            $w("#html2").onMessage((event) => {
                if (event.data.type === 'ready') {
                    $w("#html2").postMessage(dados)
                    
                }
            });
        })
        .catch((error) => {
            console.error("Erro ao buscar dados:", error);
        });
}


function graficosSaidas() {
    // Arrays para armazenar os dados
    let datas = [];
    let speneira = [];
    let sultra = [];
    let scm = [];

    // Função para formatar a data
    function formatData(rawDate) {
        // Tentativa 1: Formato "DDT.../MM/YYYY"
        let match = rawDate.match(/^(\d{2})T.*?\/(\d{2})\/(\d{4})$/);
        if (match) {
            const [_, dia, mes, ano] = match;
            return `${dia}/${mes}/${ano}`;
        }

        // Tentativa 2: Formato ISO 8601 ("YYYY-MM-DDTHH:mm:ssZ")
        match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})T/);
        if (match) {
            const [_, ano, mes, dia] = match;
            return `${dia}/${mes}/${ano}`;
        }

        // Se nenhum formato corresponder, retorna uma mensagem de erro ou uma data padrão
        console.warn(`Data inválida ou formato desconhecido: ${rawDate}`);
        return "00/00/0000"; // Retorna uma data padrão ou uma string vazia
    }

    // Consulta 1: Obter todos os dados brutos ordenados por DATA
    wixData.query("SANKHYA/AD_DIARIOBORDO")
        .descending("DATA") // Ordenar datas de forma decrescente
        .limit(100) // Limitar a 15 registros
        .find()
        .then((results) => {
            // Processar os dados brutos
            let dataMap = {}; // Usado para evitar duplicação de datas

            results.items.forEach((item) => {
                const data = item.DATA; // Data do registro
                const formattedDate = formatData(data);

                if (!dataMap[formattedDate]) {
                    dataMap[formattedDate] = {
                        SPENEIRA: 0,
                        SULTRA: 0,
                        SCM: 0
                    };
                }

                // Somar valores
                dataMap[formattedDate].SPENEIRA += item.SPENEIRA || 0;
                dataMap[formattedDate].SULTRA += item.SULTRA || 0;
                dataMap[formattedDate].SCM += item.SCM || 0;
            });

            // Extrair dados processados para arrays
            Object.keys(dataMap).forEach((data) => {
                datas.push(data); // Adiciona a data formatada
                speneira.push(parseFloat((dataMap[data].SPENEIRA).toFixed(0)));
                sultra.push(parseFloat((dataMap[data].SULTRA).toFixed(0)));
                scm.push(parseFloat((dataMap[data].SCM).toFixed(0)));
            });

            // Garantir que os dados estejam em ordem crescente
            datas.reverse();
            speneira.reverse();
            sultra.reverse();
            scm.reverse();

            // Enviar dados para o front-end
            let dados = {
                title: "               ",
                labels: datas, // Datas formatadas
                datasets: [{
                        name: 'PENEIRA',
                        data: speneira,
                        color: '#000000' // Cor preta
                    },
                    {
                        name: 'ULTRAFINOS',
                        data: sultra,
                        color: '#808080' // Cor cinza
                    },
                    {
                        name: 'CM',
                        data: scm,
                        color: '#A52A2A' // Cor marrom
                    }
                ]
            };

            console.log("Dados enviados para o gráfico:", dados);

            // Enviar dados para o iframe
            $w("#imageX5").hide()
            $w("#html1").postMessage(dados);
            $w("#html1").onMessage((event) => {
                if (event.data.type === 'ready') {
                    $w("#html1").postMessage(dados);
                }
            });
        })
        .catch((error) => {
            console.error("Erro ao buscar dados:", error);
        });
}

function graficoProducaoExpedicao() {
    let datas = [];
    let producao = [];
    let expedicao = [];

    wixData.query("SANKHYA/AD_DIARIOBORDO")
        .descending("DATA")
        .limit(100)
        .find()
        .then((resultsProducao) => {
            console.log("Total de registros de PRODUÇÃO retornados:", resultsProducao.items.length);

            let producaoMap = {};

            resultsProducao.items.forEach((item) => {
                const data = item.DATA;
                const sultra = parseFloat(item.SULTRA || 0);
                const speneira = parseFloat(item.SPENEIRA || 0);

                if (!data || isNaN(Date.parse(data))) return;
                if (isNaN(sultra) || isNaN(speneira)) return;

                const formattedDate = formatData(data);
                if (formattedDate === "00/00/0000") return;

                if (!producaoMap[formattedDate]) producaoMap[formattedDate] = 0;
                producaoMap[formattedDate] += sultra + speneira;
            });

            return wixData.query("SANKHYA/TGFCAB")
                .descending("DTNEG")
                .limit(500)
                .find()
                .then((resultsExpedicao) => {
                    console.log("Total de registros de EXPEDIÇÃO retornados:", resultsExpedicao.items.length);

                    let expedicaoMap = {};

                    resultsExpedicao.items.forEach((item) => {
                        const tipmov = item.TIPMOV;
                        const codtipvenda = item.CODTIPVENDA;
                        const data = item.DTNEG;
                        const peso = parseFloat(item.PESOBRUTO || 0);

                        if (!codtipvenda || codtipvenda !== 12) return;
                        if (!tipmov || tipmov !== "V") return;
                        if (!data || isNaN(Date.parse(data))) return;
                        if (isNaN(peso) || peso <= 0) return;

                        const formattedDate = formatData(data);
                        if (formattedDate === "00/00/0000") return;

                        if (!expedicaoMap[formattedDate]) expedicaoMap[formattedDate] = 0;
                        expedicaoMap[formattedDate] += peso / 1000;
                    });

                    let combinedDataMap = {};

                    Object.keys(producaoMap).forEach((data) => {
                        if (!combinedDataMap[data]) combinedDataMap[data] = { producao: 0, expedicao: 0 };
                        combinedDataMap[data].producao = parseFloat((producaoMap[data]).toFixed(0));
                    });

                    Object.keys(expedicaoMap).forEach((data) => {
                        if (!combinedDataMap[data]) combinedDataMap[data] = { producao: 0, expedicao: 0 };
                        combinedDataMap[data].expedicao = parseFloat((expedicaoMap[data]).toFixed(2));
                    });

                    Object.keys(combinedDataMap).forEach((data) => {
                        const producaoValue = combinedDataMap[data].producao;
                        const expedicaoValue = combinedDataMap[data].expedicao;

                        if (producaoValue === 0 && expedicaoValue === 0) return;

                        datas.push(data);
                        producao.push(producaoValue);
                        expedicao.push(expedicaoValue);
                    });

                    datas.reverse();
                    producao.reverse();
                    expedicao.reverse();

                    let dados = {
                        title: "Gráfico de Produção e Expedição",
                        labels: datas,
                        datasets: [
                            {
                                name: 'PRODUÇÃO (SULTRA + SPENEIRA)',
                                data: producao,
                                type: 'column',
                                backgroundColor: '#FF903A',
                                borderColor: '#FF903A',
                                borderWidth: 1
                            },
                            {
                                name: 'EXPEDIÇÃO (TONELADAS)',
                                data: expedicao,
                                type: 'column',
                                backgroundColor: '#36A2EB',
                                borderColor: '#36A2EB',
                                borderWidth: 1
                            }
                        ]
                    };

                    console.log("Dados enviados para o gráfico:", dados);

                    $w("#imageX6").hide()
                    $w("#html3").postMessage(dados);
                    $w("#html3").onMessage((event) => {
                        if (event.data.type === 'ready') {
                            $w("#html3").postMessage(dados);
                        }
                    });
                });
        })
        .catch((error) => {
            console.error("Erro ao buscar dados:", error);
        });

    function formatData(rawDate) {
        const date = new Date(rawDate);
        if (isNaN(date.getTime())) {
            console.warn(`Data inválida ou formato desconhecido: ${rawDate}`);
            return "00/00/0000";
        }

        const dia = String(date.getDate()).padStart(2, '0');
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const ano = date.getFullYear();
        return `${dia}/${mes}/${ano}`;
    }
}