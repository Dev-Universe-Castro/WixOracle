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
            wixLocation.to("https://metalcoredeveloper.wixstudio.com/beneficiamento")
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
    let datas = [];
    let rpmMedio = [];

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

    // === Primeira query: descobre quantos registros são dos últimos 15 dias ===
    wixData.query("SANKHYA/AD_DIARIOBORDO")
        .descending("DATA")
        .limit(500) // busca inicial
        .find()
        .then((res) => {
            const filtrados = res.items.filter(item => new Date(item.DATA) >= data15DiasAtras);
            const limiteNecessario = filtrados.length;

            // === Segunda query: busca exata dos últimos 15 dias com limit correto ===
            return wixData.query("SANKHYA/AD_DIARIOBORDO")
                .descending("DATA")
                .limit(limiteNecessario)
                .find();
        })
        .then((results) => {
            console.log("Total de registros filtrados para gráfico de RPM:", results.items.length);

            let dataMap = {};

            results.items.forEach((item) => {
                const data = item.DATA;
                if (!dataMap[data]) {
                    dataMap[data] = {
                        RPM: 0,
                        count: 0
                    };
                }

                dataMap[data].RPM += item.RPMMOINHO || 0;
                dataMap[data].count += 1;
            });

            Object.keys(dataMap).forEach((data) => {
                const formattedDate = formatData(data);
                if (formattedDate === "00/00/0000") return;

                datas.push(formattedDate);

                const mediaRPM = dataMap[data].count > 0
                    ? parseFloat((dataMap[data].RPM / dataMap[data].count).toFixed(2))
                    : 0;

                rpmMedio.push(mediaRPM);
            });

            // Organizar cronologicamente
            datas.reverse();
            rpmMedio.reverse();

            let dados = {
                title: "",
                labels: datas,
                datasets: [{
                    name: 'RPM MÉDIO',
                    data: rpmMedio,
                    type: 'line',
                    backgroundColor: '#FF0000',
                    borderColor: '#FF0000',
                    borderWidth: 1
                }]
            };

            console.log("Dados enviados para o gráfico:", dados);

            $w("#html2").postMessage(dados);
            $w("#html2").onMessage((event) => {
                if (event.data.type === 'ready') {
                    $w("#html2").postMessage(dados);
                }
            });
        })
        .catch((error) => {
            console.error("Erro ao buscar dados de RPM:", error);
        });
}


function graficosVazao() {
    let datas = [];
    let entradaMedia = [];
    let saidaMedia = [];

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

    // Primeira query para descobrir quantos registros existem nos últimos 15 dias
    wixData.query("SANKHYA/AD_DIARIOBORDO")
        .descending("DATA")
        .limit(500) // busca inicial bruta
        .find()
        .then((res) => {
            const filtrados = res.items.filter(item => new Date(item.DATA) >= data15DiasAtras);
            const limiteNecessario = filtrados.length;

            // Segunda query com limite dinâmico
            return wixData.query("SANKHYA/AD_DIARIOBORDO")
                .descending("DATA")
                .limit(limiteNecessario)
                .find();
        })
        .then((results) => {
            console.log("Total de registros filtrados para gráfico de Vazão:", results.items.length);

            let dataMap = {};

            results.items.forEach((item) => {
                const data = item.DATA;
                const formattedDate = formatData(data);
                if (formattedDate === "00/00/0000") return;

                if (!dataMap[formattedDate]) {
                    dataMap[formattedDate] = {
                        ENTRADA: [],
                        SAIDA: []
                    };
                }

                if (item.MOINHOVAZAOENTRADA !== undefined) {
                    dataMap[formattedDate].ENTRADA.push(item.MOINHOVAZAOENTRADA);
                }
                if (item.MOINHOVAZAOSAIDA !== undefined) {
                    dataMap[formattedDate].SAIDA.push(item.MOINHOVAZAOSAIDA);
                }
            });

            Object.keys(dataMap).forEach((data) => {
                datas.push(data);

                const mediaEntrada = dataMap[data].ENTRADA.length > 0
                    ? dataMap[data].ENTRADA.reduce((sum, val) => sum + val, 0) / dataMap[data].ENTRADA.length
                    : 0;
                entradaMedia.push(parseFloat(mediaEntrada.toFixed(2)));

                const mediaSaida = dataMap[data].SAIDA.length > 0
                    ? dataMap[data].SAIDA.reduce((sum, val) => sum + val, 0) / dataMap[data].SAIDA.length
                    : 0;
                saidaMedia.push(parseFloat(mediaSaida.toFixed(2)));
            });

            // Ordenar cronologicamente
            datas.reverse();
            entradaMedia.reverse();
            saidaMedia.reverse();

            const dados = {
                title: "",
                labels: datas,
                datasets: [
                    {
                        name: 'Média de Entrada',
                        data: entradaMedia,
                        color: '#0074D9'
                    },
                    {
                        name: 'Média de Saída',
                        data: saidaMedia,
                        color: '#FF4136'
                    }
                ]
            };

            console.log("Dados enviados para o gráfico de vazão:", dados);

            $w("#html1").postMessage(dados);
            $w("#html1").onMessage((event) => {
                if (event.data.type === 'ready') {
                    $w("#html1").postMessage(dados);
                }
            });
        })
        .catch((error) => {
            console.error("Erro ao buscar dados de vazão:", error);
        });
}
