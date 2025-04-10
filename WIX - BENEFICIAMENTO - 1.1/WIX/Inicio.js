// Guia de API: https://www.wix.com/velo/reference/api-overview/introduction
import { session } from 'wix-storage'
import wixLocation from 'wix-location';
import wixData from 'wix-data';

var logado = JSON.parse(session.getItem("logado"))

$w.onReady(function () {
    if (logado) {
        console.log("logado")
        $w("#section4").show()
    } else {
        session.clear()
        setTimeout(() => {
            wixLocation.to("https://metalcoredeveloper.wixstudio.com/beneficiamento")
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

function graficosProducao() {
    let datas = [];
    let tProcessada = [];
    let TNHORA = [];

    function formatData(rawDate) {
        let match = rawDate.match(/^(\d{2})T.*?\/(\d{2})\/(\d{4})$/);
        if (match) {
            const [_, dia, mes, ano] = match;
            return `${dia}/${mes}/${ano}`;
        }

        match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})T/);
        if (match) {
            const [_, ano, mes, dia] = match;
            return `${dia}/${mes}/${ano}`;
        }

        console.warn(`Data inválida ou formato desconhecido: ${rawDate}`);
        return "00/00/0000";
    }

    function getDate15DaysAgo() {
        const today = new Date();
        today.setDate(today.getDate() - 15);
        return today;
    }

    const data15DiasAtras = getDate15DaysAgo();

    // === Primeira query: descobrir quantos registros são dos últimos 15 dias ===
    wixData.query("SANKHYA/AD_DIARIOBORDO")
        .descending("DATA")
        .limit(500) // busca "bruta"
        .find()
        .then((res) => {
            const filtrados = res.items.filter(item => new Date(item.DATA) >= data15DiasAtras);
            const limiteNecessario = filtrados.length;

            // === Segunda query: agora com o LIMIT dinâmico ===
            return wixData.query("SANKHYA/AD_DIARIOBORDO")
                .descending("DATA")
                .limit(limiteNecessario)
                .find();
        })
        .then((results) => {
            console.log("Total de registros filtrados para gráfico:", results.items.length);

            let dataMap = {};

            results.items.forEach((item) => {
                const data = item.DATA;
                if (!dataMap[data]) {
                    dataMap[data] = {
                        TPROCESSADO: 0,
                        TNHORA: 0,
                        count: 0
                    };
                }

                dataMap[data].TPROCESSADO += item.TPROCESSADO || 0;
                dataMap[data].TNHORA += item.TNHORA || 0;
                dataMap[data].count += 1;
            });

            Object.keys(dataMap).forEach((data) => {
                const formattedDate = formatData(data);
                if (formattedDate === "00/00/0000") return;

                datas.push(formattedDate);
                tProcessada.push(parseFloat((dataMap[data].TPROCESSADO).toFixed(0)));

                const mediaTNHORA = dataMap[data].count > 0
                    ? parseFloat((dataMap[data].TNHORA / dataMap[data].count).toFixed(0))
                    : 0;

                TNHORA.push(mediaTNHORA);
            });

            // Organizar cronologicamente
            datas.reverse();
            tProcessada.reverse();
            TNHORA.reverse();

            let dados = {
                title: "               ",
                labels: datas,
                datasets: [
                    {
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

            console.log("Dados enviados para o gráfico:", dados);

            $w("#imageX4").hide();
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


function graficosSaidas() {
    let datas = [];
    let speneira = [];
    let sultra = [];
    let scm = [];

    function formatData(rawDate) {
        let match = rawDate.match(/^(\d{2})T.*?\/(\d{2})\/(\d{4})$/);
        if (match) {
            const [_, dia, mes, ano] = match;
            return `${dia}/${mes}/${ano}`;
        }

        match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})T/);
        if (match) {
            const [_, ano, mes, dia] = match;
            return `${dia}/${mes}/${ano}`;
        }

        console.warn(`Data inválida ou formato desconhecido: ${rawDate}`);
        return "00/00/0000";
    }

    function getDate15DaysAgo() {
        const today = new Date();
        today.setDate(today.getDate() - 15);
        return today;
    }

    const data15DiasAtras = getDate15DaysAgo();

    // === Primeira query: conta quantos registros são dos últimos 15 dias ===
    wixData.query("SANKHYA/AD_DIARIOBORDO")
        .descending("DATA")
        .limit(500)
        .find()
        .then((res) => {
            const filtrados = res.items.filter(item => new Date(item.DATA) >= data15DiasAtras);
            const limiteNecessario = filtrados.length || 1;

            // === Segunda query com o limit certo ===
            return wixData.query("SANKHYA/AD_DIARIOBORDO")
                .descending("DATA")
                .limit(limiteNecessario)
                .find();
        })
        .then((results) => {
            console.log("Total de registros filtrados para gráfico:", results.items.length);

            let dataMap = {};

            results.items.forEach((item) => {
                const data = item.DATA;
                const formattedDate = formatData(data);

                if (formattedDate === "00/00/0000") return;

                if (!dataMap[formattedDate]) {
                    dataMap[formattedDate] = {
                        SPENEIRA: 0,
                        SULTRA: 0,
                        SCM: 0
                    };
                }

                dataMap[formattedDate].SPENEIRA += item.SPENEIRA || 0;
                dataMap[formattedDate].SULTRA += item.SULTRA || 0;
                dataMap[formattedDate].SCM += item.SCM || 0;
            });

            Object.keys(dataMap).forEach((data) => {
                datas.push(data);
                speneira.push(parseFloat((dataMap[data].SPENEIRA).toFixed(0)));
                sultra.push(parseFloat((dataMap[data].SULTRA).toFixed(0)));
                scm.push(parseFloat((dataMap[data].SCM).toFixed(0)));
            });

            // Ordenar os dados do gráfico em ordem cronológica crescente
            datas.reverse();
            speneira.reverse();
            sultra.reverse();
            scm.reverse();

            let dados = {
                title: "               ",
                labels: datas,
                datasets: [
                    {
                        name: 'PENEIRA',
                        data: speneira,
                        color: '#000000'
                    },
                    {
                        name: 'ULTRAFINOS',
                        data: sultra,
                        color: '#808080'
                    },
                    {
                        name: 'CM',
                        data: scm,
                        color: '#A52A2A'
                    }
                ]
            };

            console.log("Dados enviados para o gráfico:", dados);

            $w("#imageX5").hide();
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

    function formatDateForDisplay(isoDate) {
        if (!isoDate) return "00/00/0000";
        const [year, month, day] = isoDate.split('-');
        return `${day}/${month}/${year}`;
    }

    function parseDate(rawDate) {
        const date = new Date(rawDate);
        if (isNaN(date.getTime())) return null;
        return date.toISOString().split('T')[0];
    }

    function getDate15DaysAgo() {
        const today = new Date();
        today.setDate(today.getDate() - 15);
        return today;
    }

    const data15DiasAtras = getDate15DaysAgo();
    let combinedDataMap = {};

    // === PASSO 1: Contar registros de PRODUÇÃO dos últimos 15 dias ===
    wixData.query("SANKHYA/AD_DIARIOBORDO")
        .descending("DATA")
        .limit(1000) // Temporário, só para contar
        .find()
        .then((resProducao) => {
            const producaoFiltrada = resProducao.items.filter(item => {
                const data = new Date(item.DATA);
                return data >= data15DiasAtras;
            });

            const qtdProducao = producaoFiltrada.length;

            // === PASSO 2: Buscar só os registros necessários da PRODUÇÃO ===
            return wixData.query("SANKHYA/AD_DIARIOBORDO")
                .descending("DATA")
                .limit(qtdProducao)
                .find();
        })
        .then((resultsProducao) => {
            resultsProducao.items.forEach((item) => {
                const data = parseDate(item.DATA);
                if (!data) return;

                const sultra = parseFloat(item.SULTRA || 0);
                const speneira = parseFloat(item.SPENEIRA || 0);

                if (!combinedDataMap[data]) combinedDataMap[data] = { producao: 0, expedicao: 0 };
                combinedDataMap[data].producao += sultra + speneira;
            });

            // === PASSO 3: Contar registros de EXPEDIÇÃO dos últimos 15 dias ===
            return wixData.query("SANKHYA/TGFCAB")
                .descending("DTNEG")
                .limit(1000)
                .find();
        })
        .then((resExpedicao) => {
            const expedicaoFiltrada = resExpedicao.items.filter(item => {
                const data = new Date(item.DTNEG);
                return data >= data15DiasAtras;
            });

            const qtdExpedicao = expedicaoFiltrada.length;

            // === PASSO 4: Buscar só os registros necessários da EXPEDIÇÃO ===
            return wixData.query("SANKHYA/TGFCAB")
                .descending("DTNEG")
                .limit(qtdExpedicao)
                .find();
        })
        .then((resultsExpedicao) => {
            resultsExpedicao.items.forEach((item) => {
                const data = parseDate(item.DTNEG);
                if (!data) return;

                const tipmov = item.TIPMOV;
                const codtipvenda = item.CODTIPVENDA;
                const peso = parseFloat(item.PESOBRUTO || 0);

                if (codtipvenda !== 12 || tipmov !== "V" || isNaN(peso) || peso <= 0) return;

                if (!combinedDataMap[data]) combinedDataMap[data] = { producao: 0, expedicao: 0 };
                combinedDataMap[data].expedicao += peso / 1000;
            });

            const orderedDates = Object.keys(combinedDataMap).sort();

            orderedDates.forEach((data) => {
                const producaoValue = combinedDataMap[data].producao;
                const expedicaoValue = combinedDataMap[data].expedicao;

                if (producaoValue === 0 && expedicaoValue === 0) return;

                const formattedDate = formatDateForDisplay(data);
                datas.push(formattedDate);
                producao.push(parseFloat(producaoValue.toFixed(0)));
                expedicao.push(parseFloat(expedicaoValue.toFixed(2)));
            });

            let dados = {
                title: "",
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

            $w("#imageX6").hide();
            $w("#html3").postMessage(dados);
            $w("#html3").onMessage((event) => {
                if (event.data.type === 'ready') {
                    $w("#html3").postMessage(dados);
                }
            });
        })
        .catch((error) => {
            console.error("Erro ao buscar dados:", error);
        });
}
