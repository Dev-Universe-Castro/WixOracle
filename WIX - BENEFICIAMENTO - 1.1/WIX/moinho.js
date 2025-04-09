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

    graficosRPM()
    graficosVazao()

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

function graficosRPM() {
    // Arrays para armazenar os dados
    let datas = [];
    let rpmMedio = [];

    // Consulta: Obter todos os dados brutos ordenados por DATA
    wixData.query("SANKHYA/AD_DIARIOBORDO")
        .descending("DATA") // Ordenar datas de forma decrescente
        .limit(100) // Limitar a 100 registros (ajuste conforme necessário)
        .find()
        .then((results) => {
            console.log("Total de registros retornados:", results.items.length);

            // Processar os dados brutos para calcular a média de RPM
            let dataMap = {}; // Usado para agrupar dados por DATA

            results.items.forEach((item) => {
                const data = item.DATA; // Data do registro
                if (!dataMap[data]) {
                    dataMap[data] = {
                        RPM: 0, // Inicializa a soma de RPM
                        count: 0 // Contagem de registros para calcular média
                    };
                }

                // Somar valores
                dataMap[data].RPM += item["RPMMOINHO"] || 0; // Soma RPM
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

                // Calcular a média de RPM
                const mediaRPM = dataMap[data].count > 0 ? parseFloat((dataMap[data].RPM / dataMap[data].count).toFixed(2)) : 0;
                rpmMedio.push(mediaRPM); // Média de RPM
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
            rpmMedio.reverse();

            // Enviar dados para o front-end
            let dados = {
                title: "Média de RPM do Moinho",
                labels: datas,
                datasets: [{
                    name: 'RPM MÉDIO',
                    data: rpmMedio,
                    type: 'line', // Gráfico de barras
                    backgroundColor: '#FF0000',
                    borderColor: '#FF0000',
                    borderWidth: 1
                }]
            };

            console.log("Dados enviados para o gráfico:", dados);

            // Enviar dados para o iframe
            $w("#html2").postMessage(dados);
            $w("#html2").onMessage((event) => {
                if (event.data.type === 'ready') {
                    $w("#html2").postMessage(dados);
                }
            });
        })
        .catch((error) => {
            console.error("Erro ao buscar dados:", error);
        });
}

function graficosVazao() {
    // Arrays para armazenar os dados
    let datas = [];
    let entradaMedia = [];
    let saidaMedia = [];

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
                        ENTRADA: [],
                        SAIDA: []
                    };
                }

                // Armazenar valores brutos para cálculo posterior
                if (item.MOINHOVAZAOENTRADA !== undefined) {
                    dataMap[formattedDate].ENTRADA.push(item.MOINHOVAZAOENTRADA);
                }
                if (item.MOINHOVAZAOSAIDA !== undefined) {
                    dataMap[formattedDate].SAIDA.push(item.MOINHOVAZAOSAIDA);
                }
            });

            // Calcular médias e extrair dados processados para arrays
            Object.keys(dataMap).forEach((data) => {
                datas.push(data); // Adiciona a data formatada

                // Calcular média de entrada
                const mediaEntrada = dataMap[data].ENTRADA.length > 0
                    ? dataMap[data].ENTRADA.reduce((sum, val) => sum + val, 0) / dataMap[data].ENTRADA.length
                    : 0;
                entradaMedia.push(parseFloat(mediaEntrada.toFixed(2)));

                // Calcular média de saída
                const mediaSaida = dataMap[data].SAIDA.length > 0
                    ? dataMap[data].SAIDA.reduce((sum, val) => sum + val, 0) / dataMap[data].SAIDA.length
                    : 0;
                saidaMedia.push(parseFloat(mediaSaida.toFixed(2)));
            });

            // Garantir que os dados estejam em ordem crescente
            datas.reverse();
            entradaMedia.reverse();
            saidaMedia.reverse();

            // Enviar dados para o front-end
            let dados = {
                title: "Média de Vazão do Moinho (Entrada e Saída)",
                labels: datas, // Datas formatadas
                datasets: [{
                        name: 'Média de Entrada',
                        data: entradaMedia,
                        color: '#0074D9' // Cor azul
                    },
                    {
                        name: 'Média de Saída',
                        data: saidaMedia,
                        color: '#FF4136' // Cor vermelha
                    }
                ]
            };

            console.log("Dados enviados para o gráfico:", dados);

            // Enviar dados para o iframe
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